"""Collaborative editing session manager using pycrdt (Yjs-compatible CRDT).

Manages in-memory Y.Doc instances per document, relays sync/awareness
messages between connected WebSocket clients, and persists state to
PostgreSQL on periodic intervals and when the last client disconnects.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field

from fastapi import WebSocket
from pycrdt import Doc, Text

from app.database import get_db_context

logger = logging.getLogger(__name__)

# How often to persist dirty docs (seconds)
PERSIST_INTERVAL = 30
# Grace period after last disconnect before evicting doc from memory (seconds)
EVICTION_DELAY = 60


@dataclass
class CollabClient:
    """A single WebSocket connection in a collab session."""
    websocket: WebSocket
    user_id: int
    display_name: str


@dataclass
class CollabSession:
    """In-memory state for a single collaboratively-edited document."""
    document_id: int
    ydoc: Doc = field(default_factory=Doc)
    clients: dict[int, CollabClient] = field(default_factory=dict)  # user_id → client
    dirty: bool = False
    last_activity: float = field(default_factory=time.time)

    @property
    def ytext(self) -> Text:
        """Get the shared text type (lazily created)."""
        return self.ydoc.get("content", type=Text)


class CollabManager:
    """Manages collaborative editing sessions across all documents.

    Lifecycle:
      1. First client connects → load persisted state (or bootstrap from content)
      2. Clients exchange sync/awareness messages via relay
      3. Periodic persistence of dirty docs
      4. Last client disconnects → final persist → schedule eviction
    """

    def __init__(self):
        self._sessions: dict[int, CollabSession] = {}  # document_id → session
        self._persist_task: asyncio.Task | None = None

    async def start(self):
        """Start the background persistence loop."""
        if self._persist_task is None:
            self._persist_task = asyncio.create_task(self._periodic_persist())

    def stop(self):
        """Stop background tasks."""
        if self._persist_task:
            self._persist_task.cancel()
            self._persist_task = None

    async def broadcast_maintenance(self, retry_seconds: int = 5):
        """Send a maintenance notification to all active collab WebSocket clients.

        Called during graceful shutdown to inform editing clients that the
        server is updating. Clients should show a transient notice and let
        auto-reconnect handle the rest.
        """
        import json
        message_text = json.dumps({
            "type": "maintenance",
            "message": "Server updating, reconnecting...",
            "retry_seconds": retry_seconds,
        })
        notified = 0
        for session in self._sessions.values():
            for client in list(session.clients.values()):
                try:
                    await client.websocket.send_text(message_text)
                    notified += 1
                except Exception:
                    pass
        if notified:
            logger.info("Collab: sent maintenance notice to %d clients", notified)

    # ── Client lifecycle ────────────────────────────────────────

    async def join(
        self, document_id: int, websocket: WebSocket, user_id: int, display_name: str
    ) -> CollabSession:
        """Add a client to a document's collab session.

        If no session exists, loads persisted state or bootstraps from document content.
        Returns the session (caller should then enter the message loop).
        """
        session = self._sessions.get(document_id)
        if session is None:
            session = await self._create_session(document_id)
            self._sessions[document_id] = session

        # Disconnect existing connection for same user (single-tab policy)
        if user_id in session.clients:
            old_ws = session.clients[user_id].websocket
            try:
                await old_ws.close(code=4001, reason="Replaced by new connection")
            except Exception:
                pass

        session.clients[user_id] = CollabClient(
            websocket=websocket, user_id=user_id, display_name=display_name
        )
        session.last_activity = time.time()
        logger.info("Collab: user %d joined document %d (%d clients)", user_id, document_id, len(session.clients))
        return session

    async def leave(self, document_id: int, user_id: int):
        """Remove a client from a collab session."""
        session = self._sessions.get(document_id)
        if session is None:
            return

        session.clients.pop(user_id, None)
        logger.info("Collab: user %d left document %d (%d clients remain)", user_id, document_id, len(session.clients))

        if not session.clients:
            # Last client left — persist and schedule eviction
            await self._persist_session(session)
            await self._write_content_back(session)

    # ── Message relay ───────────────────────────────────────────

    async def handle_sync_message(self, session: CollabSession, sender_id: int, data: bytes):
        """Apply a Yjs sync message to the doc and relay to other clients."""
        # Apply the update to the shared Y.Doc
        try:
            session.ydoc.apply_update(data)
        except Exception:
            logger.exception("Collab: failed to apply update for document %d", session.document_id)
            return

        session.dirty = True
        session.last_activity = time.time()

        # Relay to all other connected clients
        await self._broadcast(session, data, exclude_user=sender_id)

    async def handle_awareness_message(self, session: CollabSession, sender_id: int, data: bytes):
        """Relay an awareness message (cursor positions, selections) to peers."""
        await self._broadcast(session, data, exclude_user=sender_id)

    async def get_initial_state(self, session: CollabSession) -> bytes:
        """Return the full Y.Doc state for initial sync with a new client.

        pycrdt API: get_state() returns the state vector;
        get_update(state_vector) returns the binary update (full doc).
        An empty Doc's state vector is used to get everything.
        """
        empty_doc = Doc()
        return session.ydoc.get_update(empty_doc.get_state())

    # ── Internal helpers ────────────────────────────────────────

    async def _create_session(self, document_id: int) -> CollabSession:
        """Create a new session, loading persisted CRDT state or bootstrapping from content."""
        session = CollabSession(document_id=document_id)

        async with get_db_context() as db:
            # Try to load persisted Yjs state
            from app.models.document_collab_state import DocumentCollabState
            from sqlalchemy import select

            result = await db.execute(
                select(DocumentCollabState).where(DocumentCollabState.document_id == document_id)
            )
            collab_state = result.scalar_one_or_none()

            if collab_state and collab_state.yjs_state:
                # Restore from persisted CRDT state
                try:
                    session.ydoc.apply_update(collab_state.yjs_state)
                    logger.info("Collab: restored persisted state for document %d", document_id)
                except Exception:
                    logger.exception("Collab: failed to restore state for document %d, bootstrapping", document_id)
                    session = CollabSession(document_id=document_id)
                    await self._bootstrap_from_content(session, db)
            else:
                # No persisted state — bootstrap from document content
                await self._bootstrap_from_content(session, db)

        return session

    async def _bootstrap_from_content(self, session: CollabSession, db):
        """Initialize Y.Text from the document's current file content."""
        from app.models.document import Document as DocumentModel
        from app.services.storage.user.storage import UserStorage
        from sqlalchemy import select

        try:
            result = await db.execute(
                select(
                    DocumentModel.user_id,
                    DocumentModel.file_path,
                    DocumentModel.repository_type,
                ).where(DocumentModel.id == session.document_id)
            )
            row = result.one_or_none()
            if row is None or not row.file_path:
                content = ""
            else:
                storage = UserStorage()
                content = await storage.read_document(row.user_id, row.file_path) or ""
        except Exception:
            logger.exception("Collab: failed to load content for document %d", session.document_id)
            content = ""

        if content:
            with session.ydoc.transaction():
                text = session.ytext
                text += content
        session.dirty = True
        logger.info("Collab: bootstrapped document %d from content (%d chars)", session.document_id, len(content))

    async def _persist_session(self, session: CollabSession):
        """Write the current Y.Doc state to the database."""
        if not session.dirty:
            return

        # pycrdt: get_state() = state vector, get_update(sv) = full doc bytes
        state_vector = session.ydoc.get_state()
        empty_doc = Doc()
        full_state = session.ydoc.get_update(empty_doc.get_state())

        async with get_db_context() as db:
            from app.models.document_collab_state import DocumentCollabState
            from sqlalchemy import select
            from sqlalchemy.sql import func

            result = await db.execute(
                select(DocumentCollabState).where(DocumentCollabState.document_id == session.document_id)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.yjs_state = full_state
                existing.yjs_state_vector = state_vector
                existing.updated_at = func.now()
            else:
                db.add(DocumentCollabState(
                    document_id=session.document_id,
                    yjs_state=full_state,
                    yjs_state_vector=state_vector,
                ))
            await db.commit()

        session.dirty = False
        logger.debug("Collab: persisted state for document %d (%d bytes)", session.document_id, len(full_state))

    async def _write_content_back(self, session: CollabSession):
        """Write the Y.Text content back to the document's storage.

        Called when the last client disconnects so the canonical content
        stays in sync with the CRDT state.
        """
        content = str(session.ytext)
        if not content:
            return

        async with get_db_context() as db:
            try:
                from app.models.document import Document as DocumentModel
                from app.services.storage.user.storage import UserStorage
                from sqlalchemy import select

                result = await db.execute(
                    select(
                        DocumentModel.user_id,
                        DocumentModel.file_path,
                    ).where(DocumentModel.id == session.document_id)
                )
                row = result.one_or_none()
                if row is None or not row.file_path:
                    logger.warning("Collab: document %d not found for write-back", session.document_id)
                    return

                storage = UserStorage()
                await storage.write_document(row.user_id, row.file_path, content)
                logger.info("Collab: wrote back content for document %d (%d chars)", session.document_id, len(content))
            except Exception:
                logger.exception("Collab: failed to write back content for document %d", session.document_id)

    async def _broadcast(self, session: CollabSession, data: bytes, exclude_user: int | None = None):
        """Send binary data to all clients in a session except the sender."""
        disconnected = []
        for uid, client in session.clients.items():
            if uid == exclude_user:
                continue
            try:
                await client.websocket.send_bytes(data)
            except Exception:
                disconnected.append(uid)

        for uid in disconnected:
            session.clients.pop(uid, None)

    async def _periodic_persist(self):
        """Background loop: persist dirty sessions."""
        while True:
            try:
                await asyncio.sleep(PERSIST_INTERVAL)
                for session in list(self._sessions.values()):
                    if session.dirty:
                        await self._persist_session(session)

                    # Evict empty sessions after grace period
                    if not session.clients and time.time() - session.last_activity > EVICTION_DELAY:
                        self._sessions.pop(session.document_id, None)
                        logger.debug("Collab: evicted idle session for document %d", session.document_id)

            except asyncio.CancelledError:
                # Final persist on shutdown
                for session in self._sessions.values():
                    if session.dirty:
                        await self._persist_session(session)
                break
            except Exception:
                logger.exception("Collab: persist loop error")


# Singleton
collab_manager = CollabManager()

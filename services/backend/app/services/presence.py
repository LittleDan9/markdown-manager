"""WebSocket presence manager — tracks which users are active on which documents."""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Heartbeat interval (seconds)
HEARTBEAT_INTERVAL = 30
# Stale connection threshold (seconds)
STALE_THRESHOLD = 90


@dataclass
class UserPresence:
    """Tracks a single user's presence state."""
    user_id: int
    display_name: str
    document_id: int | None = None
    last_heartbeat: float = field(default_factory=time.time)


class PresenceManager:
    """Manages WebSocket connections and document-level presence tracking.

    Thread-safe for single-process async usage (no cross-instance support yet).
    """

    def __init__(self):
        # user_id → WebSocket
        self._connections: Dict[int, WebSocket] = {}
        # user_id → UserPresence
        self._users: Dict[int, UserPresence] = {}
        # document_id → set of user_ids
        self._document_users: Dict[int, Set[int]] = {}
        self._cleanup_task: asyncio.Task | None = None

    async def start(self):
        """Start background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())

    def stop(self):
        """Stop background cleanup task."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    async def connect(self, websocket: WebSocket, user_id: int, display_name: str):
        """Register a new WebSocket connection."""
        await websocket.accept()

        # Disconnect existing connection for same user (single-tab policy)
        if user_id in self._connections:
            await self._disconnect_quietly(user_id)

        self._connections[user_id] = websocket
        self._users[user_id] = UserPresence(
            user_id=user_id,
            display_name=display_name,
        )
        logger.info("Presence: user %d (%s) connected", user_id, display_name)

    async def disconnect(self, user_id: int):
        """Remove a user's connection and clean up presence."""
        presence = self._users.pop(user_id, None)
        self._connections.pop(user_id, None)

        if presence and presence.document_id is not None:
            self._remove_from_document(user_id, presence.document_id)
            await self._broadcast_document_presence(presence.document_id)

        logger.info("Presence: user %d disconnected", user_id)

    async def set_document(self, user_id: int, document_id: int | None):
        """Update which document a user is viewing."""
        presence = self._users.get(user_id)
        if not presence:
            return

        old_doc = presence.document_id
        if old_doc == document_id:
            return

        # Leave old document
        if old_doc is not None:
            self._remove_from_document(user_id, old_doc)
            await self._broadcast_document_presence(old_doc)

        # Join new document
        presence.document_id = document_id
        if document_id is not None:
            self._document_users.setdefault(document_id, set()).add(user_id)
            await self._broadcast_document_presence(document_id)

    def heartbeat(self, user_id: int):
        """Update heartbeat timestamp for a user."""
        if user_id in self._users:
            self._users[user_id].last_heartbeat = time.time()

    def get_document_users(self, document_id: int) -> list[dict]:
        """Get list of users present on a document."""
        user_ids = self._document_users.get(document_id, set())
        result = []
        for uid in user_ids:
            p = self._users.get(uid)
            if p:
                result.append({
                    "user_id": p.user_id,
                    "display_name": p.display_name,
                })
        return result

    # --- internal helpers ---

    def _remove_from_document(self, user_id: int, document_id: int):
        users = self._document_users.get(document_id)
        if users:
            users.discard(user_id)
            if not users:
                del self._document_users[document_id]

    async def _broadcast_document_presence(self, document_id: int):
        """Send updated presence list to all users on a document."""
        user_ids = self._document_users.get(document_id, set())
        users_list = self.get_document_users(document_id)
        message = json.dumps({
            "type": "presence",
            "document_id": document_id,
            "users": users_list,
        })

        for uid in list(user_ids):
            ws = self._connections.get(uid)
            if ws:
                try:
                    await ws.send_text(message)
                except Exception:
                    logger.debug("Failed to send presence to user %d", uid)

    async def _disconnect_quietly(self, user_id: int):
        """Close an existing connection without broadcasting."""
        ws = self._connections.pop(user_id, None)
        presence = self._users.pop(user_id, None)
        if presence and presence.document_id is not None:
            self._remove_from_document(user_id, presence.document_id)
        if ws:
            try:
                await ws.close(code=4001, reason="Replaced by new connection")
            except Exception:
                pass

    async def _periodic_cleanup(self):
        """Remove stale connections periodically."""
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                now = time.time()
                stale = [
                    uid for uid, p in self._users.items()
                    if now - p.last_heartbeat > STALE_THRESHOLD
                ]
                for uid in stale:
                    logger.info("Presence: evicting stale user %d", uid)
                    await self.disconnect(uid)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Presence cleanup error")


# Singleton instance
presence_manager = PresenceManager()

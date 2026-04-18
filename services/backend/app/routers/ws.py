"""WebSocket endpoints for real-time presence and collaborative editing."""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select

from app.configs.settings import get_settings
from app.database import get_db_context
from app.models.user import User
from app.services.presence import presence_manager
from app.services.collab import collab_manager

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()


async def _authenticate_ws(token: str) -> User | None:
    """Authenticate a WebSocket connection using a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            audience=settings.app_identifier,
            issuer=settings.app_identifier,
        )
        email = payload.get("sub")
        if not isinstance(email, str):
            return None
    except InvalidTokenError:
        return None

    async with get_db_context() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    return None


async def _handle_message(websocket: WebSocket, data: dict, user_id: int) -> None:
    """Dispatch a parsed WebSocket message to the appropriate handler."""
    msg_type = data.get("type")

    if msg_type == "join":
        doc_id = data.get("document_id")
        if isinstance(doc_id, int):
            await presence_manager.set_document(user_id, doc_id)
        else:
            await websocket.send_text(json.dumps({"type": "error", "message": "document_id must be an integer"}))
    elif msg_type == "leave":
        await presence_manager.set_document(user_id, None)
    elif msg_type == "heartbeat":
        presence_manager.heartbeat(user_id)
    else:
        await websocket.send_text(json.dumps({"type": "error", "message": f"Unknown type: {msg_type}"}))


@router.websocket("/ws/presence")
async def presence_websocket(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for document presence tracking.

    Connect with: ws://host/api/ws/presence?token=<jwt>

    Client messages (JSON):
      {"type": "join",      "document_id": 123}
      {"type": "leave"}
      {"type": "heartbeat"}

    Server messages (JSON):
      {"type": "presence", "document_id": 123, "users": [...]}
      {"type": "error",    "message": "..."}
    """
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=4003, reason="Authentication failed")
        return

    await presence_manager.connect(websocket, user.id, user.full_name)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue

            await _handle_message(websocket, data, user.id)

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for user %d", user.id)
    finally:
        await presence_manager.disconnect(user.id)


# ── Message type constants for the collab binary protocol ────────
# First byte of every binary message indicates the type:
MSG_SYNC = 0       # Yjs sync protocol (state vector / update)
MSG_AWARENESS = 1  # Awareness protocol (cursors, selections)


async def _authenticate_collab_ws(websocket, token, document_id):
    """Authenticate and authorize a collab WebSocket. Returns (user, role) or closes and returns (None, None)."""
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=4003, reason="Authentication failed")
        return None, None

    from app.crud.document_collaborator import get_user_role
    async with get_db_context() as db:
        role = await get_user_role(db, document_id, user.id)

    if role is None:
        await websocket.close(code=4004, reason="Document not found")
        return None, None
    if role not in ("owner", "editor"):
        await websocket.close(code=4003, reason="Insufficient permissions")
        return None, None

    return user, role


async def _collab_message_loop(websocket, session, user_id, document_id):
    """Process incoming collab messages until disconnect."""
    try:
        while True:
            data = await websocket.receive_bytes()
            if len(data) < 2:
                continue
            msg_type = data[0]
            payload = data[1:]
            if msg_type == MSG_SYNC:
                await collab_manager.handle_sync_message(session, user_id, payload)
            elif msg_type == MSG_AWARENESS:
                await collab_manager.handle_awareness_message(session, user_id, payload)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Collab WebSocket error for user %d on document %d", user_id, document_id)


@router.websocket("/ws/collab/{document_id}")
async def collab_websocket(
    websocket: WebSocket,
    document_id: int,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time collaborative editing.

    Binary protocol — every message is prefixed with a 1-byte type tag:
      0x00 + payload  →  Yjs sync message (state vector / update)
      0x01 + payload  →  Awareness update (cursor positions)
    """
    user, role = await _authenticate_collab_ws(websocket, token, document_id)
    if not user:
        return

    await websocket.accept()
    session = await collab_manager.join(document_id, websocket, user.id, user.full_name)

    # Send initial Y.Doc state
    try:
        initial_state = await collab_manager.get_initial_state(session)
        await websocket.send_bytes(bytes([MSG_SYNC]) + initial_state)
    except Exception:
        logger.exception("Collab: failed to send initial state to user %d", user.id)
        await websocket.close(code=1011, reason="Failed to sync initial state")
        await collab_manager.leave(document_id, user.id)
        return

    try:
        await _collab_message_loop(websocket, session, user.id, document_id)
    finally:
        await collab_manager.leave(document_id, user.id)

"""WebSocket endpoint for real-time presence tracking."""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy import select

from app.configs.settings import get_settings
from app.database import get_db_context
from app.models.user import User
from app.services.presence import presence_manager

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()


async def _authenticate_ws(token: str) -> User | None:
    """Authenticate a WebSocket connection using a JWT token."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email = payload.get("sub")
        if not isinstance(email, str):
            return None
    except JWTError:
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

"""Chat proxy — streams Platform AI chat responses to the frontend.

This is the endpoint the frontend calls for AI chat. It acts as an async
streaming proxy: receives the request, forwards to platform AI with proper
auth headers, and streams the SSE response back to the frontend.
"""

import logging
import os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Request, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse

from app.configs import settings
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai-platform"])


def _is_configured() -> bool:
    return bool(settings.platform_ai_url and settings.platform_ai_token)


def _headers(user: User) -> dict:
    return {
        "X-Platform-AI-Token": settings.platform_ai_token,
        "X-User-Email": user.email,
        "X-User-Is-Admin": str(user.is_admin).lower(),
        "Content-Type": "application/json",
    }


@router.post("/chat")
async def chat_proxy(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy AI chat to Platform AI service (SSE streaming).

    Frontend sends platform format directly: {messages, scope, scope_metadata, provider, key_id, model, ...}
    Backend injects app_id + auth headers and streams through.
    """
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "AI chat unavailable — platform AI not configured"})

    body = await request.json()
    body["app_id"] = "markdown-manager"

    async def stream_from_platform():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0)) as client:
                async with client.stream(
                    "POST",
                    f"{settings.platform_ai_url}/api/chat/ask",
                    json=body,
                    headers=_headers(current_user),
                ) as response:
                    if response.status_code != 200:
                        error_body = await response.aread()
                        yield f"data: {error_body.decode()}\n\n"
                        return
                    async for line in response.aiter_lines():
                        if line:
                            yield f"{line}\n"
                        else:
                            yield "\n"
        except httpx.ConnectError:
            yield 'data: {"type": "error", "data": {"message": "AI service unavailable"}}\n\n'
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.warning("Chat proxy error: %s", e)
            yield f'data: {{"type": "error", "data": {{"message": "{e}"}}}}\n\n'
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_from_platform(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/usage")
async def usage_proxy(current_user: User = Depends(get_current_user)):
    """Proxy usage stats from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/usage/daily",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.get("/usage/quota")
async def quota_proxy(current_user: User = Depends(get_current_user)):
    """Proxy quota status from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/usage/quota",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.get("/preferences")
async def get_preferences_proxy(current_user: User = Depends(get_current_user)):
    """Proxy preferences from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/preferences",
            params={"app_id": "markdown-manager"},
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.put("/preferences")
async def set_preferences_proxy(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy preference update to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    body = await request.json()
    body["app_id"] = "markdown-manager"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(
            f"{settings.platform_ai_url}/api/preferences",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("/attachments/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a file attachment — writes to shared volume staging, calls platform AI to process."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    # Write to staging directory on shared volume
    attachments_path = os.environ.get("ATTACHMENTS_PATH", "/app/attachments")
    staging_id = str(uuid.uuid4())
    staging_dir = Path(attachments_path) / "staging" / staging_id
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize filename
    safe_name = Path(file.filename or "upload").name.replace("\x00", "").replace("/", "").replace("\\", "").lstrip(".")[:255]
    if not safe_name:
        safe_name = "unnamed_file"
    staging_file = staging_dir / safe_name

    # Write file
    content = await file.read()
    staging_file.write_bytes(content)

    # Call platform AI to process
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.platform_ai_url}/api/chat/attachments/process",
                json={
                    "staging_path": str(staging_file),
                    "original_filename": file.filename or safe_name,
                    "mime_type": file.content_type or "application/octet-stream",
                    "user_email": current_user.email,
                    "is_admin": current_user.is_admin,
                },
                headers=_headers(current_user),
            )
            if resp.status_code == 200:
                return resp.json()
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except Exception as e:
        staging_file.unlink(missing_ok=True)
        staging_dir.rmdir()
        return JSONResponse(status_code=502, content={"detail": f"Platform AI unavailable: {e}"})


@router.get("/attachments/{attachment_id}")
async def get_attachment_proxy(attachment_id: str, current_user: User = Depends(get_current_user)):
    """Proxy attachment retrieval from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    from fastapi.responses import StreamingResponse as SR
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/chat/attachments/{attachment_id}",
            headers=_headers(current_user),
        )
        if resp.status_code != 200:
            return JSONResponse(status_code=resp.status_code, content={"detail": "Attachment not found"})
        content_type = resp.headers.get("content-type", "application/octet-stream")
        content_disp = resp.headers.get("content-disposition", "")
        headers = {"Content-Type": content_type}
        if content_disp:
            headers["Content-Disposition"] = content_disp
        return SR(content=iter([resp.content]), media_type=content_type, headers=headers)


# ── Conversation proxy endpoints ─────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations_proxy(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy conversation listing from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    params = dict(request.query_params)
    params["app_id"] = "markdown-manager"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/conversations",
            params=params,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("/conversations")
async def create_conversation_proxy(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy conversation creation to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    body = await request.json()
    body["app_id"] = "markdown-manager"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.platform_ai_url}/api/conversations",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.get("/conversations/{conversation_id}")
async def get_conversation_proxy(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Proxy get conversation from Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/conversations/{conversation_id}",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.put("/conversations/{conversation_id}")
async def update_conversation_proxy(conversation_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy conversation update to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(
            f"{settings.platform_ai_url}/api/conversations/{conversation_id}",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.delete("/conversations/{conversation_id}")
async def delete_conversation_proxy(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Proxy conversation deletion to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{settings.platform_ai_url}/api/conversations/{conversation_id}",
            headers=_headers(current_user),
        )
        if resp.status_code == 204:
            return JSONResponse(status_code=204, content=None)
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("/conversations/{conversation_id}/messages")
async def add_message_proxy(conversation_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy add message to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.platform_ai_url}/api/conversations/{conversation_id}/messages",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("/conversations/{conversation_id}/generate-title")
async def generate_title_proxy(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Proxy title generation to Platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.platform_ai_url}/api/conversations/{conversation_id}/generate-title",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())

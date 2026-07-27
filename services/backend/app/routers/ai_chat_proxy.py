"""Chat proxy — streams Platform AI chat responses to the frontend.

This is the endpoint the frontend calls for AI chat. It acts as an async
streaming proxy: receives the request, forwards to platform AI with proper
auth headers, and streams the SSE response back to the frontend.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, Request
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

    Accepts the same body as the platform AI /api/chat/ask endpoint.
    Injects app_id and forwards with auth headers.
    """
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "AI chat unavailable — platform AI not configured"})

    body = await request.json()
    # Inject app_id
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

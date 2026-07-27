"""Key management proxy — thin passthrough to Platform AI service.

Preserves the existing frontend API contract while routing key operations
to the centralized platform AI service.

This module is additive — the existing api_keys router continues to work
for local key management. Once migration is verified, the old router can be
removed and this becomes the sole implementation.
"""

import logging

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.configs import settings
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/platform-keys", tags=["platform-keys"])


def _is_configured() -> bool:
    """Check if platform AI integration is configured."""
    return bool(settings.platform_ai_url and settings.platform_ai_token)


def _headers(user: User) -> dict:
    """Build headers for platform AI requests."""
    return {
        "X-Platform-AI-Token": settings.platform_ai_token,
        "X-User-Email": user.email,
        "X-User-Is-Admin": str(user.is_admin).lower(),
        "Content-Type": "application/json",
    }


@router.get("")
async def list_keys(current_user: User = Depends(get_current_user)):
    """List API keys from platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/keys",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("")
async def create_key(request: Request, current_user: User = Depends(get_current_user)):
    """Create a new API key via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.platform_ai_url}/api/keys",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.put("/{key_id}")
async def update_key(key_id: str, request: Request, current_user: User = Depends(get_current_user)):
    """Update an API key via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    body = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(
            f"{settings.platform_ai_url}/api/keys/{key_id}",
            json=body,
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.delete("/{key_id}")
async def delete_key(key_id: str, current_user: User = Depends(get_current_user)):
    """Delete an API key via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{settings.platform_ai_url}/api/keys/{key_id}",
            headers=_headers(current_user),
        )
        if resp.status_code == 204:
            return JSONResponse(status_code=204, content=None)
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.post("/{key_id}/test")
async def test_key(key_id: str, current_user: User = Depends(get_current_user)):
    """Test an API key via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.platform_ai_url}/api/keys/{key_id}/test",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.get("/ollama/models")
async def ollama_models(current_user: User = Depends(get_current_user)):
    """List Ollama models via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/keys/ollama/models",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())


@router.get("/ollama/health")
async def ollama_health(current_user: User = Depends(get_current_user)):
    """Check Ollama health via platform AI service."""
    if not _is_configured():
        return JSONResponse(status_code=503, content={"detail": "Platform AI not configured"})

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            f"{settings.platform_ai_url}/api/keys/ollama/health",
            headers=_headers(current_user),
        )
        return JSONResponse(status_code=resp.status_code, content=resp.json())

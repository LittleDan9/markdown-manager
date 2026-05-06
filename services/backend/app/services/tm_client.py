"""Team Manager cross-app HTTP client.

Used by Markdown Manager to call Team Manager's /api/cross-app/* endpoints
for AI provider migration (export/import keys).
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)


class TMClient:
    """HTTP client for Team Manager cross-app API."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.tm_backend_url
        self.secret = settings.cross_app_secret

    def _headers(self, user_email: str) -> dict:
        return {
            "X-Cross-App-Token": self.secret,
            "X-User-Email": user_email,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, user_email: str, **kwargs) -> Any:
        url = f"{self.base_url}/api/cross-app{path}"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                resp = await getattr(client, method)(url, headers=self._headers(user_email), **kwargs)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            raise RuntimeError("Team Manager service is unavailable")
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Team Manager returned {exc.response.status_code}: {exc.response.text[:200]}")

    async def list_providers(self, user_email: str) -> list[dict]:
        """List user's AI providers in Team Manager."""
        return await self._request("get", "/ai-providers", user_email)

    async def export_provider(self, user_email: str, setting_id: int) -> dict:
        """Export a provider with decrypted key from Team Manager."""
        return await self._request("post", f"/ai-providers/export/{setting_id}", user_email)

    async def import_provider(self, user_email: str, data: dict) -> dict:
        """Import a provider (with raw key) into Team Manager."""
        return await self._request("post", "/ai-providers/import", user_email, json=data)


# Singleton
tm_client = TMClient()

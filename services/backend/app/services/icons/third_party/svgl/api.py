"""
SVGL API client for HTTP requests and response handling.

Uses the shared ResilientHttpClient for connection pooling, retries,
and rate-limit handling — replacing the manual per-request client and
bespoke _rate_limited_request logic.
"""
from typing import Optional
import logging

from ..http_client import ResilientHttpClient, TIMEOUT_METADATA

logger = logging.getLogger(__name__)

SVGL_BASE_URL = "https://api.svgl.app"


class SvglApiClient:
    """HTTP client for SVGL API"""

    def __init__(self, http_client: ResilientHttpClient | None = None):
        self._http = http_client or ResilientHttpClient(base_url=SVGL_BASE_URL)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def get_categories(self) -> list:
        """Get all available SVGL categories"""
        try:
            response = await self._http.get("/categories", timeout=TIMEOUT_METADATA)
            return response.json()
        except Exception as e:
            logger.error("Failed to fetch SVGL categories: %s", e)
            raise

    async def get_all_svgs(self) -> list:
        """Get all available SVGs"""
        try:
            response = await self._http.get("/", timeout=TIMEOUT_METADATA)
            return response.json()
        except Exception as e:
            logger.error("Failed to fetch SVGL SVGs: %s", e)
            raise

    async def get_svgs_by_category(self, category: str) -> list:
        """Get SVGs by category"""
        try:
            response = await self._http.get(f"/category/{category}", timeout=TIMEOUT_METADATA)
            return response.json()
        except Exception as e:
            logger.error("Failed to fetch SVGs for category %s: %s", category, e)
            raise

    async def get_svg_content(self, route) -> Optional[str]:
        """Get SVG content from route (handles both string and theme object routes)"""
        if not route:
            return None

        try:
            if isinstance(route, dict):
                svg_url = route.get("light") or route.get("dark")
            else:
                svg_url = route

            if not svg_url:
                return None

            response = await self._http.get(svg_url)
            return response.text
        except Exception as e:
            logger.warning("Failed to fetch SVG from %s: %s", route, e)
            return None

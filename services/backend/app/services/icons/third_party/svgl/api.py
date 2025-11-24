"""
SVGL API client for HTTP requests and response handling
"""
import httpx
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class SvglApiClient:
    """HTTP client for SVGL API with rate limiting"""
    
    def __init__(self):
        self.base_url = "https://api.svgl.app"
        self._last_request_time = None
        self._min_request_interval = 1.0  # Minimum 1 second between requests
    
    async def _rate_limited_request(self, client: httpx.AsyncClient, url: str) -> httpx.Response:
        """Make a rate-limited request to avoid 429 errors"""
        # Ensure minimum interval between requests
        if self._last_request_time:
            elapsed = datetime.now().timestamp() - self._last_request_time
            if elapsed < self._min_request_interval:
                wait_time = self._min_request_interval - elapsed
                logger.debug(f"Rate limiting: waiting {wait_time:.2f} seconds")
                await asyncio.sleep(wait_time)

        try:
            response = await client.get(url)
            self._last_request_time = datetime.now().timestamp()
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.warning(f"Rate limited by SVGL API. URL: {url}")
                # Wait longer and retry once
                await asyncio.sleep(5.0)
                response = await client.get(url)
                self._last_request_time = datetime.now().timestamp()
                response.raise_for_status()
                return response
            raise
    
    async def get_categories(self) -> List[Dict]:
        """Get all available SVGL categories"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await self._rate_limited_request(client, f"{self.base_url}/categories")
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch SVGL categories: {e}")
            raise
    
    async def get_all_svgs(self) -> List[Dict]:
        """Get all available SVGs"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await self._rate_limited_request(client, f"{self.base_url}")
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch SVGL SVGs: {e}")
            raise
    
    async def get_svgs_by_category(self, category: str) -> List[Dict]:
        """Get SVGs by category"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                category_url = f"{self.base_url}/category/{category}"
                response = await self._rate_limited_request(client, category_url)
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch SVGs for category {category}: {e}")
            raise
    
    async def get_svg_content(self, client: httpx.AsyncClient, route) -> Optional[str]:
        """Get SVG content from route (handles both string and theme object routes)"""
        if not route:
            return None

        try:
            # Handle theme objects (light/dark variants) - prefer light
            if isinstance(route, dict):
                svg_url = route.get("light") or route.get("dark")
            else:
                svg_url = route

            if not svg_url:
                return None

            response = await self._rate_limited_request(client, svg_url)
            return response.text

        except Exception as e:
            logger.warning(f"Failed to fetch SVG from {route}: {e}")
            return None

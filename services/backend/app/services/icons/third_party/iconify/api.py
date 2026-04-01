"""
Iconify API client for HTTP requests and response handling.

Uses the shared ResilientHttpClient for connection pooling, retries,
and rate-limit handling.
"""
from typing import Dict
import logging

from ..http_client import ResilientHttpClient, TIMEOUT_METADATA, TIMEOUT_BULK

logger = logging.getLogger(__name__)

ICONIFY_BASE_URL = "https://api.iconify.design"


class IconifyApiClient:
    """HTTP client for Iconify API"""

    def __init__(self, http_client: ResilientHttpClient | None = None):
        self._http = http_client or ResilientHttpClient(base_url=ICONIFY_BASE_URL)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def get_collections(self) -> Dict:
        """Fetch all collections from Iconify API"""
        try:
            response = await self._http.get("/collections", timeout=TIMEOUT_METADATA)
            return response.json()
        except Exception as e:
            logger.error("Failed to fetch Iconify collections: %s", e)
            raise

    async def get_collection_details(self, prefix: str) -> Dict:
        """Get detailed information about a specific collection"""
        try:
            response = await self._http.get(
                "/collection", params={"prefix": prefix}, timeout=TIMEOUT_METADATA,
            )
            return response.json()
        except Exception as e:
            logger.error("Failed to fetch collection details for %s: %s", prefix, e)
            raise

    async def get_icon_data(self, prefix: str, icon_names: list) -> Dict:
        """Fetch icon data for specific icons (batched to avoid URL limits)"""
        try:
            batch_size = 50
            all_icons = {}
            collection_width = 24
            collection_height = 24

            for i in range(0, len(icon_names), batch_size):
                batch = icon_names[i:i + batch_size]
                icons_param = ",".join(batch)

                response = await self._http.get(
                    f"/{prefix}.json",
                    params={"icons": icons_param},
                    timeout=TIMEOUT_BULK,
                )
                batch_data = response.json()

                batch_icons = batch_data.get("icons", {})
                all_icons.update(batch_icons)

                if i == 0:
                    collection_width = batch_data.get("width", 24)
                    collection_height = batch_data.get("height", 24)

            return {
                "icons": all_icons,
                "width": collection_width,
                "height": collection_height,
            }
        except Exception as e:
            logger.error("Failed to fetch icon data for %s: %s", prefix, e)
            raise

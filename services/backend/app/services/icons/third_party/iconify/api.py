"""
Iconify API client for HTTP requests and response handling
"""
import httpx
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class IconifyApiClient:
    """HTTP client for Iconify API"""
    
    def __init__(self):
        self.base_url = "https://api.iconify.design"
    
    async def get_collections(self) -> Dict:
        """Fetch all collections from Iconify API"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.base_url}/collections")
                response.raise_for_status()
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch Iconify collections: {e}")
            raise
    
    async def get_collection_details(self, prefix: str) -> Dict:
        """Get detailed information about a specific collection"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                collection_url = f"{self.base_url}/collection"
                params = {"prefix": prefix}
                
                response = await client.get(collection_url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch collection details for {prefix}: {e}")
            raise
    
    async def get_icon_data(self, prefix: str, icon_names: list) -> Dict:
        """Fetch icon data for specific icons"""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Handle batching to avoid URL length limits
                batch_size = 50
                all_icons = {}
                collection_width = 24
                collection_height = 24
                
                for i in range(0, len(icon_names), batch_size):
                    batch = icon_names[i:i + batch_size]
                    icons_param = ",".join(batch)
                    
                    icon_data_url = f"{self.base_url}/{prefix}.json"
                    params = {"icons": icons_param}
                    
                    response = await client.get(icon_data_url, params=params)
                    response.raise_for_status()
                    batch_data = response.json()
                    
                    # Merge batch results
                    batch_icons = batch_data.get("icons", {})
                    all_icons.update(batch_icons)
                    
                    # Use dimensions from first batch
                    if i == 0:
                        collection_width = batch_data.get("width", 24)
                        collection_height = batch_data.get("height", 24)
                
                return {
                    "icons": all_icons,
                    "width": collection_width,
                    "height": collection_height
                }
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch icon data for {prefix}: {e}")
            raise

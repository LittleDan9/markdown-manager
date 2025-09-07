"""
Iconify Browser Service
Provides a user-friendly API for browsing and installing Iconify icon packs
"""
import httpx
from typing import Dict, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class IconifyBrowserService:
    """Service for browsing Iconify collections and installing icon packs"""
    
    def __init__(self):
        self.base_url = "https://api.iconify.design"
        self._collections_cache = None
        self._cache_timestamp = None
        self.cache_duration = timedelta(hours=24)  # Cache collections for 24 hours
        
    async def get_collections(self, refresh: bool = False) -> Dict:
        """Get all available Iconify collections with caching"""
        
        if not refresh and self._collections_cache and self._cache_timestamp:
            # Check if cache is still valid
            if datetime.now() - self._cache_timestamp < self.cache_duration:
                return self._collections_cache
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.base_url}/collections")
                response.raise_for_status()
                collections = response.json()
                
                # Cache the result
                self._collections_cache = collections
                self._cache_timestamp = datetime.now()
                
                return collections
                
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch Iconify collections: {e}")
            # Return cached data if available, otherwise raise
            if self._collections_cache:
                logger.warning("Using cached collections data due to API error")
                return self._collections_cache
            raise
    
    async def search_collections(
        self,
        query: str = "",
        category: str = "",
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Search collections with filtering"""
        
        collections = await self.get_collections()
        
        # Filter collections
        filtered = {}
        for prefix, data in collections.items():
            # Apply text search
            if query:
                searchable_text = f"{data.get('name', '')} {prefix} {data.get('category', '')}".lower()
                if query.lower() not in searchable_text:
                    continue
            
            # Apply category filter
            if category and data.get('category', '').lower() != category.lower():
                continue
                
            filtered[prefix] = data
        
        # Apply pagination
        items = list(filtered.items())
        total = len(items)
        paginated_items = items[offset:offset + limit]
        
        return {
            "collections": dict(paginated_items),
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total
        }
    
    async def get_collection_icons(
        self,
        prefix: str,
        page: int = 0,
        page_size: int = 50,
        search: str = ""
    ) -> Dict:
        """Get icons from a specific collection with pagination"""
        
        # Get collections metadata first
        collections = await self.get_collections()
        collection_data = collections.get(prefix)
        if not collection_data:
            raise ValueError(f"Collection {prefix} not found")
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # First, get the complete list of icons in the collection
                collection_url = f"{self.base_url}/collection"
                collection_params = {"prefix": prefix}
                
                response = await client.get(collection_url, params=collection_params)
                response.raise_for_status()
                collection_details = response.json()
                
                # Get all available icon names from the collection
                all_icon_names = []
                
                # Collection data structure can vary, handle different formats
                if "uncategorized" in collection_details:
                    all_icon_names.extend(collection_details["uncategorized"])
                
                if "categories" in collection_details:
                    for category_icons in collection_details["categories"].values():
                        all_icon_names.extend(category_icons)
                
                # Remove duplicates (some icons might be in multiple categories)
                all_icon_names = list(set(all_icon_names))
                
                # If no icons found in expected structure, try getting from info
                if not all_icon_names and "info" in collection_details:
                    # Some collections might have icons listed differently
                    # Fall back to using samples if available
                    samples = collection_data.get('samples', [])
                    if samples:
                        all_icon_names = samples
                
                # Apply search filter if provided
                if search:
                    search_lower = search.lower()
                    all_icon_names = [
                        name for name in all_icon_names
                        if search_lower in name.lower()
                    ]
                
                # Apply pagination
                total_icons = len(all_icon_names)
                start_idx = page * page_size
                end_idx = start_idx + page_size
                page_icon_names = all_icon_names[start_idx:end_idx]
                
                if not page_icon_names:
                    return {
                        "icons": [],
                        "total": total_icons,
                        "page": page,
                        "page_size": page_size,
                        "has_more": end_idx < total_icons,
                        "collection_info": collection_data
                    }
                
                # Fetch icon data for the current page
                icons_param = ",".join(page_icon_names)
                icon_data_url = f"{self.base_url}/{prefix}.json"
                icon_params = {"icons": icons_param}
                
                icon_response = await client.get(icon_data_url, params=icon_params)
                icon_response.raise_for_status()
                icon_data = icon_response.json()
                
                # Format icons for frontend
                formatted_icons = []
                icons_dict = icon_data.get("icons", {})
                collection_width = icon_data.get("width", 24)
                collection_height = icon_data.get("height", 24)
                
                for icon_name in page_icon_names:
                    if icon_name in icons_dict:
                        icon_info = icons_dict[icon_name]
                        
                        # Get dimensions
                        width = icon_info.get("width", collection_width)
                        height = icon_info.get("height", collection_height)
                        
                        # Calculate viewBox
                        left = icon_info.get("left", 0)
                        top = icon_info.get("top", 0)
                        viewBox = f"{left} {top} {width} {height}"
                        
                        # Create normalized SVG without fixed dimensions
                        # This allows CSS to control the size properly
                        svg_content = (
                            f'<svg xmlns="http://www.w3.org/2000/svg" '
                            f'viewBox="{viewBox}" fill="currentColor">'
                            f'{icon_info.get("body", "")}</svg>'
                        )
                        
                        formatted_icons.append({
                            "name": icon_name,
                            "full_name": f"{prefix}:{icon_name}",
                            "body": icon_info.get("body", ""),
                            "width": width,
                            "height": height,
                            "viewBox": viewBox,
                            "svg": svg_content
                        })
                
                return {
                    "icons": formatted_icons,
                    "total": total_icons,
                    "page": page,
                    "page_size": page_size,
                    "has_more": end_idx < total_icons,
                    "collection_info": collection_data
                }
                
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch icons for collection {prefix}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error processing collection {prefix}: {e}")
            raise
    
    async def get_icon_data_for_install(self, prefix: str, icon_names: List[str]) -> Dict:
        """Get formatted icon data ready for installation"""
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch icon data in batches to avoid URL length limits
                batch_size = 50
                all_icons = {}
                
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
                
                # Get collection info
                collections = await self.get_collections()
                collection_info = collections.get(prefix, {})
                
                # Format for StandardizedIconPackRequest
                formatted_data = {
                    "width": collection_info.get("height", 24),  # Use collection defaults
                    "height": collection_info.get("height", 24),
                    "info": {
                        "name": prefix,
                        "displayName": collection_info.get("name", prefix),
                        "category": "iconify",  # We can make this configurable
                        "description": f"Icons from {collection_info.get('name', prefix)} collection",
                        "author": collection_info.get("author", {}).get("name", "Unknown"),
                        "license": collection_info.get("license", {}).get("title", "Unknown"),
                        "total": len(all_icons)
                    },
                    "icons": {}
                }
                
                # Process each icon
                collection_width = collection_info.get("width", 24)
                collection_height = collection_info.get("height", 24)
                
                for icon_name, icon_data in all_icons.items():
                    # Get dimensions
                    width = icon_data.get("width", collection_width)
                    height = icon_data.get("height", collection_height)
                    
                    # Calculate viewBox
                    left = icon_data.get("left", 0)
                    top = icon_data.get("top", 0)
                    viewBox = f"{left} {top} {width} {height}"
                    
                    formatted_data["icons"][icon_name] = {
                        "body": icon_data.get("body", ""),
                        "width": width,
                        "height": height,
                        "viewBox": viewBox
                    }
                
                return formatted_data
                
        except Exception as e:
            logger.error(f"Failed to format icon data for installation: {e}")
            raise
    
    async def get_collection_categories(self) -> List[str]:
        """Get unique categories from all collections"""
        
        collections = await self.get_collections()
        categories = set()
        
        for collection_data in collections.values():
            category = collection_data.get("category", "")
            if category:
                categories.add(category)
        
        return sorted(list(categories))

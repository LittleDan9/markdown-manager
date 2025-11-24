"""
Iconify collection browsing and search functionality
"""
from typing import Dict, List
import logging

from ..base import IconProviderInterface
from .api import IconifyApiClient
from .cache import IconifyCache

logger = logging.getLogger(__name__)


class IconifyCollectionBrowser(IconProviderInterface):
    """Service for browsing Iconify collections"""
    
    def __init__(self):
        self.api_client = IconifyApiClient()
        self.cache = IconifyCache()
    
    async def get_collections(self, refresh: bool = False) -> Dict:
        """Get all available Iconify collections with caching"""
        if not refresh:
            cached = self.cache.get_collections()
            if cached:
                return cached
        
        try:
            collections = await self.api_client.get_collections()
            self.cache.set_collections(collections)
            return collections
        except Exception as e:
            # Return cached data if available, otherwise raise
            cached = self.cache.get_collections()
            if cached:
                logger.warning("Using cached collections data due to API error")
                return cached
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
            # Get collection details with icon list
            collection_details = await self.api_client.get_collection_details(prefix)
            
            # Extract all icon names
            all_icon_names = []
            
            if "uncategorized" in collection_details:
                all_icon_names.extend(collection_details["uncategorized"])
            
            if "categories" in collection_details:
                for category_icons in collection_details["categories"].values():
                    all_icon_names.extend(category_icons)
            
            # Remove duplicates
            all_icon_names = list(set(all_icon_names))
            
            # Fallback to samples if no icons found
            if not all_icon_names and "info" in collection_details:
                samples = collection_data.get('samples', [])
                if samples:
                    all_icon_names = samples
            
            # Apply search filter
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
            
            # Fetch icon data
            icon_data = await self.api_client.get_icon_data(prefix, page_icon_names)
            
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
                    
                    # Create SVG content
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
            
        except Exception as e:
            logger.error(f"Error processing collection {prefix}: {e}")
            raise
    
    async def get_icon_data_for_install(self, prefix: str, icon_names: List[str]) -> Dict:
        """Get formatted icon data ready for installation"""
        try:
            # Fetch icon data
            icon_data = await self.api_client.get_icon_data(prefix, icon_names)
            
            # Get collection info
            collections = await self.get_collections()
            collection_info = collections.get(prefix, {})
            
            # Format for installation
            formatted_data = {
                "width": collection_info.get("height", 24),
                "height": collection_info.get("height", 24),
                "info": {
                    "name": prefix,
                    "displayName": collection_info.get("name", prefix),
                    "category": "iconify",
                    "description": f"Icons from {collection_info.get('name', prefix)} collection",
                    "author": collection_info.get("author", {}).get("name", "Unknown"),
                    "license": collection_info.get("license", {}).get("title", "Unknown"),
                    "total": len(icon_data.get("icons", {}))
                },
                "icons": {}
            }
            
            # Process each icon
            icons_dict = icon_data.get("icons", {})
            collection_width = icon_data.get("width", 24)
            collection_height = icon_data.get("height", 24)
            
            for icon_name, icon_info in icons_dict.items():
                # Get dimensions
                width = icon_info.get("width", collection_width)
                height = icon_info.get("height", collection_height)
                
                # Calculate viewBox
                left = icon_info.get("left", 0)
                top = icon_info.get("top", 0)
                viewBox = f"{left} {top} {width} {height}"
                
                formatted_data["icons"][icon_name] = {
                    "body": icon_info.get("body", ""),
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
    
    async def refresh_cache(self) -> None:
        """Refresh cache"""
        self.cache.clear()

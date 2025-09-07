"""
SVGL Browser Service
Provides a user-friendly API for browsing and installing SVGL icon collections
"""
import httpx
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class SvglBrowserService:
    """Service for browsing SVGL collections and installing icon packs"""
    
    def __init__(self):
        self.base_url = "https://api.svgl.app"
        self._categories_cache = None
        self._svgs_cache = None
        self._cache_timestamp = None
        self.cache_duration = timedelta(hours=6)  # Cache for 6 hours (SVGL updates more frequently)
        
    async def get_categories(self, refresh: bool = False) -> List[Dict]:
        """Get all available SVGL categories with caching"""
        
        if not refresh and self._categories_cache and self._cache_timestamp:
            # Check if cache is still valid
            if datetime.now() - self._cache_timestamp < self.cache_duration:
                return self._categories_cache
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.base_url}/categories")
                response.raise_for_status()
                categories = response.json()
                
                # Cache the result
                self._categories_cache = categories
                self._cache_timestamp = datetime.now()
                
                return categories
                
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch SVGL categories: {e}")
            # Return cached data if available, otherwise raise
            if self._categories_cache:
                logger.warning("Using cached categories data due to API error")
                return self._categories_cache
            raise
    
    async def get_all_svgs(self, refresh: bool = False) -> List[Dict]:
        """Get all available SVGs with caching"""
        
        if not refresh and self._svgs_cache and self._cache_timestamp:
            # Check if cache is still valid
            if datetime.now() - self._cache_timestamp < self.cache_duration:
                return self._svgs_cache
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.base_url}")
                response.raise_for_status()
                svgs = response.json()
                
                # Cache the result
                self._svgs_cache = svgs
                self._cache_timestamp = datetime.now()
                
                return svgs
                
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch SVGL SVGs: {e}")
            # Return cached data if available, otherwise raise
            if self._svgs_cache:
                logger.warning("Using cached SVGs data due to API error")
                return self._svgs_cache
            raise
    
    async def search_collections(
        self,
        query: str = "",
        category: str = "",
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Search SVGL categories as 'collections' with filtering"""
        
        categories = await self.get_categories()
        
        # Filter categories
        filtered = []
        for cat_data in categories:
            category_name = cat_data.get("category", "")
            
            # Apply text search
            if query:
                searchable_text = category_name.lower()
                if query.lower() not in searchable_text:
                    continue
            
            # Apply category filter (exact match)
            if category and category_name.lower() != category.lower():
                continue
                
            # Transform category data to look like a collection
            collection_data = {
                "name": f"{category_name} Icons",
                "category": category_name,
                "total": cat_data.get("total", 0),
                "prefix": category_name.lower().replace(" ", "-"),
                "author": {"name": "SVGL"},
                "license": {"title": "Various"}
            }
            filtered.append(collection_data)
        
        # Apply pagination
        total = len(filtered)
        paginated_items = filtered[offset:offset + limit]
        
        # Convert to dict format matching Iconify structure
        collections_dict = {}
        for item in paginated_items:
            collections_dict[item["prefix"]] = item
        
        return {
            "collections": collections_dict,
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
        """Get icons from a specific SVGL category with pagination"""
        
        # Convert prefix back to category name
        category_name = prefix.replace("-", " ").title()
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Get SVGs by category - SVGL API expects category name as-is from the categories endpoint
                # First, get all categories to find the exact match
                categories = await self.get_categories()
                exact_category = None
                
                for cat_data in categories:
                    cat_name = cat_data.get("category", "")
                    if cat_name.lower() == category_name.lower():
                        exact_category = cat_name
                        break
                
                if not exact_category:
                    raise ValueError(f"Category {category_name} not found")
                
                # Use the exact category name from the API
                category_url = f"{self.base_url}/category/{exact_category}"
                
                response = await client.get(category_url)
                response.raise_for_status()
                svgs_data = response.json()
                
                # Apply search filter if provided
                if search:
                    search_lower = search.lower()
                    svgs_data = [
                        svg for svg in svgs_data
                        if search_lower in svg.get("title", "").lower()
                    ]
                
                # Apply pagination
                total_icons = len(svgs_data)
                start_idx = page * page_size
                end_idx = start_idx + page_size
                page_svgs = svgs_data[start_idx:end_idx]
                
                if not page_svgs:
                    return {
                        "icons": [],
                        "total": total_icons,
                        "page": page,
                        "page_size": page_size,
                        "has_more": end_idx < total_icons,
                        "collection_info": {
                            "name": f"{category_name} Icons",
                            "category": category_name,
                            "total": total_icons
                        }
                    }
                
                # Format icons for frontend
                formatted_icons = []
                
                for svg_data in page_svgs:
                    # Get SVG content directly
                    svg_content = await self._get_svg_content(client, svg_data.get("route"))
                    
                    if svg_content:
                        # Generate icon name from title
                        icon_name = svg_data.get("title", "").lower().replace(" ", "-").replace(".", "")
                        
                        formatted_icons.append({
                            "name": icon_name,
                            "full_name": f"svgl:{icon_name}",
                            "title": svg_data.get("title", ""),
                            "body": self._extract_svg_body(svg_content),
                            "width": 24,  # Default, will be extracted from SVG if available
                            "height": 24,
                            "viewBox": self._extract_viewbox(svg_content),
                            "svg": svg_content,
                            "brand_url": svg_data.get("url"),
                            "category": category_name
                        })
                
                return {
                    "icons": formatted_icons,
                    "total": total_icons,
                    "page": page,
                    "page_size": page_size,
                    "has_more": end_idx < total_icons,
                    "collection_info": {
                        "name": f"{category_name} Icons",
                        "category": category_name,
                        "total": total_icons
                    }
                }
                
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch icons for category {category_name}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error processing category {category_name}: {e}")
            raise
    
    async def _get_svg_content(self, client: httpx.AsyncClient, route) -> Optional[str]:
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
                
            response = await client.get(svg_url)
            response.raise_for_status()
            return response.text
            
        except Exception as e:
            logger.warning(f"Failed to fetch SVG from {route}: {e}")
            return None
    
    def _extract_svg_body(self, svg_content: str) -> str:
        """Extract the body content from an SVG (everything inside <svg> tags)"""
        try:
            import xml.etree.ElementTree as ET
            
            # Parse the SVG
            root = ET.fromstring(svg_content)
            
            # Get all content inside the svg tag
            body_parts = []
            for elem in root:
                body_parts.append(ET.tostring(elem, encoding='unicode'))
            
            return ''.join(body_parts)
            
        except Exception as e:
            logger.warning(f"Failed to extract SVG body: {e}")
            # Fallback: try to extract manually
            try:
                start = svg_content.find('>') + 1
                end = svg_content.rfind('</')
                if start > 0 and end > start:
                    return svg_content[start:end].strip()
            except Exception:
                pass
            return ""
    
    def _extract_viewbox(self, svg_content: str) -> str:
        """Extract viewBox from SVG content"""
        try:
            import xml.etree.ElementTree as ET
            
            root = ET.fromstring(svg_content)
            viewbox = root.get('viewBox')
            
            if viewbox:
                return viewbox
            
            # Fallback: construct from width/height
            width = root.get('width', '24')
            height = root.get('height', '24')
            
            # Clean numeric values
            import re
            width_num = re.sub(r'[^\d.]', '', str(width))
            height_num = re.sub(r'[^\d.]', '', str(height))
            
            return f"0 0 {width_num or '24'} {height_num or '24'}"
            
        except Exception as e:
            logger.warning(f"Failed to extract viewBox: {e}")
            return "0 0 24 24"
    
    async def get_icon_data_for_install(self, category: str, icon_names: List[str]) -> Dict:
        """Get formatted icon data ready for installation"""
        
        try:
            # Get all SVGs for the category
            all_svgs = await self.get_all_svgs()
            category_svgs = []
            
            for svg in all_svgs:
                svg_category = svg.get("category", "")
                # Handle both string and list categories
                if isinstance(svg_category, list):
                    # Check if any category in the list matches
                    if any(cat.lower() == category.lower() for cat in svg_category):
                        category_svgs.append(svg)
                elif isinstance(svg_category, str):
                    # Direct string comparison
                    if svg_category.lower() == category.lower():
                        category_svgs.append(svg)
            
            # Filter by requested icon names
            selected_svgs = []
            for svg_data in category_svgs:
                icon_name = svg_data.get("title", "").lower().replace(" ", "-").replace(".", "")
                if icon_name in icon_names:
                    selected_svgs.append(svg_data)
            
            # Fetch SVG content for selected icons
            formatted_data = {
                "width": 24,
                "height": 24,
                "info": {
                    "name": f"svgl-{category.lower()}",
                    "displayName": f"SVGL {category.title()} Icons",
                    "category": "svgl",
                    "description": f"Brand and logo icons from SVGL - {category} category",
                    "author": "SVGL Community",
                    "license": "Various",
                    "total": len(selected_svgs)
                },
                "icons": {}
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                for svg_data in selected_svgs:
                    icon_name = svg_data.get("title", "").lower().replace(" ", "-").replace(".", "")
                    svg_content = await self._get_svg_content(client, svg_data.get("route"))
                    
                    if svg_content:
                        formatted_data["icons"][icon_name] = {
                            "body": self._extract_svg_body(svg_content),
                            "width": 24,
                            "height": 24,
                            "viewBox": self._extract_viewbox(svg_content)
                        }
            
            return formatted_data
            
        except Exception as e:
            logger.error(f"Failed to format SVGL icon data for installation: {e}")
            raise
    
    async def get_collection_categories(self) -> List[str]:
        """Get unique categories from SVGL"""
        
        categories = await self.get_categories()
        return [cat.get("category", "") for cat in categories if cat.get("category")]

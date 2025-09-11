"""
SVGL category browsing and search functionality
"""
from typing import Dict, List
import logging

from ..base import IconProviderInterface
from .api import SvglApiClient
from .cache import SvglCache
from .svg_processor import SvgProcessor

logger = logging.getLogger(__name__)


class SvglCategoryBrowser(IconProviderInterface):
    """Service for browsing SVGL categories and logos"""
    
    def __init__(self):
        self.api_client = SvglApiClient()
        self.cache = SvglCache()
        self.svg_processor = SvgProcessor()
    
    async def get_categories(self, refresh: bool = False) -> List[Dict]:
        """Get all available SVGL categories with caching"""
        if not refresh:
            cached = self.cache.get_categories()
            if cached:
                return cached
        
        try:
            categories = await self.api_client.get_categories()
            self.cache.set_categories(categories)
            return categories
        except Exception as e:
            # Return cached data if available, otherwise raise
            cached = self.cache.get_categories()
            if cached:
                logger.warning("Using cached categories data due to API error")
                return cached
            raise
    
    async def get_all_svgs(self, refresh: bool = False) -> List[Dict]:
        """Get all available SVGs with caching"""
        if not refresh:
            cached = self.cache.get_svgs()
            if cached:
                return cached
        
        try:
            svgs = await self.api_client.get_all_svgs()
            self.cache.set_svgs(svgs)
            return svgs
        except Exception as e:
            # Return cached data if available, otherwise raise
            cached = self.cache.get_svgs()
            if cached:
                logger.warning("Using cached SVGs data due to API error")
                return cached
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
            # Get all categories to find exact match
            categories = await self.get_categories()
            exact_category = None

            for cat_data in categories:
                cat_name = cat_data.get("category", "")
                if cat_name.lower() == category_name.lower():
                    exact_category = cat_name
                    break

            if not exact_category:
                raise ValueError(f"Category {category_name} not found")

            # Get SVGs for this category
            svgs_data = await self.api_client.get_svgs_by_category(exact_category)

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
            formatted_icons = await self._format_icons(page_svgs, category_name)

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

        except Exception as e:
            logger.error(f"Error processing category {category_name}: {e}")
            raise
    
    async def _format_icons(self, svgs_data: List[Dict], category_name: str) -> List[Dict]:
        """Format SVG data into icon format for frontend"""
        import httpx
        
        formatted_icons = []
        
        async with httpx.AsyncClient(timeout=30) as client:
            for svg_data in svgs_data:
                svg_content = await self.api_client.get_svg_content(client, svg_data.get("route"))

                if svg_content:
                    icon_name = self.svg_processor.generate_icon_name(svg_data.get("title", ""))

                    formatted_icons.append({
                        "name": icon_name,
                        "full_name": f"svgl:{icon_name}",
                        "title": svg_data.get("title", ""),
                        "body": self.svg_processor.extract_body(svg_content),
                        "width": 24,
                        "height": 24,
                        "viewBox": self.svg_processor.extract_viewbox(svg_content),
                        "svg": svg_content,
                        "brand_url": svg_data.get("url"),
                        "category": category_name
                    })
        
        return formatted_icons
    
    async def get_icon_data_for_install(self, prefix: str, icon_names: List[str]) -> Dict:
        """Get formatted icon data ready for installation"""
        # Convert prefix to category name for SVGL
        category = prefix.replace("-", " ").title()
        try:
            # Get all SVGs for the category
            all_svgs = await self.get_all_svgs()
            category_svgs = []

            for svg in all_svgs:
                svg_category = svg.get("category", "")
                # Handle both string and list categories
                if isinstance(svg_category, list):
                    if any(cat.lower() == category.lower() for cat in svg_category):
                        category_svgs.append(svg)
                elif isinstance(svg_category, str):
                    if svg_category.lower() == category.lower():
                        category_svgs.append(svg)

            # Filter by requested icon names
            selected_svgs = []
            for svg_data in category_svgs:
                icon_name = self.svg_processor.generate_icon_name(svg_data.get("title", ""))
                if icon_name in icon_names:
                    selected_svgs.append(svg_data)

            # Format data for installation
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

            # Fetch SVG content and process
            import httpx
            async with httpx.AsyncClient(timeout=30) as client:
                for svg_data in selected_svgs:
                    icon_name = self.svg_processor.generate_icon_name(svg_data.get("title", ""))
                    svg_content = await self.api_client.get_svg_content(client, svg_data.get("route"))

                    if svg_content:
                        formatted_data["icons"][icon_name] = {
                            "body": self.svg_processor.extract_body(svg_content),
                            "width": 24,
                            "height": 24,
                            "viewBox": self.svg_processor.extract_viewbox(svg_content)
                        }

            return formatted_data

        except Exception as e:
            logger.error(f"Failed to format SVGL icon data for installation: {e}")
            raise
    
    async def get_collection_categories(self) -> List[str]:
        """Get unique categories from SVGL"""
        categories = await self.get_categories()
        return [cat.get("category", "") for cat in categories if cat.get("category")]
    
    async def refresh_cache(self) -> None:
        """Refresh cache"""
        self.cache.clear()

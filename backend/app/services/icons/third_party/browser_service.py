"""
Unified browser service for third-party icon providers
"""
from typing import Dict, List, Optional

from .base import ThirdPartySource
from .iconify.collections import IconifyCollectionBrowser
from .svgl.categories import SvglCategoryBrowser


class ThirdPartyBrowserService:
    """Unified service for browsing icons from multiple third-party sources"""
    
    def __init__(self):
        self.iconify_browser = IconifyCollectionBrowser()
        self.svgl_browser = SvglCategoryBrowser()
        self._browsers = {
            ThirdPartySource.ICONIFY: self.iconify_browser,
            ThirdPartySource.SVGL: self.svgl_browser
        }
    
    def _get_browser(self, source: ThirdPartySource):
        """Get the appropriate browser for the given source"""
        browser = self._browsers.get(source)
        if not browser:
            raise ValueError(f"Unsupported source: {source}")
        return browser
    
    async def get_available_sources(self) -> List[Dict]:
        """Get information about all available sources"""
        return [
            {
                "id": ThirdPartySource.ICONIFY,
                "name": "Iconify",
                "description": "Comprehensive icon framework with 200,000+ icons from 150+ icon sets",
                "type": "icons",
                "website": "https://iconify.design"
            },
            {
                "id": ThirdPartySource.SVGL,
                "name": "SVGL",
                "description": "Beautiful SVG logos and brands for popular companies and technologies",
                "type": "logos",
                "website": "https://svgl.app"
            }
        ]
    
    async def search_collections(
        self,
        source: ThirdPartySource,
        query: str = "",
        category: str = "",
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Search collections from the specified source"""
        browser = self._get_browser(source)
        result = await browser.search_collections(query, category, limit, offset)
        
        # Add source information to the result
        result["source"] = source
        return result
    
    async def get_collection_icons(
        self,
        source: ThirdPartySource,
        prefix: str,
        page: int = 0,
        page_size: int = 50,
        search: str = ""
    ) -> Dict:
        """Get icons from a specific collection"""
        browser = self._get_browser(source)
        result = await browser.get_collection_icons(prefix, page, page_size, search)
        
        # Add source information to the result
        result["source"] = source
        return result
    
    async def get_icon_data_for_install(
        self,
        source: ThirdPartySource,
        prefix: str,
        icon_names: List[str]
    ) -> Dict:
        """Get formatted icon data ready for installation"""
        browser = self._get_browser(source)
        result = await browser.get_icon_data_for_install(prefix, icon_names)
        
        # Ensure source is reflected in the pack info
        result["info"]["source"] = source
        return result
    
    async def get_collection_categories(self, source: ThirdPartySource) -> List[str]:
        """Get unique categories from the specified source"""
        browser = self._get_browser(source)
        return await browser.get_collection_categories()
    
    async def refresh_cache(self, source: Optional[ThirdPartySource] = None):
        """Refresh cache for specified source or all sources"""
        if source:
            browser = self._get_browser(source)
            await browser.refresh_cache()
        else:
            # Refresh all sources
            for source_enum in ThirdPartySource:
                await self.refresh_cache(source_enum)

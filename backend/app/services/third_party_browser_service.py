"""
Third-Party Browser Service
Unified service for browsing and installing icons from multiple sources (Iconify, SVGL, etc.)
"""
from typing import Dict, List, Optional
from enum import Enum

from .iconify_browser_service import IconifyBrowserService
from .svgl_browser_service import SvglBrowserService


class ThirdPartySource(str, Enum):
    """Available third-party icon sources"""
    ICONIFY = "iconify"
    SVGL = "svgl"


class ThirdPartyBrowserService:
    """Unified service for browsing icons from multiple third-party sources"""
    
    def __init__(self):
        self.iconify_service = IconifyBrowserService()
        self.svgl_service = SvglBrowserService()
        self._services = {
            ThirdPartySource.ICONIFY: self.iconify_service,
            ThirdPartySource.SVGL: self.svgl_service
        }
    
    def _get_service(self, source: ThirdPartySource):
        """Get the appropriate service for the given source"""
        service = self._services.get(source)
        if not service:
            raise ValueError(f"Unsupported source: {source}")
        return service
    
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
        service = self._get_service(source)
        result = await service.search_collections(query, category, limit, offset)
        
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
        service = self._get_service(source)
        result = await service.get_collection_icons(prefix, page, page_size, search)
        
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
        service = self._get_service(source)
        
        # Handle different parameter requirements for different services
        if source == ThirdPartySource.ICONIFY:
            result = await service.get_icon_data_for_install(prefix, icon_names)
        elif source == ThirdPartySource.SVGL:
            # SVGL uses category instead of prefix
            result = await service.get_icon_data_for_install(prefix, icon_names)
        else:
            raise ValueError(f"Unsupported source: {source}")
        
        # Ensure source is reflected in the pack info
        result["info"]["source"] = source
        return result
    
    async def get_collection_categories(self, source: ThirdPartySource) -> List[str]:
        """Get unique categories from the specified source"""
        service = self._get_service(source)
        return await service.get_collection_categories()
    
    async def refresh_cache(self, source: Optional[ThirdPartySource] = None):
        """Refresh cache for specified source or all sources"""
        if source:
            service = self._get_service(source)
            if hasattr(service, 'get_collections'):
                await service.get_collections(refresh=True)
            elif hasattr(service, 'get_categories'):
                await service.get_categories(refresh=True)
        else:
            # Refresh all sources
            for source_enum in ThirdPartySource:
                await self.refresh_cache(source_enum)

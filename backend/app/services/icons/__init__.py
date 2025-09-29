"""Main unified icon service that combines all specialized services."""
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.icon_schemas import (
    IconSearchRequest,
    IconSearchResponse,
    IconMetadataResponse,
    IconPackResponse,
)

from .base import BaseIconService
from .cache import IconCache
from .installer import IconPackInstaller
from .metadata import IconMetadataService
from .search import IconSearchService
from .pack_management import IconPackService
from .svg import IconSVGService
from .statistics import IconStatisticsService
from .creation import IconCreationService
from .realtime_analysis import RealtimeDocumentAnalyzer


class IconService(BaseIconService):
    """Unified icon service that delegates to specialized services."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the unified icon service."""
        super().__init__(db_session)

        # Initialize specialized services
        self._metadata_service = IconMetadataService(db_session)
        self._search_service = IconSearchService(db_session)
        self._pack_service = IconPackService(db_session)
        self._svg_service = IconSVGService(db_session)
        self._statistics_service = IconStatisticsService(db_session)
        self._creation_service = IconCreationService(db_session)
        self._realtime_analyzer = RealtimeDocumentAnalyzer(db_session)

    # Metadata operations
    async def get_icon_metadata(self, pack_name: str, key: str) -> Optional[IconMetadataResponse]:
        """Get metadata for a specific icon by pack name and key."""
        return await self._metadata_service.get_icon_metadata(pack_name, key)

    async def get_icon_by_id(self, icon_id: int) -> Optional[IconMetadataResponse]:
        """Get icon metadata by ID."""
        return await self._metadata_service.get_icon_by_id(icon_id)

    async def update_icon_metadata(self, icon_id: int, metadata: Dict[str, Any]) -> Optional[IconMetadataResponse]:
        """Update metadata for a specific icon."""
        return await self._metadata_service.update_icon_metadata(icon_id, metadata)

    async def delete_icon(self, icon_id: int) -> bool:
        """Delete an icon by ID."""
        return await self._metadata_service.delete_icon(icon_id)

    async def batch_get_icons(self, icon_keys: List[str]) -> Tuple[List[IconMetadataResponse], List[str]]:
        """Get multiple icons by their full keys."""
        return await self._metadata_service.batch_get_icons(icon_keys)

    # Search operations
    async def search_icons(self, search_request: IconSearchRequest) -> IconSearchResponse:
        """Search for icons based on the given criteria."""
        return await self._search_service.search_icons(search_request)

    # Pack management operations
    async def get_icon_packs(self) -> List[IconPackResponse]:
        """Get all icon packs with their icon counts."""
        return await self._pack_service.get_icon_packs()

    async def install_icon_pack(
        self,
        pack_name: str,
        display_name: str,
        category: str,
        description: Optional[str] = None
    ) -> IconPackResponse:
        """Create a new icon pack."""
        return await self._pack_service.install_icon_pack(pack_name, display_name, category, description)

    async def update_icon_pack(
        self,
        pack_name: str,
        display_name: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[IconPackResponse]:
        """Update an existing icon pack."""
        return await self._pack_service.update_icon_pack(pack_name, display_name, category, description)

    async def delete_icon_pack(self, pack_name: str) -> bool:
        """Delete an icon pack and all its icons."""
        return await self._pack_service.delete_icon_pack(pack_name)

    async def get_pack_icon_count(self, pack_id: int) -> int:
        """Get the count of icons in a pack using simple SQL."""
        return await self._pack_service.get_pack_icon_count(pack_id)

    # SVG operations
    async def get_icon_svg(self, pack_name: str, key: str) -> Optional[str]:
        """Get SVG content for an icon."""
        return await self._svg_service.get_icon_svg(pack_name, key)

    async def track_usage(self, pack_name: str, key: str, user_id: Optional[int] = None) -> None:
        """Track usage of an icon."""
        return await self._svg_service.track_usage(pack_name, key, user_id)

    # Statistics operations
    async def get_pack_statistics(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get comprehensive icon pack statistics with optional document analysis."""
        return await self._statistics_service.get_pack_statistics(user_id)

    async def get_pack_document_usage(self, pack_name: str, user_id: int) -> Dict[str, Any]:
        """Get detailed document usage statistics for a specific pack."""
        return await self._statistics_service.get_pack_document_usage(pack_name, user_id)

    async def get_document_icon_analysis(self, document_id: int, user_id: int) -> Dict[str, Any]:
        """Analyze icon usage in a specific document."""
        return await self._statistics_service.get_document_icon_analysis(document_id, user_id)

    async def get_usage_trends(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """Get icon usage trends over time."""
        return await self._statistics_service.get_usage_trends(user_id, days)

    async def warm_cache(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Warm the cache with popular icons from API usage and document analysis."""
        return await self._statistics_service.warm_cache(user_id)

    async def health_check(self) -> Dict[str, Any]:
        """Perform a health check on the icon service."""
        return await self._statistics_service.health_check()

    # Cache management operations
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache performance statistics."""
        return self.cache.get_cache_stats()

    def get_pack_cache_info(self, pack_name: str) -> Dict[str, Any]:
        """Get cache information for a specific pack."""
        return self.cache.get_pack_cache_info(pack_name)

    def get_expired_entries(self) -> Dict[str, Any]:
        """Get information about expired cache entries."""
        return self.cache.get_expired_entries()

    def cleanup_expired_entries(self) -> int:
        """Remove expired entries from cache and return count of removed entries."""
        return self.cache.cleanup_expired_entries()

    def invalidate_pack_cache(self, pack_name: str) -> int:
        """Invalidate cache entries for a specific pack."""
        return self.cache.invalidate_pack(pack_name)

    def clear_all_cache(self) -> None:
        """Clear all cache entries."""
        return self.cache.clear_all()

    # Real-time analysis operations (Phase 4)
    async def analyze_document_realtime(self, document_id: int, user_id: int) -> Dict[str, Any]:
        """Perform real-time analysis of a single document."""
        return await self._realtime_analyzer.analyze_document_realtime(document_id, user_id)

    async def get_usage_trends_realtime(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """Get real-time usage trends for the user over a specified period."""
        return await self._realtime_analyzer.get_usage_trends_realtime(user_id, days)

    async def warm_analysis_cache(self, user_id: int, document_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """Warm the analysis cache for frequently accessed documents."""
        return await self._realtime_analyzer.warm_analysis_cache(user_id, document_ids)

    async def clear_analysis_cache(self) -> int:
        """Clear the real-time analysis cache."""
        return await self._realtime_analyzer.clear_cache()

    # Creation operations
    async def add_icon_to_pack(
        self,
        pack_name: str,
        key: str,
        search_terms: str,
        icon_data: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None
    ) -> Optional[IconMetadataResponse]:
        """Add a new icon to an existing pack."""
        return await self._creation_service.add_icon_to_pack(
            pack_name, key, search_terms, icon_data, file_path
        )

"""
Base classes and interfaces for third-party icon providers
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from enum import Enum


class ThirdPartySource(str, Enum):
    """Available third-party icon sources"""
    ICONIFY = "iconify"
    SVGL = "svgl"


class IconProviderInterface(ABC):
    """Abstract interface for third-party icon providers"""
    
    @abstractmethod
    async def search_collections(
        self,
        query: str = "",
        category: str = "",
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Search collections/categories with filtering"""
        pass
    
    @abstractmethod
    async def get_collection_icons(
        self,
        prefix: str,
        page: int = 0,
        page_size: int = 50,
        search: str = ""
    ) -> Dict:
        """Get icons from a specific collection with pagination"""
        pass
    
    @abstractmethod
    async def get_icon_data_for_install(
        self,
        prefix: str,
        icon_names: List[str]
    ) -> Dict:
        """Get formatted icon data ready for installation"""
        pass
    
    @abstractmethod
    async def get_collection_categories(self) -> List[str]:
        """Get unique categories from the provider"""
        pass
    
    @abstractmethod
    async def refresh_cache(self) -> None:
        """Refresh provider's cache"""
        pass


class BaseIconProvider(IconProviderInterface):
    """Base class with common functionality for icon providers"""
    
    def __init__(self, base_url: str, cache_duration_hours: int = 24):
        self.base_url = base_url
        self.cache_duration_hours = cache_duration_hours
        self._cache = {}
        self._cache_timestamps = {}
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cache entry is still valid"""
        from datetime import datetime, timedelta
        
        if key not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[key]
        max_age = timedelta(hours=self.cache_duration_hours)
        return datetime.now() - cache_time < max_age
    
    def _get_from_cache(self, key: str):
        """Get data from cache if valid"""
        if self._is_cache_valid(key):
            return self._cache.get(key)
        return None
    
    def _set_cache(self, key: str, data):
        """Set data in cache with timestamp"""
        from datetime import datetime
        
        self._cache[key] = data
        self._cache_timestamps[key] = datetime.now()
    
    async def refresh_cache(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()
        self._cache_timestamps.clear()

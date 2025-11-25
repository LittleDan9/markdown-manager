"""
Iconify caching functionality
"""
from datetime import datetime, timedelta
from typing import Dict, Optional


class IconifyCache:
    """Cache manager for Iconify data"""
    
    def __init__(self, cache_duration_hours: int = 24):
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self._collections_cache = None
        self._cache_timestamp = None
    
    def is_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._cache_timestamp:
            return False
        return datetime.now() - self._cache_timestamp < self.cache_duration
    
    def get_collections(self) -> Optional[Dict]:
        """Get cached collections if valid"""
        if self.is_valid():
            return self._collections_cache
        return None
    
    def set_collections(self, collections: Dict) -> None:
        """Cache collections data"""
        self._collections_cache = collections
        self._cache_timestamp = datetime.now()
    
    def clear(self) -> None:
        """Clear all cached data"""
        self._collections_cache = None
        self._cache_timestamp = None

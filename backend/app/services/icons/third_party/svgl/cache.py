"""
SVGL caching functionality
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class SvglCache:
    """Cache manager for SVGL data"""
    
    def __init__(self, cache_duration_hours: int = 6):
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self._categories_cache = None
        self._svgs_cache = None
        self._cache_timestamp = None
    
    def is_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._cache_timestamp:
            return False
        return datetime.now() - self._cache_timestamp < self.cache_duration
    
    def get_categories(self) -> Optional[List[Dict]]:
        """Get cached categories if valid"""
        if self.is_valid():
            return self._categories_cache
        return None
    
    def set_categories(self, categories: List[Dict]) -> None:
        """Cache categories data"""
        self._categories_cache = categories
        self._cache_timestamp = datetime.now()
    
    def get_svgs(self) -> Optional[List[Dict]]:
        """Get cached SVGs if valid"""
        if self.is_valid():
            return self._svgs_cache
        return None
    
    def set_svgs(self, svgs: List[Dict]) -> None:
        """Cache SVGs data"""
        self._svgs_cache = svgs
        self._cache_timestamp = datetime.now()
    
    def clear(self) -> None:
        """Clear all cached data"""
        self._categories_cache = None
        self._svgs_cache = None
        self._cache_timestamp = None

"""Icon cache service with LRU and TTL-based caching."""
import time
from typing import Any, Dict, Optional, Tuple
from dataclasses import dataclass
from threading import Lock

from app.schemas.icon_schemas import IconMetadataResponse


@dataclass
class CacheStats:
    """Cache statistics for monitoring."""
    metadata_hits: int = 0
    metadata_misses: int = 0
    svg_hits: int = 0
    svg_misses: int = 0
    metadata_size: int = 0
    svg_size: int = 0

    @property
    def metadata_hit_ratio(self) -> float:
        """Calculate metadata cache hit ratio."""
        total = self.metadata_hits + self.metadata_misses
        return self.metadata_hits / total if total > 0 else 0.0

    @property
    def svg_hit_ratio(self) -> float:
        """Calculate SVG cache hit ratio."""
        total = self.svg_hits + self.svg_misses
        return self.svg_hits / total if total > 0 else 0.0


@dataclass
class CacheEntry:
    """Cache entry with timestamp for TTL."""
    value: Any
    timestamp: float
    access_count: int = 0

    def is_expired(self, ttl_seconds: int) -> bool:
        """Check if entry is expired based on TTL."""
        return time.time() - self.timestamp > ttl_seconds

    def touch(self) -> None:
        """Update access count and timestamp."""
        self.access_count += 1
        self.timestamp = time.time()


class LRUCache:
    """Thread-safe LRU cache implementation."""

    def __init__(self, max_size: int):
        """Initialize LRU cache with maximum size."""
        self.max_size = max_size
        self.cache: Dict[str, CacheEntry] = {}
        self.access_order: list[str] = []
        self.lock = Lock()

    def get(self, key: str, ttl_seconds: Optional[int] = None) -> Optional[Any]:
        """Get value from cache, checking TTL if specified."""
        with self.lock:
            if key not in self.cache:
                return None

            entry = self.cache[key]

            # Check TTL if specified
            if ttl_seconds and entry.is_expired(ttl_seconds):
                self._remove_key(key)
                return None

            # Update access order (move to end)
            self.access_order.remove(key)
            self.access_order.append(key)
            entry.touch()

            return entry.value

    def put(self, key: str, value: Any) -> None:
        """Put value in cache, evicting LRU items if necessary."""
        with self.lock:
            # If key exists, update it
            if key in self.cache:
                self.cache[key].value = value
                self.cache[key].touch()
                # Move to end of access order
                self.access_order.remove(key)
                self.access_order.append(key)
                return

            # If at capacity, evict LRU item
            if len(self.cache) >= self.max_size:
                lru_key = self.access_order.pop(0)
                del self.cache[lru_key]

            # Add new entry
            self.cache[key] = CacheEntry(value=value, timestamp=time.time())
            self.access_order.append(key)

    def remove(self, key: str) -> bool:
        """Remove key from cache."""
        with self.lock:
            return self._remove_key(key)

    def _remove_key(self, key: str) -> bool:
        """Internal method to remove key (assumes lock is held)."""
        if key in self.cache:
            del self.cache[key]
            self.access_order.remove(key)
            return True
        return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self.lock:
            self.cache.clear()
            self.access_order.clear()

    def size(self) -> int:
        """Get current cache size."""
        with self.lock:
            return len(self.cache)

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self.lock:
            total_accesses = sum(entry.access_count for entry in self.cache.values())
            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "total_accesses": total_accesses,
                "keys": list(self.cache.keys()),
            }


class IconCache:
    """Icon cache service with metadata and SVG caching."""

    def __init__(
        self,
        metadata_cache_size: int = 1000,
        svg_cache_size: int = 500,
        svg_ttl_seconds: int = 3600,  # 1 hour
    ):
        """Initialize icon cache with configurable sizes and TTL."""
        self.metadata_cache = LRUCache(metadata_cache_size)
        self.svg_cache = LRUCache(svg_cache_size)
        self.svg_ttl_seconds = svg_ttl_seconds
        self.stats = CacheStats()
        self.lock = Lock()

    def get_icon_metadata(self, full_key: str) -> Optional[IconMetadataResponse]:
        """Get icon metadata from cache."""
        cached_metadata = self.metadata_cache.get(full_key)

        with self.lock:
            if cached_metadata:
                self.stats.metadata_hits += 1
                return cached_metadata
            else:
                self.stats.metadata_misses += 1
                return None

    def put_icon_metadata(self, full_key: str, metadata: IconMetadataResponse) -> None:
        """Put icon metadata in cache."""
        self.metadata_cache.put(full_key, metadata)
        with self.lock:
            self.stats.metadata_size = self.metadata_cache.size()

    def get_icon_svg(self, full_key: str) -> Optional[str]:
        """Get SVG content from cache."""
        svg_key = f"svg:{full_key}"
        cached_svg = self.svg_cache.get(svg_key, self.svg_ttl_seconds)

        with self.lock:
            if cached_svg:
                self.stats.svg_hits += 1
                return cached_svg
            else:
                self.stats.svg_misses += 1
                return None

    def put_icon_svg(self, full_key: str, svg_content: str) -> None:
        """Put SVG content in cache."""
        svg_key = f"svg:{full_key}"
        self.svg_cache.put(svg_key, svg_content)
        with self.lock:
            self.stats.svg_size = self.svg_cache.size()

    def invalidate_pack(self, pack_name: str) -> int:
        """Invalidate all cache entries for a specific pack."""
        invalidated_count = 0

        # Get all keys that start with pack name
        metadata_keys_to_remove = []
        svg_keys_to_remove = []

        # Check metadata cache
        with self.metadata_cache.lock:
            for key in list(self.metadata_cache.cache.keys()):
                if key.startswith(f"{pack_name}:"):
                    metadata_keys_to_remove.append(key)

        # Check SVG cache
        with self.svg_cache.lock:
            for key in list(self.svg_cache.cache.keys()):
                if key.startswith(f"svg:{pack_name}:"):
                    svg_keys_to_remove.append(key)

        # Remove keys
        for key in metadata_keys_to_remove:
            if self.metadata_cache.remove(key):
                invalidated_count += 1

        for key in svg_keys_to_remove:
            if self.svg_cache.remove(key):
                invalidated_count += 1

        # Update stats
        with self.lock:
            self.stats.metadata_size = self.metadata_cache.size()
            self.stats.svg_size = self.svg_cache.size()

        return invalidated_count

    def clear_all(self) -> None:
        """Clear all cache entries."""
        self.metadata_cache.clear()
        self.svg_cache.clear()
        with self.lock:
            self.stats = CacheStats()

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        with self.lock:
            return {
                "metadata": {
                    "hits": self.stats.metadata_hits,
                    "misses": self.stats.metadata_misses,
                    "hit_ratio": self.stats.metadata_hit_ratio,
                    "size": self.stats.metadata_size,
                    "max_size": self.metadata_cache.max_size,
                },
                "svg": {
                    "hits": self.stats.svg_hits,
                    "misses": self.stats.svg_misses,
                    "hit_ratio": self.stats.svg_hit_ratio,
                    "size": self.stats.svg_size,
                    "max_size": self.svg_cache.max_size,
                    "ttl_seconds": self.svg_ttl_seconds,
                },
                "memory_estimate_mb": self._estimate_memory_usage(),
            }

    def _estimate_memory_usage(self) -> float:
        """Estimate memory usage in MB (rough calculation)."""
        # Rough estimate: each metadata entry ~1KB, each SVG ~2KB
        metadata_mb = (self.stats.metadata_size * 1024) / (1024 * 1024)
        svg_mb = (self.stats.svg_size * 2048) / (1024 * 1024)
        return round(metadata_mb + svg_mb, 2)

    def warm_cache(self, popular_icons: list[Tuple[str, IconMetadataResponse, Optional[str]]]) -> int:
        """Warm cache with popular icons."""
        warmed_count = 0

        for full_key, metadata, svg_content in popular_icons:
            self.put_icon_metadata(full_key, metadata)
            if svg_content:
                self.put_icon_svg(full_key, svg_content)
            warmed_count += 1

        return warmed_count


# Global cache instance
_icon_cache: Optional[IconCache] = None


def get_icon_cache() -> IconCache:
    """Get or create global icon cache instance."""
    global _icon_cache
    if _icon_cache is None:
        _icon_cache = IconCache()
    return _icon_cache


def reset_icon_cache() -> None:
    """Reset global cache instance (useful for testing)."""
    global _icon_cache
    _icon_cache = None

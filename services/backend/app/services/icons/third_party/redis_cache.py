"""
Redis-backed cache for third-party icon provider data.

Falls back to in-memory cache when Redis is unavailable so the system
degrades gracefully instead of crashing.
"""
import json
import logging
from datetime import timedelta
from typing import Any, Optional

import redis.asyncio as aioredis

from app.configs import settings

logger = logging.getLogger(__name__)

# Default TTLs
TTL_COLLECTIONS = timedelta(hours=24)
TTL_ICON_DATA = timedelta(hours=1)
TTL_CATEGORIES = timedelta(hours=6)

_KEY_PREFIX = "icons:tp:"


class ThirdPartyCache:
    """Redis-first cache with in-memory fallback for third-party icon data."""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._redis_available: Optional[bool] = None
        # In-memory fallback (mirrors the old behaviour)
        self._mem: dict[str, Any] = {}

    # -- Redis connection (lazy) -------------------------------------------

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        if self._redis_available is False:
            return None
        if self._redis is not None:
            return self._redis
        try:
            self._redis = aioredis.from_url(
                settings.redis_url, decode_responses=True,
            )
            await self._redis.ping()
            self._redis_available = True
            return self._redis
        except Exception:
            logger.warning("Redis unavailable — icon cache falling back to in-memory")
            self._redis_available = False
            return None

    # -- public API --------------------------------------------------------

    async def get(self, key: str) -> Optional[Any]:
        """Return cached value or ``None``."""
        full_key = f"{_KEY_PREFIX}{key}"
        r = await self._get_redis()
        if r is not None:
            try:
                raw = await r.get(full_key)
                if raw is not None:
                    return json.loads(raw)
            except Exception:
                logger.debug("Redis GET failed for %s, falling back to memory", key)
        return self._mem.get(full_key)

    async def set(self, key: str, value: Any, ttl: timedelta = TTL_COLLECTIONS) -> None:
        """Store a JSON-serialisable value."""
        full_key = f"{_KEY_PREFIX}{key}"
        serialised = json.dumps(value)
        # Always keep an in-memory copy as fallback
        self._mem[full_key] = value
        r = await self._get_redis()
        if r is not None:
            try:
                await r.set(full_key, serialised, ex=int(ttl.total_seconds()))
            except Exception:
                logger.debug("Redis SET failed for %s", key)

    async def delete(self, key: str) -> None:
        full_key = f"{_KEY_PREFIX}{key}"
        self._mem.pop(full_key, None)
        r = await self._get_redis()
        if r is not None:
            try:
                await r.delete(full_key)
            except Exception:
                pass

    async def clear_prefix(self, prefix: str) -> None:
        """Delete all keys matching ``icons:tp:{prefix}*``."""
        pattern = f"{_KEY_PREFIX}{prefix}*"
        # Clear memory
        to_del = [k for k in self._mem if k.startswith(f"{_KEY_PREFIX}{prefix}")]
        for k in to_del:
            del self._mem[k]
        # Clear Redis
        r = await self._get_redis()
        if r is not None:
            try:
                cursor = 0
                while True:
                    cursor, keys = await r.scan(cursor, match=pattern, count=100)
                    if keys:
                        await r.delete(*keys)
                    if cursor == 0:
                        break
            except Exception:
                logger.debug("Redis SCAN/DELETE failed for pattern %s", pattern)

    async def clear_all(self) -> None:
        self._mem.clear()
        await self.clear_prefix("")


# Module-level singleton — shared across the browser service and providers
cache = ThirdPartyCache()

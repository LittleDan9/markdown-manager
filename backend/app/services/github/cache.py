"""GitHub API caching and rate limiting service."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from .base import BaseGitHubService


class GitHubCacheService(BaseGitHubService):
    """Service for caching GitHub API responses and managing rate limits."""

    def __init__(self):
        """Initialize cache service."""
        super().__init__()
        
        # For now, use in-memory cache since Redis may not be available
        self._cache = {}  # type: Dict[str, Dict[str, Any]]
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0
        }
        self.cache_ttl = {
            'repositories': 300,      # 5 minutes
            'branches': 600,          # 10 minutes
            'file_content': 1800,     # 30 minutes
            'file_list': 300,         # 5 minutes
            'rate_limit': 60,         # 1 minute
            'user_info': 3600,        # 1 hour
        }

    async def get_cached(self, key: str) -> Optional[Any]:
        """Get cached data."""
        if key in self._cache:
            entry = self._cache[key]
            if datetime.utcnow() < datetime.fromisoformat(entry['expires']):
                self._stats['hits'] += 1
                return entry['data']
            else:
                # Expired, remove from cache
                del self._cache[key]
        
        self._stats['misses'] += 1
        return None

    async def set_cached(self, key: str, data: Any, ttl: int = 300) -> None:
        """Set cached data."""
        expires = (datetime.utcnow().timestamp() + ttl)
        self._cache[key] = {
            'data': data,
            'expires': datetime.fromtimestamp(expires).isoformat()
        }
        self._stats['sets'] += 1

    async def check_rate_limit(self, account_id: int) -> bool:
        """Check if account has exceeded rate limits."""
        key = f"github_rate_limit:{account_id}"
        rate_data = await self.get_cached(key)

        if not rate_data:
            return True  # No rate limit data, allow request

        current_time = datetime.utcnow()
        reset_time = datetime.fromisoformat(rate_data.get('reset_time', ''))

        if current_time > reset_time:
            return True  # Rate limit window has reset

        remaining = rate_data.get('remaining', 0)
        return remaining > 0

    async def update_rate_limit(
        self,
        account_id: int,
        remaining: int,
        reset_time: datetime
    ) -> None:
        """Update rate limit information."""
        key = f"github_rate_limit:{account_id}"
        rate_data = {
            'remaining': remaining,
            'reset_time': reset_time.isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        await self.set_cached(key, rate_data, self.cache_ttl['rate_limit'])

    def generate_cache_key(self, prefix: str, *args) -> str:
        """Generate a cache key."""
        key_parts = [prefix] + [str(arg) for arg in args]
        return ":".join(key_parts)

    async def get_or_fetch_repositories(
        self,
        account_id: int,
        fetch_func,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Get repositories from cache or fetch from API."""
        cache_key = self.generate_cache_key("github_repos", account_id)

        if not force_refresh:
            cached = await self.get_cached(cache_key)
            if cached and isinstance(cached, list):
                return cached

        # Check rate limit before making API call
        if not await self.check_rate_limit(account_id):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GitHub API rate limit exceeded"
            )

        # Fetch from API
        repositories = await fetch_func()

        # Cache the result
        await self.set_cached(
            cache_key,
            repositories,
            self.cache_ttl['repositories']
        )

        return repositories

    async def get_or_fetch_file_list(
        self,
        repo_id: int,
        path: str,
        branch: str,
        fetch_func,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Get file list from cache or fetch from API."""
        cache_key = self.generate_cache_key("github_files", repo_id, path, branch)

        if not force_refresh:
            cached = await self.get_cached(cache_key)
            if cached and isinstance(cached, list):
                return cached

        # Fetch from API
        files = await fetch_func()

        # Cache the result
        await self.set_cached(cache_key, files, self.cache_ttl['file_list'])

        return files

    async def get_or_fetch_file_content(
        self,
        repo_id: int,
        file_path: str,
        branch: str,
        fetch_func,
        force_refresh: bool = False
    ) -> dict:
        """Get file content from cache or fetch from API."""
        cache_key = self.generate_cache_key("github_file", repo_id, file_path, branch)

        if not force_refresh:
            cached = await self.get_cached(cache_key)
            if cached and isinstance(cached, dict):
                return cached

        # Fetch from API
        file_content = await fetch_func()

        # Cache the result
        await self.set_cached(cache_key, file_content, self.cache_ttl['file_content'])

        return file_content

    async def get_or_fetch_user_info(
        self,
        account_id: int,
        fetch_func,
        force_refresh: bool = False
    ) -> dict:
        """Get user info from cache or fetch from API."""
        cache_key = self.generate_cache_key("github_user", account_id)

        if not force_refresh:
            cached = await self.get_cached(cache_key)
            if cached and isinstance(cached, dict):
                return cached

        # Fetch from API
        user_info = await fetch_func()

        # Cache the result
        await self.set_cached(cache_key, user_info, self.cache_ttl['user_info'])

        return user_info

    async def get_or_fetch_repository_info(
        self,
        repo_id: int,
        fetch_func,
        force_refresh: bool = False
    ) -> dict:
        """Get repository metadata from cache or fetch from API."""
        cache_key = self.generate_cache_key("github_repo_info", repo_id)

        if not force_refresh:
            cached = await self.get_cached(cache_key)
            if cached and isinstance(cached, dict):
                return cached

        # Fetch from API
        repo_info = await fetch_func()

        # Cache the result
        await self.set_cached(cache_key, repo_info, self.cache_ttl['repositories'])

        return repo_info

    async def invalidate_repository_cache(self, account_id: int) -> None:
        """Invalidate repository cache for an account."""
        cache_key = self.generate_cache_key("github_repos", account_id)
        if cache_key in self._cache:
            del self._cache[cache_key]

    async def invalidate_file_cache(
        self,
        repo_id: int,
        file_path: Optional[str] = None,
        branch: Optional[str] = None
    ) -> None:
        """Invalidate file-related cache entries."""
        # Invalidate specific file if path/branch provided
        if file_path and branch:
            file_key = self.generate_cache_key("github_file", repo_id, file_path, branch)
            if file_key in self._cache:
                del self._cache[file_key]
        
        # Invalidate all file listings for this repo
        keys_to_remove = []
        for key in self._cache.keys():
            if key.startswith(f"github_files:{repo_id}:") or key.startswith(f"github_file:{repo_id}:"):
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._cache[key]

    async def invalidate_branch_cache(self, repo_id: int) -> None:
        """Invalidate branch cache for a repository."""
        cache_key = self.generate_cache_key("github_branches", repo_id)
        if cache_key in self._cache:
            del self._cache[cache_key]

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        current_time = datetime.utcnow()
        active_keys = 0
        expired_keys = 0
        
        for key, entry in self._cache.items():
            if current_time < datetime.fromisoformat(entry['expires']):
                active_keys += 1
            else:
                expired_keys += 1
        
        github_keys = sum(1 for key in self._cache.keys() if key.startswith("github_"))
        
        total_requests = self._stats['hits'] + self._stats['misses']
        hit_rate = round((self._stats['hits'] / total_requests * 100), 2) if total_requests > 0 else 0.0
        
        return {
            "status": "active",
            "backend": "in-memory",
            "total_keys": len(self._cache),
            "active_keys": active_keys,
            "expired_keys": expired_keys,
            "github_keys": github_keys,
            "hits": self._stats['hits'],
            "misses": self._stats['misses'],
            "sets": self._stats['sets'],
            "hit_rate": hit_rate
        }

    async def clear_all_cache(self) -> bool:
        """Clear all GitHub-related cache entries."""
        try:
            keys_to_remove = [key for key in self._cache.keys() if key.startswith("github_")]
            for key in keys_to_remove:
                del self._cache[key]
            return True
        except Exception as e:
            print(f"Cache clear error: {e}")
            return False


# Global cache service instance
github_cache_service = GitHubCacheService()

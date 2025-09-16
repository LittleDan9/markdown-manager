"""Main unified GitHub service that combines all specialized services."""
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from .base import BaseGitHubService
from .auth import GitHubAuthService
from .api import GitHubAPIService
from .cache import GitHubCacheService
from .sync import GitHubSyncService
from .importer import GitHubImportService
from .background import GitHubBackgroundService
from .pull_requests import GitHubPRService
from .filesystem import GitHubFilesystemService


class GitHubService(BaseGitHubService):
    """Unified GitHub service that delegates to specialized services."""

    def __init__(self, db_session: Optional["AsyncSession"] = None):
        """Initialize the unified GitHub service."""
        super().__init__(db_session)

        # Initialize specialized services
        self._auth_service = GitHubAuthService()
        self._api_service = GitHubAPIService()
        self._cache_service = GitHubCacheService()
        self._sync_service = GitHubSyncService()
        if db_session:
            self._import_service = GitHubImportService(db_session)
        self._background_service = GitHubBackgroundService()
        self._pr_service = GitHubPRService()
        self._filesystem_service = GitHubFilesystemService()

    # Authentication operations
    def get_authorization_url(self, state: str) -> str:
        """Get OAuth authorization URL with forced account selection."""
        return self._auth_service.get_authorization_url(state)

    def get_logout_url(self) -> str:
        """Get GitHub logout URL to clear existing session."""
        return self._auth_service.get_logout_url()

    def get_authorization_url_with_logout(self, state: str) -> Dict[str, str]:
        """Get both logout and authorization URLs for account switching."""
        return self._auth_service.get_authorization_url_with_logout(state)

    async def exchange_code_for_token(self, code: str, state: str) -> Dict[str, Any]:
        """Exchange OAuth code for access token."""
        return await self._auth_service.exchange_code_for_token(code, state)

    async def validate_token(self, access_token: str) -> bool:
        """Validate if access token is still valid."""
        return await self._auth_service.validate_token(access_token)

    # API operations
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get authenticated user information."""
        return await self._api_service.get_user_info(access_token)

    async def get_user_repositories(
        self,
        access_token: str,
        page: int = 1,
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get user's repositories."""
        return await self._api_service.get_user_repositories(access_token, page, per_page)

    async def get_repository_contents(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str = "",
        ref: str = "main"
    ) -> List[Dict[str, Any]]:
        """Get repository contents at specified path."""
        return await self._api_service.get_repository_contents(access_token, owner, repo, path, ref)

    async def get_file_content(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str,
        ref: str = "main"
    ) -> Tuple[str, str]:
        """Get file content and SHA."""
        return await self._api_service.get_file_content(access_token, owner, repo, path, ref)

    async def create_or_update_file(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        sha: Optional[str] = None,
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Create or update a file in the repository."""
        return await self._api_service.create_or_update_file(
            access_token, owner, repo, path, content, message, sha, branch
        )

    async def get_repository_branches(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get repository branches."""
        return await self._api_service.get_repository_branches(access_token, owner, repo)

    async def get_branches(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get all branches for a repository."""
        return await self._api_service.get_branches(access_token, owner, repo)

    # Cached API operations
    async def get_user_repositories_cached(
        self,
        access_token: str,
        account_id: int,
        force_refresh: bool = False,
        page: int = 1,
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get user's repositories with caching."""
        return await self._cache_service.get_or_fetch_repositories(
            account_id,
            lambda: self._api_service.get_user_repositories(access_token, page, per_page),
            force_refresh
        )

    async def get_repository_contents_cached(
        self,
        access_token: str,
        owner: str,
        repo: str,
        repo_id: int,
        path: str = "",
        ref: str = "main",
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """Get repository contents with caching."""
        return await self._cache_service.get_or_fetch_file_list(
            repo_id, path, ref,
            lambda: self._api_service.get_repository_contents(access_token, owner, repo, path, ref),
            force_refresh
        )

    # Sync operations
    async def pull_remote_changes(
        self,
        document,
        user_id: int,
        force_overwrite: bool = False
    ) -> Dict[str, Any]:
        """Pull remote changes and handle conflicts."""
        if not self.db_session:
            raise ValueError("Database session required for sync operations")
        return await self._sync_service.pull_remote_changes(
            self.db_session, document, user_id, force_overwrite
        )

    async def resolve_conflicts(
        self,
        document,
        resolved_content: str,
        user_id: int
    ) -> Dict[str, Any]:
        """Mark conflicts as resolved with user-provided content."""
        if not self.db_session:
            raise ValueError("Database session required for sync operations")
        return await self._sync_service.resolve_conflicts(
            self.db_session, document, resolved_content, user_id
        )

    # Import operations
    async def import_repository_file(
        self,
        user_id: int,
        repository,
        access_token: str,
        file_data: dict,
        branch: str = "main"
    ):
        """Import a single file from GitHub repository with proper folder structure."""
        if not self.db_session:
            raise ValueError("Database session required for import operations")
        return await self._import_service.import_repository_file(
            user_id, repository, access_token, file_data, branch
        )

    async def import_repository_batch(
        self,
        user_id: int,
        repository,
        access_token: str,
        file_list: List[dict],
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Import multiple files from repository maintaining folder structure."""
        if not self.db_session:
            raise ValueError("Database session required for import operations")
        return await self._import_service.import_repository_batch(
            user_id, repository, access_token, file_list, branch
        )

    async def sync_repository_structure(
        self,
        user_id: int,
        repository,
        access_token: str,
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Sync entire repository structure, updating folder paths for existing documents."""
        if not self.db_session:
            raise ValueError("Database session required for import operations")
        return await self._import_service.sync_repository_structure(
            user_id, repository, access_token, branch
        )

    # Background sync operations
    async def start_background_sync(self) -> None:
        """Start the background sync service."""
        await self._background_service.start()

    def stop_background_sync(self) -> None:
        """Stop the background sync service."""
        self._background_service.stop()

    async def sync_specific_document(self, document_id: int) -> bool:
        """Sync a specific document immediately."""
        return await self._background_service.sync_specific_document(document_id)

    async def force_sync_all_documents(self) -> Dict[str, int]:
        """Force sync all GitHub documents immediately."""
        return await self._background_service.force_sync_all_documents()

    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync service status."""
        return self._background_service.get_sync_status()

    # Pull Request operations
    async def create_pull_request(
        self,
        access_token: str,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> Dict[str, Any]:
        """Create a pull request."""
        return await self._pr_service.create_pull_request(
            access_token, owner, repo, title, body, head_branch, base_branch
        )

    async def get_pull_requests(
        self,
        access_token: str,
        owner: str,
        repo: str,
        state: str = "open",
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get pull requests for a repository."""
        return await self._pr_service.get_pull_requests(access_token, owner, repo, state, per_page)

    async def get_repository_contributors(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get repository contributors."""
        return await self._pr_service.get_repository_contributors(access_token, owner, repo)

    # Utility methods
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for comparison."""
        return self._api_service.generate_content_hash(content)

    def generate_git_blob_hash(self, content: str) -> str:
        """Generate Git blob SHA-1 hash compatible with GitHub."""
        return self._api_service.generate_git_blob_hash(content)

    async def commit_file(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        content: str,
        message: str,
        branch: str,
        sha: Optional[str] = None,
        create_branch: bool = False,
        base_branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """Commit file changes to GitHub repository."""
        return await self._api_service.commit_file(
            access_token, owner, repo, file_path, content, message, branch, sha, create_branch, base_branch
        )

    async def check_file_status(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        branch: str,
        local_sha: str
    ) -> Dict[str, Any]:
        """Check if file has been updated on GitHub since last sync."""
        return await self._api_service.check_file_status(
            access_token, owner, repo, file_path, branch, local_sha
        )

    # Filesystem operations
    async def clone_repository(
        self,
        repo_url: str,
        target_path,
        branch: Optional[str] = None
    ) -> bool:
        """Clone a GitHub repository with optimizations."""
        from pathlib import Path
        return await self._filesystem_service.clone_repository(
            repo_url, Path(target_path), branch
        )

    async def clone_repository_for_account(
        self,
        user_id: int,
        account_id: int,
        repo_name: str,
        repo_url: str,
        branch: Optional[str] = None
    ) -> bool:
        """Clone a repository for a specific GitHub account."""
        return await self._filesystem_service.clone_repository_for_account(
            user_id, account_id, repo_name, repo_url, branch
        )

    async def check_storage_limits(self, user_id: int) -> Tuple[bool, Dict[str, Any]]:
        """Check if GitHub storage is within limits for a user."""
        return await self._filesystem_service.check_storage_limits(user_id)

    async def auto_prune_repositories(self, user_id: int) -> Dict[str, Any]:
        """Auto-prune old/unused GitHub repositories."""
        return await self._filesystem_service.auto_prune_repositories(user_id)

    async def optimize_repository(self, repo_path) -> bool:
        """Optimize a repository by running git garbage collection."""
        from pathlib import Path
        return await self._filesystem_service.optimize_repository(Path(repo_path))

    async def get_github_account_storage_info(
        self,
        user_id: int,
        account_id: int
    ) -> Dict[str, Any]:
        """Get storage information for a specific GitHub account."""
        return await self._filesystem_service.get_github_account_storage_info(
            user_id, account_id
        )

    async def pull_repository_changes(
        self,
        repo_path,
        branch: Optional[str] = None
    ) -> bool:
        """Pull changes from remote repository."""
        from pathlib import Path
        return await self._filesystem_service.pull_changes(Path(repo_path), branch)

    async def get_github_repository_status(self, repo_path) -> Dict[str, Any]:
        """Get the current status of a GitHub repository."""
        from pathlib import Path
        return await self._filesystem_service.get_repository_status(Path(repo_path))


# Global service instances for backward compatibility
from .cache import github_cache_service
from .background import github_background_sync
from .filesystem import github_filesystem_service

__all__ = [
    "GitHubService",
    "GitHubFilesystemService",
    "github_cache_service",
    "github_background_sync",
    "github_filesystem_service"
]

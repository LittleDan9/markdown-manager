"""
User repository management service.

Handles initialization of category repositories and GitHub repository cloning.
"""

from typing import Optional, Dict, Any
import logging

from app.services.storage.git import Git
from app.services.github.filesystem import GitHubFilesystemService
from app.services.storage.user.directory import UserDirectory

logger = logging.getLogger(__name__)


class UserRepository:
    """Service for managing user repositories (categories and GitHub repos)."""

    def __init__(self):
        """Initialize the user repository service."""
        self.git = Git()
        self.github_filesystem_service = GitHubFilesystemService()
        self.directory = UserDirectory()

    async def initialize_category_repo(self, user_id: int, category_name: str) -> bool:
        """
        Initialize a git repository for a user's category.

        Args:
            user_id: The ID of the user
            category_name: Name of the category

        Returns:
            True if successful, False otherwise
        """
        try:
            category_dir = self.directory.get_category_directory(user_id, category_name)

            # Initialize git repository
            initial_message = f"Initialize {category_name} category"
            success = await self.git.initialize(category_dir, initial_message)

            if success:
                logger.info(f"Successfully initialized category repository: {category_dir}")
            return success

        except Exception as e:
            logger.error(f"Failed to initialize category repo {category_name} for user {user_id}: {e}")
            return False

    async def clone_github_repo(
        self,
        user_id: int,
        account_id: int,
        repo_name: str,
        repo_url: str,
        branch: Optional[str] = None
    ) -> bool:
        """
        Clone a GitHub repository for a user.

        Args:
            user_id: The ID of the user
            account_id: The GitHub account ID
            repo_name: Name of the repository
            repo_url: URL of the repository to clone
            branch: Specific branch to clone (None for default)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Use the specialized GitHub filesystem service for cloning
            success = await self.github_filesystem_service.clone_repository_for_account(
                user_id, account_id, repo_name, repo_url, branch
            )

            if success:
                logger.info(f"Successfully cloned GitHub repository: {repo_name} for user {user_id}")
            return success

        except Exception as e:
            logger.error(f"Failed to clone GitHub repo {repo_name} for user {user_id}: {e}")
            return False

    async def get_user_repositories(self, user_id: int) -> Dict[str, Any]:
        """
        Get information about all repositories for a user.

        Args:
            user_id: The ID of the user

        Returns:
            Dictionary containing repository information
        """
        try:
            user_dir = self.directory.get_user_directory(user_id)
            local_dir = self.directory.get_local_directory(user_id)
            github_dir = self.directory.get_github_directory(user_id)

            repositories = {
                "local_categories": [],
                "github_repositories": []
            }

            # Scan local categories
            if local_dir.exists():
                for category_dir in local_dir.iterdir():
                    if category_dir.is_dir() and (category_dir / ".git").exists():
                        status = await self.git.status(category_dir)
                        repositories["local_categories"].append({
                            "name": category_dir.name,
                            "path": str(category_dir.relative_to(user_dir)),
                            "status": status
                        })

            # Scan GitHub repositories
            if github_dir.exists():
                for account_dir in github_dir.iterdir():
                    if account_dir.is_dir():
                        for repo_dir in account_dir.iterdir():
                            if repo_dir.is_dir() and (repo_dir / ".git").exists():
                                # Use unified git service for all repository status checks
                                status = await self.git.status(repo_dir)
                                repositories["github_repositories"].append({
                                    "account_id": account_dir.name,
                                    "name": repo_dir.name,
                                    "path": str(repo_dir.relative_to(user_dir)),
                                    "status": status
                                })

            return repositories

        except Exception as e:
            logger.error(f"Failed to get repositories for user {user_id}: {e}")
            return {"local_categories": [], "github_repositories": []}

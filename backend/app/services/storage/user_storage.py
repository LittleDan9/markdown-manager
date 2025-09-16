"""
User storage service for managing user-specific storage operations.

This service coordinates filesystem and git operations for users,
including user directory creation, category management, and GitHub
repository integration.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from app.services.storage.filesystem import Filesystem
from app.services.storage.git import Git, GitCommit
from app.services.github.filesystem import GitHubFilesystemService
from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class UserStorage:
    """Service for managing user-specific storage operations."""

    def __init__(self):
        """Initialize the user storage service."""
        self.filesystem = Filesystem()
        self.git = Git()
        self.github_filesystem_service = GitHubFilesystemService()

    async def create_user_directory(self, user_id: int) -> bool:
        """
        Create the complete directory structure for a new user.

        Args:
            user_id: The ID of the user

        Returns:
            True if successful, False otherwise
        """
        try:
            success = await self.filesystem.create_user_directory(user_id)
            if success:
                logger.info(f"Successfully created storage structure for user {user_id}")
            return success
        except Exception as e:
            logger.error(f"Failed to create user directory for user {user_id}: {e}")
            return False

    async def cleanup_user_directory(self, user_id: int) -> bool:
        """
        Remove the complete directory structure for a user.
        Used for cleanup during registration failures.

        Args:
            user_id: The ID of the user

        Returns:
            True if successful, False otherwise
        """
        try:
            import shutil

            user_dir = self.filesystem.get_user_directory(user_id)
            if user_dir.exists():
                shutil.rmtree(user_dir)
                logger.info(f"Successfully cleaned up storage structure for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cleanup user directory for user {user_id}: {e}")
            return False

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
            category_dir = self.filesystem.get_category_directory(user_id, category_name)

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

    async def read_document(self, user_id: int, file_path: str) -> Optional[str]:
        """
        Read document content from user's storage.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage

        Returns:
            Document content or None if not found
        """
        return await self.filesystem.read_document(user_id, file_path)

    async def write_document(
        self,
        user_id: int,
        file_path: str,
        content: str,
        commit_message: Optional[str] = None,
        auto_commit: bool = True
    ) -> bool:
        """
        Write document content to user's storage with optional git commit.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            content: Content to write
            commit_message: Commit message (auto-generated if None)
            auto_commit: Whether to automatically commit the change

        Returns:
            True if successful, False otherwise
        """
        try:
            # Write the file
            success = await self.filesystem.write_document(user_id, file_path, content)
            if not success:
                return False

            # Auto-commit if requested and file is in a git repository
            if auto_commit:
                await self._auto_commit_file(user_id, file_path, commit_message)

            return True

        except Exception as e:
            logger.error(f"Failed to write document {file_path} for user {user_id}: {e}")
            return False

    async def move_document(
        self,
        user_id: int,
        old_path: str,
        new_path: str,
        commit_message: Optional[str] = None,
        auto_commit: bool = True
    ) -> bool:
        """
        Move a document from one location to another with optional git commit.

        Args:
            user_id: The ID of the user
            old_path: Current relative path to the document
            new_path: New relative path for the document
            commit_message: Commit message (auto-generated if None)
            auto_commit: Whether to automatically commit the change

        Returns:
            True if successful, False otherwise
        """
        try:
            # Move the file
            success = await self.filesystem.move_document(user_id, old_path, new_path)
            if not success:
                return False

            # Auto-commit if requested
            if auto_commit:
                if not commit_message:
                    old_name = Path(old_path).name
                    new_name = Path(new_path).name
                    commit_message = f"Move {old_name} to {new_name}"

                # Try to commit in both old and new repositories (they might be different categories)
                await self._auto_commit_file(user_id, old_path, commit_message, allow_missing=True)
                await self._auto_commit_file(user_id, new_path, commit_message)

            return True

        except Exception as e:
            logger.error(f"Failed to move document from {old_path} to {new_path} for user {user_id}: {e}")
            return False

    async def delete_document(
        self,
        user_id: int,
        file_path: str,
        commit_message: Optional[str] = None,
        auto_commit: bool = True
    ) -> bool:
        """
        Delete a document from user's storage with optional git commit.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            commit_message: Commit message (auto-generated if None)
            auto_commit: Whether to automatically commit the change

        Returns:
            True if successful, False otherwise
        """
        try:
            # Delete the file
            success = await self.filesystem.delete_document(user_id, file_path)
            if not success:
                return False

            # Auto-commit if requested
            if auto_commit:
                if not commit_message:
                    file_name = Path(file_path).name
                    commit_message = f"Delete {file_name}"

                await self._auto_commit_file(user_id, file_path, commit_message, allow_missing=True)

            return True

        except Exception as e:
            logger.error(f"Failed to delete document {file_path} for user {user_id}: {e}")
            return False

    async def get_document_history(self, user_id: int, file_path: str, limit: int = 50) -> List[GitCommit]:
        """
        Get the git history for a document.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            limit: Maximum number of commits to return

        Returns:
            List of GitCommit objects
        """
        try:
            repo_path = self._get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.warning(f"Could not determine repository for file {file_path}")
                return []

            # Get relative path within the repository
            user_dir = self.filesystem.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')
            relative_path = full_file_path.relative_to(repo_path)

            # Use appropriate service based on repository type
            if self._is_github_repository(user_id, file_path):
                # Use GitHubFilesystemService for GitHub repositories
                history = await self.github_filesystem_service.get_file_history(repo_path, str(relative_path), limit)
                # Convert dict format back to GitCommit objects for compatibility
                commits = []
                for commit_data in history:
                    try:
                        from datetime import datetime
                        date = datetime.fromisoformat(commit_data['date'].replace('Z', '+00:00'))
                        commit = GitCommit(
                            hash=commit_data['hash'],
                            message=commit_data['message'],
                            author=commit_data['author'],
                            date=date,
                            files=commit_data['files']
                        )
                        commits.append(commit)
                    except Exception as e:
                        logger.warning(f"Failed to convert commit data: {e}")
                        continue
                return commits
            else:
                # Use Git for local category repositories
                return await self.git.file_history(repo_path, str(relative_path), limit)

        except Exception as e:
            logger.error(f"Failed to get document history for {file_path} for user {user_id}: {e}")
            return []

    async def get_document_at_commit(self, user_id: int, file_path: str, commit_hash: str) -> Optional[str]:
        """
        Get document content at a specific commit.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            commit_hash: Git commit hash

        Returns:
            Document content at the specified commit or None if not found
        """
        try:
            repo_path = self._get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.warning(f"Could not determine repository for file {file_path}")
                return None

            # Get relative path within the repository
            user_dir = self.filesystem.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')
            relative_path = full_file_path.relative_to(repo_path)

            # Use appropriate service based on repository type
            if self._is_github_repository(user_id, file_path):
                # Use GitHubFilesystemService for GitHub repositories
                return await self.github_filesystem_service.get_file_content_at_commit(
                    repo_path, str(relative_path), commit_hash
                )
            else:
                # Use Git for local category repositories
                return await self.git.file_at_commit(repo_path, str(relative_path), commit_hash)

        except Exception as e:
            logger.error(f"Failed to get document at commit {commit_hash} for {file_path} for user {user_id}: {e}")
            return None

    async def get_user_repositories(self, user_id: int) -> Dict[str, Any]:
        """
        Get information about all repositories for a user.

        Args:
            user_id: The ID of the user

        Returns:
            Dictionary containing repository information
        """
        try:
            user_dir = self.filesystem.get_user_directory(user_id)
            local_dir = self.filesystem.get_local_directory(user_id)
            github_dir = self.filesystem.get_github_directory(user_id)

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

    def _get_repository_path_for_file(self, user_id: int, file_path: str) -> Optional[Path]:
        """
        Determine which git repository contains a file.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage

        Returns:
            Path to the git repository or None if not found
        """
        try:
            user_dir = self.filesystem.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')

            # Walk up the directory tree to find a .git directory
            current_path = full_file_path.parent
            while current_path != user_dir.parent:
                if (current_path / ".git").exists():
                    return current_path
                current_path = current_path.parent

            return None

        except Exception as e:
            logger.error(f"Failed to determine repository path for {file_path}: {e}")
            return None

    def _is_github_repository(self, user_id: int, file_path: str) -> bool:
        """
        Determine if a file is in a GitHub repository or local category repository.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage

        Returns:
            True if in GitHub repository, False if in local category repository
        """
        try:
            user_dir = self.filesystem.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')

            # Check if the path starts with github/
            relative_to_user = full_file_path.relative_to(user_dir)
            return str(relative_to_user).startswith('github/')

        except Exception as e:
            logger.error(f"Failed to determine repository type for {file_path}: {e}")
            return False

    async def _auto_commit_file(
        self,
        user_id: int,
        file_path: str,
        commit_message: Optional[str] = None,
        allow_missing: bool = False
    ) -> bool:
        """
        Automatically commit a file change.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage
            commit_message: Commit message (auto-generated if None)
            allow_missing: Whether to allow missing files (for deletions)

        Returns:
            True if successful, False otherwise
        """
        try:
            repo_path = self._get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.debug(f"No git repository found for file {file_path}, skipping commit")
                return True  # Not an error if no git repo

            if not commit_message:
                file_name = Path(file_path).name
                commit_message = f"Update {file_name}"

            # Get relative path within the repository
            user_dir = self.filesystem.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')

            if not allow_missing and not full_file_path.exists():
                logger.warning(f"File {file_path} does not exist, skipping commit")
                return False

            relative_path = str(full_file_path.relative_to(repo_path))

            # Commit the change
            success = await self.git.commit(repo_path, commit_message, [relative_path])

            if success:
                logger.debug(f"Successfully committed file {file_path}")

            return success

        except Exception as e:
            logger.error(f"Failed to auto-commit file {file_path} for user {user_id}: {e}")
            return False

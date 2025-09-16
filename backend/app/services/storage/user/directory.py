"""
User directory management service.

Handles creation, cleanup, and management of user directory structures.
"""

from pathlib import Path
from typing import Optional
import logging
import shutil

from app.services.storage.filesystem import Filesystem
from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class UserDirectory:
    """Service for managing user directory structures."""

    def __init__(self):
        """Initialize the user directory service."""
        self.filesystem = Filesystem()

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
            user_dir = self.filesystem.get_user_directory(user_id)
            if user_dir.exists():
                shutil.rmtree(user_dir)
                logger.info(f"Successfully cleaned up storage structure for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cleanup user directory for user {user_id}: {e}")
            return False

    def get_user_directory(self, user_id: int) -> Path:
        """Get the root directory for a user."""
        return self.filesystem.get_user_directory(user_id)

    def get_local_directory(self, user_id: int) -> Path:
        """Get the local categories directory for a user."""
        return self.filesystem.get_local_directory(user_id)

    def get_github_directory(self, user_id: int) -> Path:
        """Get the GitHub repositories directory for a user."""
        return self.filesystem.get_github_directory(user_id)

    def get_category_directory(self, user_id: int, category_name: str) -> Path:
        """Get the directory for a specific category."""
        return self.filesystem.get_category_directory(user_id, category_name)

    def get_repository_path_for_file(self, user_id: int, file_path: str) -> Optional[Path]:
        """
        Determine which git repository contains a file.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage

        Returns:
            Path to the git repository or None if not found
        """
        try:
            user_dir = self.get_user_directory(user_id)
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

    def is_github_repository(self, user_id: int, file_path: str) -> bool:
        """
        Determine if a file is in a GitHub repository or local category repository.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage

        Returns:
            True if in GitHub repository, False if in local category repository
        """
        try:
            user_dir = self.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')

            # Check if the path starts with github/
            relative_to_user = full_file_path.relative_to(user_dir)
            return str(relative_to_user).startswith('github/')

        except Exception as e:
            logger.error(f"Failed to determine repository type for {file_path}: {e}")
            return False

"""
Filesystem service for managing document storage operations.

This service handles the core filesystem operations for document storage,
including reading, writing, moving, and deleting documents within the
structured user directory system.
"""

import shutil
import aiofiles
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class Filesystem:
    """Service for managing document filesystem operations."""

    def __init__(self):
        """Initialize the filesystem service."""
        self.storage_root = Path(settings.markdown_storage_root)
        self.storage_root.mkdir(parents=True, exist_ok=True)

    def get_user_directory(self, user_id: int) -> Path:
        """Get the base directory for a user."""
        return self.storage_root / str(user_id)

    def get_local_directory(self, user_id: int) -> Path:
        """Get the local documents directory for a user."""
        return self.get_user_directory(user_id) / "local"

    def get_github_directory(self, user_id: int) -> Path:
        """Get the GitHub documents directory for a user."""
        return self.get_user_directory(user_id) / "github"

    def get_github_account_directory(self, user_id: int, account_id: int) -> Path:
        """Get the directory for a specific GitHub account."""
        return self.get_github_directory(user_id) / str(account_id)

    def get_category_directory(self, user_id: int, category_name: str) -> Path:
        """Get the directory for a specific category."""
        return self.get_local_directory(user_id) / category_name

    def get_github_repo_directory(self, user_id: int, account_id: int, repo_name: str) -> Path:
        """Get the directory for a specific GitHub repository."""
        return self.get_github_directory(user_id) / str(account_id) / repo_name

    async def create_user_directory(self, user_id: int) -> bool:
        """
        Create the complete directory structure for a new user.

        Args:
            user_id: The ID of the user

        Returns:
            True if successful, False otherwise
        """
        try:
            user_dir = self.get_user_directory(user_id)
            local_dir = self.get_local_directory(user_id)
            github_dir = self.get_github_directory(user_id)

            # Create directories
            user_dir.mkdir(parents=True, exist_ok=True)
            local_dir.mkdir(parents=True, exist_ok=True)
            github_dir.mkdir(parents=True, exist_ok=True)

            logger.info(f"Created user directory structure for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to create user directory for user {user_id}: {e}")
            return False

    async def read_document(self, user_id: int, file_path: str) -> Optional[str]:
        """
        Read document content from filesystem.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage

        Returns:
            Document content or None if not found
        """
        try:
            full_path = self.get_user_directory(user_id) / file_path.lstrip('/')

            if not full_path.exists():
                logger.warning(f"Document not found: {full_path}")
                return None

            async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
                content = await f.read()

            logger.debug(f"Successfully read document: {full_path}")
            return content

        except Exception as e:
            logger.error(f"Failed to read document {file_path} for user {user_id}: {e}")
            return None

    async def write_document(self, user_id: int, file_path: str, content: str) -> bool:
        """
        Write document content to filesystem.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            content: Content to write

        Returns:
            True if successful, False otherwise
        """
        try:
            full_path = self.get_user_directory(user_id) / file_path.lstrip('/')

            # Ensure parent directory exists
            full_path.parent.mkdir(parents=True, exist_ok=True)

            async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
                await f.write(content)

            logger.info(f"Successfully wrote document: {full_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to write document {file_path} for user {user_id}: {e}")
            return False

    async def move_document(self, user_id: int, old_path: str, new_path: str) -> bool:
        """
        Move a document from one location to another.

        Args:
            user_id: The ID of the user
            old_path: Current relative path to the document
            new_path: New relative path for the document

        Returns:
            True if successful, False otherwise
        """
        try:
            user_dir = self.get_user_directory(user_id)
            old_full_path = user_dir / old_path.lstrip('/')
            new_full_path = user_dir / new_path.lstrip('/')

            if not old_full_path.exists():
                logger.warning(f"Source document not found: {old_full_path}")
                return False

            # Ensure target directory exists
            new_full_path.parent.mkdir(parents=True, exist_ok=True)

            # Move the file
            shutil.move(str(old_full_path), str(new_full_path))

            logger.info(f"Successfully moved document from {old_full_path} to {new_full_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to move document from {old_path} to {new_path} for user {user_id}: {e}")
            return False

    async def delete_document(self, user_id: int, file_path: str) -> bool:
        """
        Delete a document from filesystem.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage

        Returns:
            True if successful, False otherwise
        """
        try:
            full_path = self.get_user_directory(user_id) / file_path.lstrip('/')

            if not full_path.exists():
                logger.warning(f"Document not found for deletion: {full_path}")
                return False

            full_path.unlink()

            logger.info(f"Successfully deleted document: {full_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete document {file_path} for user {user_id}: {e}")
            return False

    async def list_directory(self, user_id: int, directory_path: str = "") -> List[Dict[str, Any]]:
        """
        List contents of a directory.

        Args:
            user_id: The ID of the user
            directory_path: Relative path to the directory within user's storage

        Returns:
            List of directory entries with metadata
        """
        try:
            full_path = self.get_user_directory(user_id) / directory_path.lstrip('/')

            if not full_path.exists() or not full_path.is_dir():
                logger.warning(f"Directory not found: {full_path}")
                return []

            entries = []
            for item in full_path.iterdir():
                try:
                    stat = item.stat()
                    entry = {
                        "name": item.name,
                        "path": str(item.relative_to(self.get_user_directory(user_id))),
                        "is_directory": item.is_dir(),
                        "size": stat.st_size if item.is_file() else 0,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    }
                    entries.append(entry)
                except Exception as e:
                    logger.warning(f"Failed to get stats for {item}: {e}")
                    continue

            return sorted(entries, key=lambda x: (not x["is_directory"], x["name"]))

        except Exception as e:
            logger.error(f"Failed to list directory {directory_path} for user {user_id}: {e}")
            return []

    async def create_directory(self, user_id: int, directory_path: str) -> bool:
        """
        Create a directory.

        Args:
            user_id: The ID of the user
            directory_path: Relative path to the directory within user's storage

        Returns:
            True if successful, False otherwise
        """
        try:
            full_path = self.get_user_directory(user_id) / directory_path.lstrip('/')
            full_path.mkdir(parents=True, exist_ok=True)

            logger.info(f"Successfully created directory: {full_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to create directory {directory_path} for user {user_id}: {e}")
            return False

    async def get_file_info(self, user_id: int, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a file.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage

        Returns:
            File information dictionary or None if not found
        """
        try:
            full_path = self.get_user_directory(user_id) / file_path.lstrip('/')

            if not full_path.exists():
                return None

            stat = full_path.stat()
            return {
                "name": full_path.name,
                "path": file_path,
                "is_directory": full_path.is_dir(),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to get file info for {file_path} for user {user_id}: {e}")
            return None

"""
User document operations service.

Handles CRUD operations on documents with git integration.
"""

from typing import Optional
import logging

from app.services.storage.filesystem import Filesystem
from app.services.storage.user.directory import UserDirectory

logger = logging.getLogger(__name__)


class UserDocument:
    """Service for document CRUD operations."""

    def __init__(self):
        """Initialize the user document service."""
        self.filesystem = Filesystem()
        self.directory = UserDirectory()

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
        content: str
    ) -> bool:
        """
        Write document content to user's storage.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage
            content: Content to write

        Returns:
            True if successful, False otherwise
        """
        try:
            # Write the file
            success = await self.filesystem.write_document(user_id, file_path, content)
            if not success:
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to write document {file_path} for user {user_id}: {e}")
            return False

    async def move_document(
        self,
        user_id: int,
        old_path: str,
        new_path: str
    ) -> bool:
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
            # Move the file
            success = await self.filesystem.move_document(user_id, old_path, new_path)
            if not success:
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to move document from {old_path} to {new_path} for user {user_id}: {e}")
            return False

    async def delete_document(
        self,
        user_id: int,
        file_path: str
    ) -> bool:
        """
        Delete a document from user's storage.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the document within user's storage

        Returns:
            True if successful, False otherwise
        """
        try:
            # Delete the file
            success = await self.filesystem.delete_document(user_id, file_path)
            if not success:
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to delete document {file_path} for user {user_id}: {e}")
            return False

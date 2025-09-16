"""
Main user storage coordination service.

This service coordinates all user storage operations by delegating to
specialized services for different concerns.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from app.services.storage.user.directory import UserDirectory
from app.services.storage.user.repository import UserRepository
from app.services.storage.user.document import UserDocument
from app.services.storage.user.version import UserVersion
from app.services.storage.git import GitCommit

logger = logging.getLogger(__name__)


class UserStorage:
    """
    Main coordination service for user storage operations.

    This service delegates to specialized services:
    - UserDirectory: Directory management and structure
    - UserRepository: Repository initialization and management
    - UserDocument: Document CRUD operations
    - UserVersion: Git history and version control
    """

    def __init__(self):
        """Initialize the user storage coordination service."""
        self.directory = UserDirectory()
        self.repository = UserRepository()
        self.document = UserDocument()
        self.version = UserVersion()

    # Directory Management Delegation
    async def create_user_directory(self, user_id: int) -> bool:
        """Create the complete directory structure for a new user."""
        return await self.directory.create_user_directory(user_id)

    async def cleanup_user_directory(self, user_id: int) -> bool:
        """Remove the complete directory structure for a user."""
        return await self.directory.cleanup_user_directory(user_id)

    # Repository Management Delegation
    async def initialize_category_repo(self, user_id: int, category_name: str) -> bool:
        """Initialize a git repository for a user's category."""
        return await self.repository.initialize_category_repo(user_id, category_name)

    async def clone_github_repo(
        self,
        user_id: int,
        account_id: int,
        repo_name: str,
        repo_url: str,
        branch: Optional[str] = None
    ) -> bool:
        """Clone a GitHub repository for a user."""
        return await self.repository.clone_github_repo(user_id, account_id, repo_name, repo_url, branch)

    async def get_user_repositories(self, user_id: int) -> Dict[str, Any]:
        """Get information about all repositories for a user."""
        return await self.repository.get_user_repositories(user_id)

    # Document Operations Delegation
    async def read_document(self, user_id: int, file_path: str) -> Optional[str]:
        """Read document content from user's storage."""
        return await self.document.read_document(user_id, file_path)

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
        # Write the document
        success = await self.document.write_document(user_id, file_path, content)
        if not success:
            return False

        # Auto-commit if requested
        if auto_commit:
            await self.version.commit_file_change(user_id, file_path, commit_message)

        return True

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
        # Move the document
        success = await self.document.move_document(user_id, old_path, new_path)
        if not success:
            return False

        # Auto-commit if requested
        if auto_commit:
            if not commit_message:
                old_name = Path(old_path).name
                new_name = Path(new_path).name
                commit_message = f"Move {old_name} to {new_name}"

            # Try to commit in both old and new repositories (they might be different categories)
            await self.version.commit_file_change(user_id, old_path, commit_message, allow_missing=True)
            await self.version.commit_file_change(user_id, new_path, commit_message)

        return True

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
        # Delete the document
        success = await self.document.delete_document(user_id, file_path)
        if not success:
            return False

        # Auto-commit if requested
        if auto_commit:
            if not commit_message:
                file_name = Path(file_path).name
                commit_message = f"Delete {file_name}"

            await self.version.commit_file_change(user_id, file_path, commit_message, allow_missing=True)

        return True

    # Version Control Delegation
    async def get_document_history(self, user_id: int, file_path: str, limit: int = 50) -> List[GitCommit]:
        """Get the git history for a document."""
        return await self.version.get_document_history(user_id, file_path, limit)

    async def get_document_at_commit(self, user_id: int, file_path: str, commit_hash: str) -> Optional[str]:
        """Get document content at a specific commit."""
        return await self.version.get_document_at_commit(user_id, file_path, commit_hash)

    # Convenience Methods (delegating to directory service)
    def get_user_directory(self, user_id: int) -> Path:
        """Get the root directory for a user."""
        return self.directory.get_user_directory(user_id)

    def get_github_directory(self, user_id: int) -> Path:
        """Get the GitHub repositories directory for a user."""
        return self.directory.get_github_directory(user_id)

    def get_github_account_directory(self, user_id: int, account_id: int) -> Path:
        """Get the directory for a specific GitHub account."""
        return self.directory.get_github_directory(user_id) / str(account_id)

    def get_github_repo_directory(self, user_id: int, account_id: int, repo_name: str) -> Path:
        """Get the directory for a specific GitHub repository."""
        return self.get_github_account_directory(user_id, account_id) / repo_name

    def get_repository_path_for_file(self, user_id: int, file_path: str) -> Optional[Path]:
        """Determine which git repository contains a file."""
        return self.directory.get_repository_path_for_file(user_id, file_path)

    def is_github_repository(self, user_id: int, file_path: str) -> bool:
        """Determine if a file is in a GitHub repository or local category repository."""
        return self.directory.is_github_repository(user_id, file_path)

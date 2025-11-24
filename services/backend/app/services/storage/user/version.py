"""
User version control and history service.

Handles git operations, history tracking, and commit management.
"""

from pathlib import Path
from typing import List, Optional
import logging

from app.services.storage.git import Git, GitCommit
from app.services.github.filesystem import GitHubFilesystemService
from app.services.storage.user.directory import UserDirectory

logger = logging.getLogger(__name__)


class UserVersion:
    """Service for version control and history operations."""

    def __init__(self):
        """Initialize the user version service."""
        self.git = Git()
        self.github_filesystem_service = GitHubFilesystemService()
        self.directory = UserDirectory()

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
            repo_path = self.directory.get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.warning(f"Could not determine repository for file {file_path}")
                return []

            # Get relative path within the repository
            user_dir = self.directory.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')
            relative_path = full_file_path.relative_to(repo_path)

            # Use appropriate service based on repository type
            if self.directory.is_github_repository(user_id, file_path):
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
            repo_path = self.directory.get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.warning(f"Could not determine repository for file {file_path}")
                return None

            # Get relative path within the repository
            user_dir = self.directory.get_user_directory(user_id)
            full_file_path = user_dir / file_path.lstrip('/')
            relative_path = full_file_path.relative_to(repo_path)

            # Use appropriate service based on repository type
            if self.directory.is_github_repository(user_id, file_path):
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

    async def commit_file_change(
        self,
        user_id: int,
        file_path: str,
        commit_message: Optional[str] = None,
        allow_missing: bool = False
    ) -> bool:
        """
        Commit a file change to git.

        Args:
            user_id: The ID of the user
            file_path: Relative path to the file within user's storage
            commit_message: Commit message (auto-generated if None)
            allow_missing: Whether to allow missing files (for deletions)

        Returns:
            True if successful, False otherwise
        """
        try:
            repo_path = self.directory.get_repository_path_for_file(user_id, file_path)
            if not repo_path:
                logger.debug(f"No git repository found for file {file_path}, skipping commit")
                return True  # Not an error if no git repo

            if not commit_message:
                file_name = Path(file_path).name
                commit_message = f"Update {file_name}"

            # Get relative path within the repository
            user_dir = self.directory.get_user_directory(user_id)
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
            logger.error(f"Failed to commit file {file_path} for user {user_id}: {e}")
            return False

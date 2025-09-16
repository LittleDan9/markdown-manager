"""
Main Git service that coordinates all git operations.

This service provides a unified interface for all git operations
on any repository type (local categories or GitHub clones).
"""

from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

from app.configs.settings import get_settings
from .operations import (
    GitCommit,
    run_git_command,
    initialize_repository,
    commit_changes,
    clone_repository,
    pull_changes
)
from .history import (
    get_repository_status,
    get_file_history,
    get_file_content_at_commit
)

logger = logging.getLogger(__name__)
settings = get_settings()


class Git:
    """
    Unified git service for all repository operations.

    This service handles git operations for both local category repositories
    and cloned GitHub repositories, since they are all just git repositories.
    """

    def __init__(self):
        """Initialize the git service."""
        self.storage_root = Path(settings.markdown_storage_root)

    # Core operations
    async def run_command(self, repo_path: Path, command: List[str]) -> tuple[bool, str, str]:
        """Run a git command in the specified repository."""
        return await run_git_command(repo_path, command)

    async def initialize(self, repo_path: Path, initial_message: str = "Initial commit") -> bool:
        """Initialize a new git repository."""
        return await initialize_repository(repo_path, initial_message)

    async def commit(self, repo_path: Path, message: str, files: Optional[List[str]] = None) -> bool:
        """Commit changes to the repository."""
        return await commit_changes(repo_path, message, files)

    async def clone(self, repo_url: str, target_path: Path, branch: Optional[str] = None) -> bool:
        """Clone a git repository."""
        return await clone_repository(repo_url, target_path, branch)

    async def pull(self, repo_path: Path, branch: Optional[str] = None) -> bool:
        """Pull changes from remote repository."""
        return await pull_changes(repo_path, branch)

    # Status and history operations
    async def status(self, repo_path: Path) -> Dict[str, Any]:
        """Get the current status of the repository."""
        return await get_repository_status(repo_path)

    async def file_history(self, repo_path: Path, file_path: str, limit: int = 50) -> List[GitCommit]:
        """Get the commit history for a specific file."""
        return await get_file_history(repo_path, file_path, limit)

    async def file_at_commit(self, repo_path: Path, file_path: str, commit_hash: str) -> Optional[str]:
        """Get the content of a file at a specific commit."""
        return await get_file_content_at_commit(repo_path, file_path, commit_hash)

    # Utility methods
    def is_repository(self, path: Path) -> bool:
        """Check if a directory is a git repository."""
        return (path / ".git").exists()

    def get_repository_for_file(self, file_path: Path) -> Optional[Path]:
        """
        Find the git repository that contains a file by walking up the directory tree.

        Args:
            file_path: Absolute path to the file

        Returns:
            Path to the repository root or None if not in a git repository
        """
        try:
            current_path = file_path.parent if file_path.is_file() else file_path

            while current_path != current_path.parent:  # Stop at filesystem root
                if self.is_repository(current_path):
                    return current_path
                current_path = current_path.parent

            return None

        except Exception as e:
            logger.error(f"Failed to find repository for {file_path}: {e}")
            return None

"""
Git service for version control operations.

This service handles git operations for local category-based repositories only.
GitHub-specific operations are handled by GitHubFilesystemService.
"""

import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

from app.configs.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GitCommit:
    """Represents a git commit."""

    def __init__(self, hash: str, message: str, author: str, date: datetime, files: List[str]):
        self.hash = hash
        self.message = message
        self.author = author
        self.date = date
        self.files = files

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "hash": self.hash,
            "message": self.message,
            "author": self.author,
            "date": self.date.isoformat(),
            "files": self.files
        }


class GitService:
    """Service for managing git repository operations for local categories."""

    def __init__(self):
        """Initialize the git service."""
        self.storage_root = Path(settings.markdown_storage_root)

    async def _run_git_command(self, repo_path: Path, command: List[str]) -> tuple[bool, str, str]:
        """
        Run a git command in the specified repository.

        Args:
            repo_path: Path to the git repository
            command: Git command as list of strings

        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            full_command = ["git", "-C", str(repo_path)] + command

            process = await asyncio.create_subprocess_exec(
                *full_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=repo_path
            )

            stdout, stderr = await process.communicate()

            success = process.returncode == 0
            stdout_str = stdout.decode('utf-8').strip()
            stderr_str = stderr.decode('utf-8').strip()

            if not success:
                logger.warning(f"Git command failed: {' '.join(full_command)}")
                logger.warning(f"Error: {stderr_str}")

            return success, stdout_str, stderr_str

        except Exception as e:
            logger.error(f"Failed to run git command {' '.join(command)}: {e}")
            return False, "", str(e)

    async def initialize_repository(self, repo_path: Path, initial_message: str = "Initial commit") -> bool:
        """
        Initialize a new git repository.

        Args:
            repo_path: Path where to initialize the repository
            initial_message: Message for the initial commit

        Returns:
            True if successful, False otherwise
        """
        try:
            # Create directory if it doesn't exist
            repo_path.mkdir(parents=True, exist_ok=True)

            # Initialize git repository
            success, _, stderr = await self._run_git_command(repo_path, ["init"])
            if not success:
                logger.error(f"Failed to initialize git repository at {repo_path}: {stderr}")
                return False

            # Configure git user (use system defaults or set generic ones)
            await self._run_git_command(repo_path, ["config", "user.name", "Markdown Manager"])
            await self._run_git_command(repo_path, ["config", "user.email", "system@markdown-manager.local"])

            # Create initial README if no files exist
            readme_path = repo_path / "README.md"
            if not any(repo_path.glob("*.md")):
                readme_content = f"# Repository\n\nInitialized on {datetime.now().isoformat()}\n"
                readme_path.write_text(readme_content, encoding='utf-8')

            # Add all files and make initial commit
            await self._run_git_command(repo_path, ["add", "."])
            success, _, stderr = await self._run_git_command(repo_path, ["commit", "-m", initial_message])

            if success:
                logger.info(f"Successfully initialized git repository at {repo_path}")
                return True
            else:
                logger.warning(f"Repository initialized but initial commit failed: {stderr}")
                return True  # Repository is still usable

        except Exception as e:
            logger.error(f"Failed to initialize git repository at {repo_path}: {e}")
            return False

    async def commit_changes(self, repo_path: Path, message: str, files: Optional[List[str]] = None) -> bool:
        """
        Commit changes to the repository.

        Args:
            repo_path: Path to the git repository
            message: Commit message
            files: Specific files to commit (None for all changes)

        Returns:
            True if successful, False otherwise
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return False

            # Add files
            if files:
                for file in files:
                    success, _, stderr = await self._run_git_command(repo_path, ["add", file])
                    if not success:
                        logger.warning(f"Failed to add file {file}: {stderr}")
            else:
                success, _, stderr = await self._run_git_command(repo_path, ["add", "-A"])
                if not success:
                    logger.error(f"Failed to add files: {stderr}")
                    return False

            # Check if there are changes to commit
            success, stdout, _ = await self._run_git_command(repo_path, ["diff", "--cached", "--quiet"])
            if success:  # No changes staged
                logger.info(f"No changes to commit in {repo_path}")
                return True

            # Commit changes
            success, _, stderr = await self._run_git_command(repo_path, ["commit", "-m", message])
            if success:
                logger.info(f"Successfully committed changes to {repo_path}")
                return True
            else:
                logger.error(f"Failed to commit changes: {stderr}")
                return False

        except Exception as e:
            logger.error(f"Failed to commit changes to {repo_path}: {e}")
            return False

    async def get_repository_status(self, repo_path: Path) -> Dict[str, Any]:
        """
        Get the current status of the repository.

        Args:
            repo_path: Path to the git repository

        Returns:
            Dictionary containing repository status information
        """
        try:
            if not (repo_path / ".git").exists():
                return {"error": "Not a git repository"}

            # Get current branch
            success, branch, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            current_branch = branch if success else "unknown"

            # Get status
            success, status_output, _ = await self._run_git_command(repo_path, ["status", "--porcelain"])

            modified_files = []
            untracked_files = []
            staged_files = []

            if success and status_output:
                for line in status_output.split('\n'):
                    if len(line) >= 3:
                        status_code = line[:2]
                        filename = line[3:]

                        if status_code[0] in ['M', 'A', 'D', 'R', 'C']:
                            staged_files.append(filename)
                        if status_code[1] in ['M', 'D']:
                            modified_files.append(filename)
                        if status_code == '??':
                            untracked_files.append(filename)

            # Get last commit info
            success, commit_info, _ = await self._run_git_command(
                repo_path,
                ["log", "-1", "--format=%H|%s|%an|%ai"]
            )

            last_commit = None
            if success and commit_info:
                parts = commit_info.split('|', 3)
                if len(parts) == 4:
                    last_commit = {
                        "hash": parts[0],
                        "message": parts[1],
                        "author": parts[2],
                        "date": parts[3]
                    }

            return {
                "branch": current_branch,
                "staged_files": staged_files,
                "modified_files": modified_files,
                "untracked_files": untracked_files,
                "last_commit": last_commit,
                "has_changes": bool(staged_files or modified_files or untracked_files)
            }

        except Exception as e:
            logger.error(f"Failed to get repository status for {repo_path}: {e}")
            return {"error": str(e)}

    async def get_file_history(self, repo_path: Path, file_path: str, limit: int = 50) -> List[GitCommit]:
        """
        Get the commit history for a specific file.

        Args:
            repo_path: Path to the git repository
            file_path: Relative path to the file within the repository
            limit: Maximum number of commits to return

        Returns:
            List of GitCommit objects
        """
        try:
            if not (repo_path / ".git").exists():
                logger.warning(f"Not a git repository: {repo_path}")
                return []

            # Get commit history for the file
            success, history_output, stderr = await self._run_git_command(
                repo_path,
                ["log", f"--max-count={limit}", "--format=%H|%s|%an|%ai", "--", file_path]
            )

            if not success:
                logger.warning(f"Failed to get file history: {stderr}")
                return []

            commits = []
            for line in history_output.split('\n'):
                if line.strip():
                    parts = line.split('|', 3)
                    if len(parts) == 4:
                        try:
                            date = datetime.fromisoformat(parts[3].replace('Z', '+00:00'))
                            commit = GitCommit(
                                hash=parts[0],
                                message=parts[1],
                                author=parts[2],
                                date=date,
                                files=[file_path]
                            )
                            commits.append(commit)
                        except Exception as e:
                            logger.warning(f"Failed to parse commit info: {line}, error: {e}")
                            continue

            return commits

        except Exception as e:
            logger.error(f"Failed to get file history for {file_path} in {repo_path}: {e}")
            return []

    async def get_file_content_at_commit(self, repo_path: Path, file_path: str, commit_hash: str) -> Optional[str]:
        """
        Get the content of a file at a specific commit.

        Args:
            repo_path: Path to the git repository
            file_path: Relative path to the file within the repository
            commit_hash: Git commit hash

        Returns:
            File content at the specified commit or None if not found
        """
        try:
            if not (repo_path / ".git").exists():
                logger.warning(f"Not a git repository: {repo_path}")
                return None

            success, content, stderr = await self._run_git_command(
                repo_path,
                ["show", f"{commit_hash}:{file_path}"]
            )

            if success:
                return content
            else:
                logger.warning(f"Failed to get file content at commit {commit_hash}: {stderr}")
                return None

        except Exception as e:
            logger.error(f"Failed to get file content at commit {commit_hash}: {e}")
            return None

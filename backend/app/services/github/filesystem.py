"""
GitHub-specific filesystem operations for repository cloning and storage management.

This service handles GitHub repository cloning, storage optimization, and management
specifically for GitHub integrations, separate from local category git operations.
"""
import asyncio
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import logging

from app.configs.settings import settings
from .base import BaseGitHubService

logger = logging.getLogger(__name__)


class GitHubFilesystemService(BaseGitHubService):
    """
    GitHub-specific filesystem operations for repository cloning and storage management.

    This service is responsible for:
    - Cloning GitHub repositories to local filesystem
    - Managing storage limits for GitHub repositories
    - Auto-pruning old/unused repositories
    - Optimizing repository storage
    """

    def __init__(self):
        """Initialize GitHub filesystem service."""
        super().__init__()
        self.storage_root = Path(settings.markdown_storage_root)

    async def _run_git_command(
        self,
        repo_path: Path,
        command: List[str]
    ) -> Tuple[bool, str, str]:
        """
        Run a git command in the specified repository.

        Args:
            repo_path: Path to the git repository
            command: Git command as list of strings

        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Build git command with safe directory and ownership bypass
            git_command = [
                "git",
                "-c", "safe.directory=*",  # Bypass ownership check
                *command
            ]

            process = await asyncio.create_subprocess_exec(
                *git_command,
                cwd=repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            return (
                process.returncode == 0,
                stdout.decode("utf-8"),
                stderr.decode("utf-8")
            )

        except Exception as e:
            logger.error(f"Failed to run git command {command}: {e}")
            return False, "", str(e)

    async def clone_repository(
        self,
        repo_url: str,
        target_path: Path,
        branch: Optional[str] = None
    ) -> bool:
        """
        Clone a GitHub repository with optimizations for markdown-focused system.

        Args:
            repo_url: URL of the repository to clone
            target_path: Local path where repository should be cloned
            branch: Specific branch to clone (None for default)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Create parent directory if it doesn't exist
            target_path.parent.mkdir(parents=True, exist_ok=True)

            # Build clone command with optimizations
            clone_cmd = [
                "clone",
                "--depth", str(settings.github_clone_depth),  # Shallow clone
                "--single-branch",
                "--no-tags"  # Skip tags to save space
            ]

            if branch:
                clone_cmd.extend(["--branch", branch])

            clone_cmd.extend([repo_url, str(target_path)])

            # Execute clone command
            process = await asyncio.create_subprocess_exec(
                "git",
                *clone_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                # Ensure working directory is in sync with git index
                reset_success, _, reset_error = await self._run_git_command(
                    target_path,
                    ["reset", "--hard", "HEAD"]
                )

                if not reset_success:
                    logger.warning(f"Git reset failed after clone: {reset_error}")

                # Skip markdown-only cleanup for GitHub repositories to maintain full repo structure
                # Storage limits should be enforced at the user/account level instead

                logger.info(f"Successfully cloned repository to {target_path} (depth: {settings.github_clone_depth})")
                return True
            else:
                logger.error(f"Failed to clone repository: {stderr.decode()}")
                return False

        except Exception as e:
            logger.error(f"Failed to clone repository from {repo_url}: {e}")
            return False

    async def _cleanup_non_markdown_files(self, repo_path: Path) -> None:
        """
        Remove non-markdown files to save storage space.

        Args:
            repo_path: Path to the cloned repository
        """
        try:
            markdown_extensions = {'.md', '.markdown', '.mdown', '.mkd', '.mkdn'}
            keep_files = {'README', 'LICENSE', 'CHANGELOG', '.gitignore'}

            for file_path in repo_path.rglob('*'):
                if file_path.is_file():
                    # Keep markdown files
                    if file_path.suffix.lower() in markdown_extensions:
                        continue

                    # Keep important non-markdown files
                    if file_path.name in keep_files or file_path.name.upper() in keep_files:
                        continue

                    # Keep .git directory
                    if '.git' in file_path.parts:
                        continue

                    # Remove everything else
                    try:
                        file_path.unlink()
                        logger.debug(f"Removed non-markdown file: {file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to remove file {file_path}: {e}")

        except Exception as e:
            logger.error(f"Failed to cleanup non-markdown files in {repo_path}: {e}")

    async def get_repository_size(self, repo_path: Path) -> int:
        """
        Get the total size of a repository in bytes.

        Args:
            repo_path: Path to the repository

        Returns:
            Size in bytes
        """
        try:
            if not repo_path.exists():
                return 0

            total_size = 0
            for file_path in repo_path.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size

            return total_size

        except Exception as e:
            logger.error(f"Failed to calculate size for {repo_path}: {e}")
            return 0

    async def check_storage_limits(self, user_id: int) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if GitHub storage is within limits for a user.

        Args:
            user_id: User ID to check

        Returns:
            Tuple of (within_limits, storage_info)
        """
        try:
            github_dir = self.storage_root / str(user_id) / "github"
            if not github_dir.exists():
                return True, {"total_size_mb": 0, "repo_count": 0}

            total_size = 0
            repo_count = 0

            # Calculate total size across all GitHub repositories
            for account_dir in github_dir.iterdir():
                if account_dir.is_dir():
                    for repo_dir in account_dir.iterdir():
                        if repo_dir.is_dir():
                            repo_size = await self.get_repository_size(repo_dir)
                            total_size += repo_size
                            repo_count += 1

            total_size_mb = total_size / (1024 * 1024)
            limit_gb = settings.github_total_storage_limit_gb
            limit_mb = limit_gb * 1024

            within_limits = total_size_mb <= limit_mb

            storage_info = {
                "total_size_mb": round(total_size_mb, 2),
                "total_size_gb": round(total_size_mb / 1024, 2),
                "limit_gb": limit_gb,
                "limit_mb": limit_mb,
                "usage_percentage": round((total_size_mb / limit_mb) * 100, 2) if limit_mb > 0 else 0,
                "repo_count": repo_count,
                "within_limits": within_limits
            }

            return within_limits, storage_info

        except Exception as e:
            logger.error(f"Failed to check storage limits for user {user_id}: {e}")
            return False, {"error": str(e)}

    async def auto_prune_repositories(self, user_id: int) -> Dict[str, Any]:
        """
        Auto-prune old/unused GitHub repositories based on last access time.

        Args:
            user_id: User ID to prune repositories for

        Returns:
            Dictionary with pruning results
        """
        try:
            github_dir = self.storage_root / str(user_id) / "github"
            if not github_dir.exists():
                return {"pruned_repos": [], "total_size_freed_mb": 0}

            cutoff_date = datetime.now() - timedelta(days=settings.github_auto_prune_days)
            pruned_repos = []
            total_size_freed = 0

            # Check each repository's last access time
            for account_dir in github_dir.iterdir():
                if account_dir.is_dir():
                    for repo_dir in account_dir.iterdir():
                        if repo_dir.is_dir():
                            # Check last modified time as proxy for last access
                            last_modified = datetime.fromtimestamp(repo_dir.stat().st_mtime)

                            if last_modified < cutoff_date:
                                # Calculate size before removal
                                repo_size = await self.get_repository_size(repo_dir)

                                # Remove the repository
                                shutil.rmtree(repo_dir)

                                pruned_repos.append({
                                    "path": f"{account_dir.name}/{repo_dir.name}",
                                    "last_modified": last_modified.isoformat(),
                                    "size_mb": round(repo_size / (1024 * 1024), 2)
                                })
                                total_size_freed += repo_size

                                logger.info(f"Pruned old repository: {account_dir.name}/{repo_dir.name}")

            return {
                "pruned_repos": pruned_repos,
                "total_size_freed_mb": round(total_size_freed / (1024 * 1024), 2),
                "cutoff_date": cutoff_date.isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to auto-prune repositories for user {user_id}: {e}")
            return {"error": str(e)}

    async def optimize_repository(self, repo_path: Path) -> bool:
        """
        Optimize a repository by running git garbage collection and compression.

        Args:
            repo_path: Path to the repository

        Returns:
            True if successful, False otherwise
        """
        try:
            # Run git gc to clean up and compress
            success, stdout, stderr = await self._run_git_command(
                repo_path, ["gc", "--aggressive", "--prune=now"]
            )

            if success:
                logger.info(f"Optimized repository: {repo_path}")
                return True
            else:
                logger.error(f"Failed to optimize repository {repo_path}: {stderr}")
                return False

        except Exception as e:
            logger.error(f"Failed to optimize repository {repo_path}: {e}")
            return False

    async def pull_changes(
        self,
        repo_path: Path,
        branch: Optional[str] = None
    ) -> bool:
        """
        Pull changes from remote repository.

        Args:
            repo_path: Path to the git repository
            branch: Specific branch to pull (None for current)

        Returns:
            True if successful, False otherwise
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return False

            # Checkout branch if specified
            if branch:
                success, _, stderr = await self._run_git_command(repo_path, ["checkout", branch])
                if not success:
                    logger.warning(f"Failed to checkout branch {branch}: {stderr}")

            # Pull changes
            success, stdout, stderr = await self._run_git_command(repo_path, ["pull"])

            if success:
                logger.info(f"Successfully pulled changes for {repo_path}")
                return True
            else:
                logger.error(f"Failed to pull changes: {stderr}")
                return False

        except Exception as e:
            logger.error(f"Failed to pull changes for {repo_path}: {e}")
            return False

    async def get_repository_status(self, repo_path: Path) -> Dict[str, Any]:
        """
        Get the current status of a GitHub repository.

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

    async def get_file_history(self, repo_path: Path, file_path: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get the commit history for a specific file in a GitHub repository.

        Args:
            repo_path: Path to the git repository
            file_path: Relative path to the file within the repository
            limit: Maximum number of commits to return

        Returns:
            List of commit dictionaries
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
                            commits.append({
                                "hash": parts[0],
                                "message": parts[1],
                                "author": parts[2],
                                "date": parts[3],
                                "files": [file_path]
                            })
                        except Exception as e:
                            logger.warning(f"Failed to parse commit info: {line}, error: {e}")
                            continue

            return commits

        except Exception as e:
            logger.error(f"Failed to get file history for {file_path} in {repo_path}: {e}")
            return []

    async def get_file_content_at_commit(self, repo_path: Path, file_path: str, commit_hash: str) -> Optional[str]:
        """
        Get the content of a file at a specific commit in a GitHub repository.

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

    async def get_github_account_storage_info(self, user_id: int, account_id: int) -> Dict[str, Any]:
        """
        Get storage information for a specific GitHub account.

        Args:
            user_id: User ID
            account_id: GitHub account ID

        Returns:
            Storage information for the account
        """
        try:
            account_dir = self.storage_root / str(user_id) / "github" / str(account_id)
            if not account_dir.exists():
                return {"repo_count": 0, "total_size_mb": 0, "repositories": []}

            repositories = []
            total_size = 0

            for repo_dir in account_dir.iterdir():
                if repo_dir.is_dir():
                    repo_size = await self.get_repository_size(repo_dir)
                    total_size += repo_size

                    repositories.append({
                        "name": repo_dir.name,
                        "size_mb": round(repo_size / (1024 * 1024), 2),
                        "last_modified": datetime.fromtimestamp(repo_dir.stat().st_mtime).isoformat()
                    })

            return {
                "repo_count": len(repositories),
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "repositories": repositories
            }

        except Exception as e:
            logger.error(f"Failed to get storage info for account {account_id}: {e}")
            return {"error": str(e)}

    async def clone_repository_for_account(
        self,
        user_id: int,
        account_id: int,
        repo_name: str,
        repo_url: str,
        branch: Optional[str] = None
    ) -> bool:
        """
        Clone a repository for a specific GitHub account.

        Args:
            user_id: User ID
            account_id: GitHub account ID
            repo_name: Repository name
            repo_url: Repository URL
            branch: Branch to clone

        Returns:
            True if successful, False otherwise
        """
        try:
            # Check storage limits before cloning
            within_limits, _ = await self.check_storage_limits(user_id)
            if not within_limits:
                logger.warning(f"Storage limit exceeded for user {user_id}, skipping clone")
                return False

            target_path = self.storage_root / str(user_id) / "github" / str(account_id) / repo_name

            # Remove existing repository if it exists
            if target_path.exists():
                shutil.rmtree(target_path)

            success = await self.clone_repository(repo_url, target_path, branch)

            if success:
                logger.info(f"Successfully cloned {repo_name} for user {user_id}, account {account_id}")

            return success

        except Exception as e:
            logger.error(f"Failed to clone repository {repo_name} for account {account_id}: {e}")
            return False


# Global instance for usage throughout the application
github_filesystem_service = GitHubFilesystemService()

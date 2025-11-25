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

    async def stash_changes(
        self,
        repo_path: Path,
        message: Optional[str] = None,
        include_untracked: bool = False
    ) -> Dict[str, Any]:
        """
        Stash uncommitted changes in the repository.

        Args:
            repo_path: Path to the git repository
            message: Optional stash message
            include_untracked: Whether to include untracked files

        Returns:
            Dictionary containing stash operation result
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return {"success": False, "error": "Not a git repository"}

            # Check if there are changes to stash
            success, stdout, _ = await self._run_git_command(repo_path, ["status", "--porcelain"])
            if success and not stdout.strip():
                logger.info(f"No changes to stash in {repo_path}")
                return {"success": True, "message": "No changes to stash", "stash_id": None}

            # Build stash command
            stash_cmd = ["stash", "push"]

            if message:
                stash_cmd.extend(["-m", message])

            if include_untracked:
                stash_cmd.append("-u")

            # Execute stash command
            success, stdout, stderr = await self._run_git_command(repo_path, stash_cmd)

            if not success:
                logger.error(f"Failed to stash changes: {stderr}")
                return {"success": False, "error": stderr}

            # Get the latest stash ID
            success, stash_list, _ = await self._run_git_command(repo_path, ["stash", "list", "-1"])
            stash_id = stash_list.strip().split(':')[0] if success and stash_list.strip() else "stash@{0}"

            logger.info(f"Successfully stashed changes in {repo_path}: {stash_id}")
            return {
                "success": True,
                "stash_id": stash_id,
                "message": f"Changes stashed as {stash_id}",
                "stash_message": message
            }

        except Exception as e:
            logger.error(f"Failed to stash changes in {repo_path}: {e}")
            return {"success": False, "error": str(e)}

    async def list_stashes(self, repo_path: Path) -> List[Dict[str, Any]]:
        """
        List all stashes in the repository.

        Args:
            repo_path: Path to the git repository

        Returns:
            List of stash information dictionaries
        """
        try:
            if not (repo_path / ".git").exists():
                logger.warning(f"Not a git repository: {repo_path}")
                return []

            success, stash_output, stderr = await self._run_git_command(
                repo_path, ["stash", "list", "--format=%gd|%gs|%gD|%at"]
            )

            if not success:
                logger.warning(f"Failed to list stashes: {stderr}")
                return []

            stashes = []
            for line in stash_output.split('\n'):
                if line.strip():
                    parts = line.split('|', 3)
                    if len(parts) >= 4:
                        try:
                            timestamp = int(parts[3])
                            date = datetime.fromtimestamp(timestamp)
                            stashes.append({
                                "stash_id": parts[0],
                                "message": parts[1],
                                "commit_hash": parts[2],
                                "date": date.isoformat(),
                                "timestamp": timestamp
                            })
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Failed to parse stash info: {line}, error: {e}")
                            continue

            return stashes

        except Exception as e:
            logger.error(f"Failed to list stashes for {repo_path}: {e}")
            return []

    async def apply_stash(self, repo_path: Path, stash_id: str = "stash@{0}", pop: bool = False) -> Dict[str, Any]:
        """
        Apply or pop a stash.

        Args:
            repo_path: Path to the git repository
            stash_id: Stash identifier (default: latest)
            pop: Whether to pop (remove) the stash after applying

        Returns:
            Dictionary containing apply operation result
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return {"success": False, "error": "Not a git repository"}

            # Use pop or apply command
            cmd = ["stash", "pop" if pop else "apply", stash_id]
            success, stdout, stderr = await self._run_git_command(repo_path, cmd)

            if success:
                operation = "popped" if pop else "applied"
                logger.info(f"Successfully {operation} stash {stash_id} in {repo_path}")
                return {
                    "success": True,
                    "stash_id": stash_id,
                    "operation": operation,
                    "message": f"Stash {stash_id} {operation} successfully"
                }
            else:
                logger.error(f"Failed to apply stash {stash_id}: {stderr}")
                return {"success": False, "error": stderr, "stash_id": stash_id}

        except Exception as e:
            logger.error(f"Failed to apply stash {stash_id} in {repo_path}: {e}")
            return {"success": False, "error": str(e)}

    async def create_branch(
        self,
        repo_path: Path,
        branch_name: str,
        base_branch: Optional[str] = None,
        switch_to_branch: bool = True
    ) -> Dict[str, Any]:
        """
        Create a new git branch and optionally switch to it.

        Args:
            repo_path: Path to the git repository
            branch_name: Name of the new branch
            base_branch: Base branch to create from (current branch if None)
            switch_to_branch: Whether to switch to the new branch after creation

        Returns:
            Dictionary containing branch creation result
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return {"success": False, "error": "Not a git repository"}

            # Check if branch already exists
            success, branches, _ = await self._run_git_command(repo_path, ["branch", "--list", branch_name])
            if success and branches.strip():
                logger.warning(f"Branch '{branch_name}' already exists in {repo_path}")
                return {"success": False, "error": f"Branch '{branch_name}' already exists"}

            # Get current branch before creating new one
            success, current_branch, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            original_branch = current_branch.strip() if success else "unknown"

            if switch_to_branch:
                # Create and switch in one command
                create_cmd = ["checkout", "-b", branch_name]
                if base_branch:
                    create_cmd.append(base_branch)
            else:
                # Just create the branch
                create_cmd = ["branch", branch_name]
                if base_branch:
                    create_cmd.append(base_branch)

            success, stdout, stderr = await self._run_git_command(repo_path, create_cmd)

            if not success:
                logger.error(f"Failed to create branch '{branch_name}': {stderr}")
                return {"success": False, "error": stderr, "branch_name": branch_name}

            # Get current branch to confirm switch (if applicable)
            success, new_current, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            final_branch = new_current.strip() if success else "unknown"

            logger.info(f"Successfully created branch '{branch_name}' in {repo_path}")
            return {
                "success": True,
                "branch_name": branch_name,
                "base_branch": base_branch or original_branch,
                "switched": switch_to_branch,
                "current_branch": final_branch,
                "original_branch": original_branch,
                "message": f"Branch '{branch_name}' created successfully" + (" and switched to" if switch_to_branch else "")
            }

        except Exception as e:
            logger.error(f"Failed to create branch '{branch_name}' in {repo_path}: {e}")
            return {"success": False, "error": str(e)}

    async def list_branches(self, repo_path: Path, include_remote: bool = False) -> Dict[str, Any]:
        """
        List all branches in the repository.

        Args:
            repo_path: Path to the git repository
            include_remote: Whether to include remote branches

        Returns:
            Dictionary containing branch information
        """
        try:
            if not (repo_path / ".git").exists():
                logger.warning(f"Not a git repository: {repo_path}")
                return {"current_branch": "unknown", "local_branches": [], "remote_branches": []}

            # Get current branch
            success, current_branch, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            current = current_branch.strip() if success else "unknown"

            # Get local branches
            success, local_output, _ = await self._run_git_command(
                repo_path, ["branch", "--format=%(refname:short)|%(HEAD)"]
            )
            local_branches = []

            if success and local_output:
                for line in local_output.split('\n'):
                    if line.strip():
                        parts = line.split('|')
                        if len(parts) >= 2:
                            branch_name = parts[0]
                            is_current = parts[1] == '*'
                            local_branches.append({
                                "name": branch_name,
                                "is_current": is_current
                            })

            remote_branches = []
            if include_remote:
                # Get remote branches
                success, remote_output, _ = await self._run_git_command(
                    repo_path, ["branch", "-r", "--format=%(refname:short)"]
                )

                if success and remote_output:
                    for line in remote_output.split('\n'):
                        if line.strip() and not line.strip().endswith('/HEAD'):
                            remote_branches.append({
                                "name": line.strip(),
                                "is_current": False
                            })

            return {
                "current_branch": current,
                "local_branches": local_branches,
                "remote_branches": remote_branches,
                "total_local": len(local_branches),
                "total_remote": len(remote_branches)
            }

        except Exception as e:
            logger.error(f"Failed to list branches for {repo_path}: {e}")
            return {"current_branch": "unknown", "local_branches": [], "remote_branches": [], "error": str(e)}

    async def switch_branch(self, repo_path: Path, branch_name: str, create_if_not_exists: bool = False) -> Dict[str, Any]:
        """
        Switch to a different branch.

        Args:
            repo_path: Path to the git repository
            branch_name: Name of the branch to switch to
            create_if_not_exists: Whether to create the branch if it doesn't exist

        Returns:
            Dictionary containing switch operation result
        """
        try:
            if not (repo_path / ".git").exists():
                logger.error(f"Not a git repository: {repo_path}")
                return {"success": False, "error": "Not a git repository"}

            # Get current branch
            success, current_branch, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            original_branch = current_branch.strip() if success else "unknown"

            if original_branch == branch_name:
                return {
                    "success": True,
                    "branch_name": branch_name,
                    "message": f"Already on branch '{branch_name}'",
                    "switched": False
                }

            # Check if branch exists
            success, branches, _ = await self._run_git_command(repo_path, ["branch", "--list", branch_name])
            branch_exists = success and branches.strip()

            if not branch_exists and not create_if_not_exists:
                return {"success": False, "error": f"Branch '{branch_name}' does not exist"}

            # Switch or create+switch
            if branch_exists:
                switch_cmd = ["checkout", branch_name]
            else:
                switch_cmd = ["checkout", "-b", branch_name]

            success, stdout, stderr = await self._run_git_command(repo_path, switch_cmd)

            if not success:
                logger.error(f"Failed to switch to branch '{branch_name}': {stderr}")
                return {"success": False, "error": stderr, "branch_name": branch_name}

            # Confirm switch
            success, new_current, _ = await self._run_git_command(repo_path, ["branch", "--show-current"])
            final_branch = new_current.strip() if success else "unknown"

            logger.info(f"Successfully switched to branch '{branch_name}' in {repo_path}")
            return {
                "success": True,
                "branch_name": branch_name,
                "original_branch": original_branch,
                "current_branch": final_branch,
                "created": not branch_exists,
                "switched": True,
                "message": f"Switched to branch '{branch_name}'" + (" (created)" if not branch_exists else "")
            }

        except Exception as e:
            logger.error(f"Failed to switch to branch '{branch_name}' in {repo_path}: {e}")
            return {"success": False, "error": str(e)}

    async def get_repository_history(
        self,
        repo_path: Path,
        limit: int = 50,
        branch: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get commit history for the repository.

        Args:
            repo_path: Path to the git repository
            limit: Maximum number of commits to return
            branch: Specific branch to get history for (current branch if None)

        Returns:
            List of commit information dictionaries
        """
        try:
            if not (repo_path / ".git").exists():
                logger.warning(f"Not a git repository: {repo_path}")
                return []

            # Build log command
            log_cmd = ["log", f"--max-count={limit}", "--format=%H|%s|%an|%ae|%ai|%P"]

            if branch:
                log_cmd.append(branch)

            success, history_output, stderr = await self._run_git_command(repo_path, log_cmd)

            if not success:
                logger.warning(f"Failed to get repository history: {stderr}")
                return []

            commits = []
            for line in history_output.split('\n'):
                if line.strip():
                    parts = line.split('|', 5)
                    if len(parts) >= 6:
                        try:
                            # Parse parent commits
                            parents = parts[5].strip().split() if parts[5].strip() else []

                            date = datetime.fromisoformat(parts[4].replace('Z', '+00:00'))
                            commits.append({
                                "hash": parts[0],
                                "short_hash": parts[0][:8],
                                "message": parts[1],
                                "author": parts[2],
                                "email": parts[3],
                                "date": date.isoformat(),
                                "timestamp": int(date.timestamp()),
                                "parents": parents,
                                "is_merge": len(parents) > 1
                            })
                        except Exception as e:
                            logger.warning(f"Failed to parse commit info: {line}, error: {e}")
                            continue

            return commits

        except Exception as e:
            logger.error(f"Failed to get repository history for {repo_path}: {e}")
            return []

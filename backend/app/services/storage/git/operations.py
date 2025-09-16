"""
Core git operations for all types of repositories.

This module handles basic git commands that work on any git repository,
whether it's a local category or a cloned GitHub repository.
"""

import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


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


async def run_git_command(repo_path: Path, command: List[str]) -> tuple[bool, str, str]:
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


async def initialize_repository(repo_path: Path, initial_message: str = "Initial commit") -> bool:
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
        success, _, stderr = await run_git_command(repo_path, ["init"])
        if not success:
            logger.error(f"Failed to initialize git repository at {repo_path}: {stderr}")
            return False

        # Configure git user (use system defaults or set generic ones)
        await run_git_command(repo_path, ["config", "user.name", "Markdown Manager"])
        await run_git_command(repo_path, ["config", "user.email", "system@markdown-manager.local"])

        # Create initial README if no files exist
        readme_path = repo_path / "README.md"
        if not any(repo_path.glob("*.md")):
            readme_content = f"# Repository\n\nInitialized on {datetime.now().isoformat()}\n"
            readme_path.write_text(readme_content, encoding='utf-8')

        # Add all files and make initial commit
        await run_git_command(repo_path, ["add", "."])
        success, _, stderr = await run_git_command(repo_path, ["commit", "-m", initial_message])

        if success:
            logger.info(f"Successfully initialized git repository at {repo_path}")
            return True
        else:
            logger.warning(f"Repository initialized but initial commit failed: {stderr}")
            return True  # Repository is still usable

    except Exception as e:
        logger.error(f"Failed to initialize git repository at {repo_path}: {e}")
        return False


async def commit_changes(repo_path: Path, message: str, files: Optional[List[str]] = None) -> bool:
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
                success, _, stderr = await run_git_command(repo_path, ["add", file])
                if not success:
                    logger.warning(f"Failed to add file {file}: {stderr}")
        else:
            success, _, stderr = await run_git_command(repo_path, ["add", "-A"])
            if not success:
                logger.error(f"Failed to add files: {stderr}")
                return False

        # Check if there are changes to commit
        success, stdout, _ = await run_git_command(repo_path, ["diff", "--cached", "--quiet"])
        if success:  # No changes staged
            logger.info(f"No changes to commit in {repo_path}")
            return True

        # Commit changes
        success, _, stderr = await run_git_command(repo_path, ["commit", "-m", message])
        if success:
            logger.info(f"Successfully committed changes to {repo_path}")
            return True
        else:
            logger.error(f"Failed to commit changes: {stderr}")
            return False

    except Exception as e:
        logger.error(f"Failed to commit changes to {repo_path}: {e}")
        return False


async def clone_repository(repo_url: str, target_path: Path, branch: Optional[str] = None) -> bool:
    """
    Clone a git repository.

    Args:
        repo_url: URL of the repository to clone
        target_path: Where to clone the repository
        branch: Specific branch to clone (None for default)

    Returns:
        True if successful, False otherwise
    """
    try:
        # Create parent directory if it doesn't exist
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Build clone command
        clone_cmd = ["clone"]

        if branch:
            clone_cmd.extend(["--branch", branch, "--single-branch"])

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
            logger.info(f"Successfully cloned repository to {target_path}")
            return True
        else:
            logger.error(f"Failed to clone repository: {stderr.decode()}")
            return False

    except Exception as e:
        logger.error(f"Failed to clone repository from {repo_url}: {e}")
        return False


async def pull_changes(repo_path: Path, branch: Optional[str] = None) -> bool:
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
            success, _, stderr = await run_git_command(repo_path, ["checkout", branch])
            if not success:
                logger.warning(f"Failed to checkout branch {branch}: {stderr}")

        # Pull changes
        success, stdout, stderr = await run_git_command(repo_path, ["pull"])

        if success:
            logger.info(f"Successfully pulled changes for {repo_path}")
            return True
        else:
            logger.error(f"Failed to pull changes: {stderr}")
            return False

    except Exception as e:
        logger.error(f"Failed to pull changes for {repo_path}: {e}")
        return False

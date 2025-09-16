"""
Git status and history operations for repositories.

This module handles git status checking, history retrieval, and file content
operations for any git repository.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from .operations import run_git_command, GitCommit

logger = logging.getLogger(__name__)


async def get_repository_status(repo_path: Path) -> Dict[str, Any]:
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
        success, branch, _ = await run_git_command(repo_path, ["branch", "--show-current"])
        current_branch = branch if success else "unknown"

        # Get status
        success, status_output, _ = await run_git_command(repo_path, ["status", "--porcelain"])

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
        success, commit_info, _ = await run_git_command(
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


async def get_file_history(repo_path: Path, file_path: str, limit: int = 50) -> List[GitCommit]:
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
        success, history_output, stderr = await run_git_command(
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


async def get_file_content_at_commit(repo_path: Path, file_path: str, commit_hash: str) -> Optional[str]:
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

        success, content, stderr = await run_git_command(
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

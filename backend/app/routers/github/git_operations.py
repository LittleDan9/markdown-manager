"""Git operations for local documents and repositories."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.github.filesystem import github_filesystem_service
from pathlib import Path

router = APIRouter()


class GitCommitRequest(BaseModel):
    """Request schema for git commit operation."""
    message: str = Field(..., description="Commit message")
    files: Optional[List[str]] = Field(None, description="Specific files to commit (None for all staged)")


class GitCommitResponse(BaseModel):
    """Response schema for git commit operation."""
    success: bool
    commit_hash: str
    message: str
    files_committed: List[str]


class GitStashRequest(BaseModel):
    """Request schema for git stash operation."""
    message: Optional[str] = Field(None, description="Stash message")
    include_untracked: bool = Field(False, description="Include untracked files")


class GitStashResponse(BaseModel):
    """Response schema for git stash operation."""
    success: bool
    stash_id: str
    message: str
    files_stashed: List[str]


class GitBranchRequest(BaseModel):
    """Request schema for creating a new branch."""
    branch_name: str = Field(..., description="Name of the new branch")
    base_branch: Optional[str] = Field(None, description="Base branch (current branch if None)")


class GitBranchResponse(BaseModel):
    """Response schema for branch operations."""
    success: bool
    branch_name: str
    message: str
    current_branch: str


class GitHistoryResponse(BaseModel):
    """Response schema for git history."""
    commits: List[dict]
    current_branch: str
    total_commits: int


async def _get_repository_path(user_id: int, repository_id: int) -> Path:
    """Get the local repository path for a user's repository."""
    # For now, we'll determine the path based on repository structure
    # This is a simplified approach - in production, you'd want to look up
    # the actual repository data to get account_id and repo_name
    
    # You would need to implement logic to:
    # 1. Look up repository by ID
    # 2. Get account_id and repo_name
    # 3. Construct the path
    
    # For demonstration, using a placeholder pattern
    # In real implementation, fetch repository details from database
    
    # This is a placeholder - you'd need actual repository lookup
    # repo_path = base_path / "github" / str(account_id) / repo_name
    
    # For now, return a generic path that would need proper implementation
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Repository path resolution not yet implemented - needs database lookup"
    )


@router.post("/repositories/{repository_id}/commit", response_model=GitCommitResponse)
async def commit_changes(
    repository_id: int,
    commit_request: GitCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GitCommitResponse:
    """Commit changes to a repository."""
    try:
        repo_path = await _get_repository_path(current_user.id, repository_id)
        
        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found locally"
            )
        
        # Add files to staging if specified
        if commit_request.files:
            for file_path in commit_request.files:
                success, stdout, stderr = await github_filesystem_service._run_git_command(
                    repo_path, ["add", file_path]
                )
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to stage file {file_path}: {stderr}"
                    )
        else:
            # Stage all modified files
            success, stdout, stderr = await github_filesystem_service._run_git_command(
                repo_path, ["add", "-A"]
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to stage files: {stderr}"
                )
        
        # Commit the changes
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path, ["commit", "-m", commit_request.message]
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to commit: {stderr}"
            )
        
        # Get the commit hash
        success, commit_hash, _ = await github_filesystem_service._run_git_command(
            repo_path, ["rev-parse", "HEAD"]
        )
        
        commit_hash = commit_hash.strip() if success else "unknown"
        
        # Get list of files in the commit
        success, file_list, _ = await github_filesystem_service._run_git_command(
            repo_path, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]
        )
        
        files_committed = file_list.strip().split('\n') if success and file_list.strip() else []
        
        return GitCommitResponse(
            success=True,
            commit_hash=commit_hash,
            message=f"Successfully committed changes: {commit_request.message}",
            files_committed=files_committed
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit changes: {str(e)}"
        )


@router.post("/repositories/{repository_id}/stash", response_model=GitStashResponse)
async def stash_changes(
    repository_id: int,
    stash_request: GitStashRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GitStashResponse:
    """Stash uncommitted changes."""
    try:
        repo_path = await _get_repository_path(current_user.id, repository_id)
        
        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found locally"
            )
        
        # Build stash command
        stash_cmd = ["stash", "push"]
        
        if stash_request.message:
            stash_cmd.extend(["-m", stash_request.message])
        
        if stash_request.include_untracked:
            stash_cmd.append("-u")
        
        # Execute stash command
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path, stash_cmd
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to stash changes: {stderr}"
            )
        
        # Get stash list to find the stash ID
        success, stash_list, _ = await github_filesystem_service._run_git_command(
            repo_path, ["stash", "list", "-1"]
        )
        
        stash_id = stash_list.strip().split(':')[0] if success and stash_list.strip() else "stash@{0}"
        
        return GitStashResponse(
            success=True,
            stash_id=stash_id,
            message=f"Successfully stashed changes",
            files_stashed=[]  # Would need additional command to get stashed files
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stash changes: {str(e)}"
        )


@router.post("/repositories/{repository_id}/branches", response_model=GitBranchResponse)
async def create_branch(
    repository_id: int,
    branch_request: GitBranchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GitBranchResponse:
    """Create a new git branch."""
    try:
        repo_path = await _get_repository_path(current_user.id, repository_id)
        
        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found locally"
            )
        
        # Create new branch
        create_cmd = ["checkout", "-b", branch_request.branch_name]
        if branch_request.base_branch:
            create_cmd.append(branch_request.base_branch)
        
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path, create_cmd
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create branch: {stderr}"
            )
        
        # Get current branch to confirm
        success, current_branch, _ = await github_filesystem_service._run_git_command(
            repo_path, ["branch", "--show-current"]
        )
        
        current_branch = current_branch.strip() if success else branch_request.branch_name
        
        return GitBranchResponse(
            success=True,
            branch_name=branch_request.branch_name,
            message=f"Successfully created and switched to branch '{branch_request.branch_name}'",
            current_branch=current_branch
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create branch: {str(e)}"
        )


@router.get("/repositories/{repository_id}/history", response_model=GitHistoryResponse)
async def get_git_history(
    repository_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GitHistoryResponse:
    """Get git commit history for a repository."""
    try:
        repo_path = await _get_repository_path(current_user.id, repository_id)
        
        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found locally"
            )
        
        # Get current branch
        success, current_branch, _ = await github_filesystem_service._run_git_command(
            repo_path, ["branch", "--show-current"]
        )
        current_branch = current_branch.strip() if success else "unknown"
        
        # Get commit history
        success, history_output, stderr = await github_filesystem_service._run_git_command(
            repo_path,
            ["log", f"--max-count={limit}", "--format=%H|%s|%an|%ai|%ae"]
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get history: {stderr}"
            )
        
        commits = []
        for line in history_output.split('\n'):
            if line.strip():
                parts = line.split('|', 4)
                if len(parts) == 5:
                    commits.append({
                        "hash": parts[0],
                        "message": parts[1],
                        "author": parts[2],
                        "date": parts[3],
                        "email": parts[4]
                    })
        
        return GitHistoryResponse(
            commits=commits,
            current_branch=current_branch,
            total_commits=len(commits)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get git history: {str(e)}"
        )
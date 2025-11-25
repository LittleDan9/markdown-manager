"""GitHub Pull Request endpoints."""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud.github_crud import GitHubCRUD
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubPRCreateRequest,
    GitHubPRResponse,
    GitHubPRListResponse
)
from app.services.github.pull_requests import github_pr_service

router = APIRouter()
github_crud = GitHubCRUD()


@router.post("/repositories/{repo_id}/pull-requests", response_model=GitHubPRResponse)
async def create_pull_request(
    repo_id: int,
    pr_request: GitHubPRCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a pull request for a repository."""

    # Get repository and verify access
    repository = await github_crud.get_repository(db, repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify account ownership
    if repository.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Create pull request
    owner, repo_name = repository.repo_full_name.split("/", 1)

    pr_data = await github_pr_service.create_pull_request(
        access_token=repository.account.access_token,
        owner=owner,
        repo=repo_name,
        title=pr_request.title,
        body=pr_request.body,
        head_branch=pr_request.head_branch,
        base_branch=pr_request.base_branch
    )

    return GitHubPRResponse(
        number=pr_data["number"],
        title=pr_data["title"],
        body=pr_data["body"],
        state=pr_data["state"],
        html_url=pr_data["html_url"],
        head_branch=pr_data["head"]["ref"],
        base_branch=pr_data["base"]["ref"],
        created_at=pr_data["created_at"]
    )


@router.get("/repositories/{repo_id}/pull-requests", response_model=List[GitHubPRListResponse])
async def get_pull_requests(
    repo_id: int,
    state: str = "open",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get pull requests for a repository."""

    # Get repository and verify access
    repository = await github_crud.get_repository(db, repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify account ownership
    if repository.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get pull requests
    owner, repo_name = repository.repo_full_name.split("/", 1)

    prs = await github_pr_service.get_pull_requests(
        access_token=repository.account.access_token,
        owner=owner,
        repo=repo_name,
        state=state
    )

    return [
        GitHubPRListResponse(
            number=pr["number"],
            title=pr["title"],
            state=pr["state"],
            html_url=pr["html_url"],
            created_at=pr["created_at"],
            updated_at=pr["updated_at"],
            user_login=pr["user"]["login"],
            user_avatar=pr["user"]["avatar_url"]
        )
        for pr in prs
    ]

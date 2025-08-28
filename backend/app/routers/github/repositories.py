"""GitHub repositories management endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import GitHubRepository, GitHubRepositoryResponse
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


@router.get("/", response_model=List[GitHubRepositoryResponse])
async def list_repositories(
    account_id: int = Query(None, description="GitHub account ID (optional - returns all if not specified)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepositoryResponse]:
    """List repositories for a GitHub account or all accounts."""
    github_crud = GitHubCRUD()

    if account_id:
        # Get repositories for specific account
        account = await github_crud.get_account(db, account_id)
        if not account or account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )
        repositories = await github_crud.get_account_repositories(db, account_id)
    else:
        # Get repositories for all user's GitHub accounts
        accounts = await github_crud.get_user_accounts(db, current_user.id)
        repositories = []
        for account in accounts:
            account_repos = await github_crud.get_account_repositories(db, account.id)
            repositories.extend(account_repos)

    return [GitHubRepositoryResponse.from_repo(repo) for repo in repositories]


@router.post("/sync", response_model=List[GitHubRepository])
async def sync_repositories(
    account_id: int = Query(..., description="GitHub account ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepository]:
    """Sync repositories from GitHub."""
    github_crud = GitHubCRUD()

    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    # Fetch repositories from GitHub
    github_repos = await github_service.get_user_repositories(account.access_token)

    synced_repos = []
    for repo_data in github_repos:
        # Check if repository already exists
        existing_repo = await github_crud.get_repository_by_github_id(
            db, repo_data["id"]
        )

        if existing_repo:
            # Update existing repository
            update_data = {
                "repo_full_name": repo_data["full_name"],
                "repo_name": repo_data["name"],
                "repo_owner": repo_data["owner"]["login"],
                "description": repo_data.get("description"),
                "default_branch": repo_data.get("default_branch", "main"),
                "is_private": repo_data.get("private", False),
            }
            repo = await github_crud.update_repository(db, existing_repo.id, update_data)
        else:
            # Create new repository
            repo_create_data = {
                "account_id": account_id,
                "github_repo_id": repo_data["id"],
                "repo_full_name": repo_data["full_name"],
                "repo_name": repo_data["name"],
                "repo_owner": repo_data["owner"]["login"],
                "description": repo_data.get("description"),
                "default_branch": repo_data.get("default_branch", "main"),
                "is_private": repo_data.get("private", False),
                "is_enabled": True,
            }
            repo = await github_crud.create_repository(db, repo_create_data)

        synced_repos.append(GitHubRepository.model_validate(repo))

    # Update the account's last_sync timestamp
    from datetime import datetime
    await github_crud.update_account(db, account_id, {
        "last_sync": datetime.utcnow()
    })

    return synced_repos


@router.get("/{repo_id}/branches")
async def get_repository_branches(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """Get branches for a repository."""
    github_crud = GitHubCRUD()

    repo = await github_crud.get_repository(db, repo_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get branches from GitHub API
    branches = await github_service.get_branches(
        repo.account.access_token, repo.repo_owner, repo.repo_name
    )

    return [
        {
            "name": branch["name"],
            "commit_sha": branch["commit"]["sha"],
            "is_default": branch["name"] == repo.default_branch
        }
        for branch in branches
    ]

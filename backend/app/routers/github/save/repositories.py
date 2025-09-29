"""Repository management for GitHub save operations."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.crud.github_crud import GitHubCRUD
from app.services.github_service import GitHubService
from .schemas import GitHubRepositoryListItem, RepositoryStatusResponse
from .validators import validate_repository_access

router = APIRouter()
github_service = GitHubService()


@router.get("/user-repositories")
async def get_user_repositories_for_save(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepositoryListItem]:
    """Get user's selected repositories available for saving documents."""
    github_crud = GitHubCRUD()

    # Get all user GitHub accounts
    accounts = await github_crud.get_user_accounts(db, current_user.id)

    if not accounts:
        return []

    repositories = []

    # Import the repository selector to get selected repositories
    from app.services.github.repository_selector import GitHubRepositorySelector
    repository_selector = GitHubRepositorySelector()

    for account in accounts:
        # Get only selected repositories for this account
        selected_repos = await repository_selector.get_selected_repositories(
            db, account.id, active_only=True
        )

        for selection in selected_repos:
            # Get the corresponding GitHubRepository record if it exists
            from sqlalchemy import select, and_
            from app.models.github_models import GitHubRepository

            repo_query = await db.execute(
                select(GitHubRepository).where(
                    and_(
                        GitHubRepository.account_id == account.id,
                        GitHubRepository.github_repo_id == selection.github_repo_id
                    )
                )
            )
            repo = repo_query.scalar_one_or_none()

            # Use data from selection record, fallback to repo record if available
            repositories.append(GitHubRepositoryListItem(
                id=repo.id if repo else selection.id,  # Use internal repo ID if available
                name=selection.repo_name,
                full_name=selection.repo_full_name,
                owner=selection.repo_owner,
                is_private=selection.is_private,
                default_branch=selection.default_branch,
                account_username=account.username
            ))

    return repositories


@router.get("/repositories/{repository_id}/branches")
async def get_repository_branches_for_save(
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Get branches for a repository."""
    github_crud = GitHubCRUD()

    # Validate repository access
    repository = await validate_repository_access(github_crud, db, repository_id, current_user)

    # Get branches from GitHub API
    try:
        branches = await github_service.get_repository_branches(
            repository.account.access_token,
            repository.repo_owner,
            repository.repo_name
        )
        return branches
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get repository branches: {str(e)}"
        )


@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)
async def get_repository_status(
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryStatusResponse:
    """Get the current git status of a repository."""
    from app.services.github.filesystem import github_filesystem_service
    from pathlib import Path
    from app.configs.settings import settings

    github_crud = GitHubCRUD()

    # Validate repository access
    repository = await validate_repository_access(github_crud, db, repository_id, current_user)

    # Construct repository path
    repo_path = (
        Path(settings.markdown_storage_root)
        / str(current_user.id)
        / "github"
        / str(repository.account_id)
        / repository.repo_name
    )

    if not repo_path.exists() or not (repo_path / ".git").exists():
        return RepositoryStatusResponse(
            branch="unknown",
            staged_files=[],
            modified_files=[],
            untracked_files=[],
            has_changes=False,
            needs_attention=False,
            status_message="Repository not cloned locally"
        )

    # Get repository status
    status = await github_filesystem_service.get_repository_status(repo_path)

    if "error" in status:
        return RepositoryStatusResponse(
            branch="unknown",
            staged_files=[],
            modified_files=[],
            untracked_files=[],
            has_changes=False,
            needs_attention=False,
            status_message=f"Error getting status: {status['error']}"
        )

    # Determine if repository needs attention before branch operations
    needs_attention = status.get("has_changes", False)

    status_message = "Repository is clean"
    if needs_attention:
        status_message = "Repository has uncommitted changes"

    return RepositoryStatusResponse(
        branch=status.get("branch", "unknown"),
        staged_files=status.get("staged_files", []),
        modified_files=status.get("modified_files", []),
        untracked_files=status.get("untracked_files", []),
        has_changes=status.get("has_changes", False),
        needs_attention=needs_attention,
        status_message=status_message
    )
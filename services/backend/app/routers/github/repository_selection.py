"""GitHub repository selection API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.models.github_models import GitHubRepository
from app.services.github.repository_selector import GitHubRepositorySelector
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
repository_selector = GitHubRepositorySelector()


class RepositorySearchParams(BaseModel):
    """Parameters for repository search."""
    search_query: Optional[str] = Field(None, description="Search query")
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")
    include_private: bool = Field(True, description="Include private repositories")
    organization: Optional[str] = Field(None, description="Filter by organization")
    language: Optional[str] = Field(None, description="Filter by programming language")
    sort_by: str = Field("updated", pattern="^(updated|name|stars)$", description="Sort criteria")


class RepositorySelectionRequest(BaseModel):
    """Request to add repository selection."""
    github_repo_id: int = Field(..., description="GitHub repository ID")


class BulkRepositorySelectionRequest(BaseModel):
    """Request to add multiple repository selections."""
    github_repo_ids: List[int] = Field(..., description="List of GitHub repository IDs")


class RepositorySyncToggleRequest(BaseModel):
    """Request to toggle repository sync status."""
    sync_enabled: bool = Field(..., description="Enable or disable sync")


@router.get("/accounts/{account_id}/organizations")
async def get_organizations(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get available organizations for a GitHub account."""
    github_crud = GitHubCRUD()

    # Get the GitHub account
    github_account = await github_crud.get_account(db, account_id)
    if not github_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    # Verify account belongs to current user
    if github_account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this GitHub account"
        )

    try:
        organizations = await repository_selector.get_user_organizations(github_account)
        return {"organizations": organizations}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch organizations: {str(e)}"
        )


@router.get("/accounts/{account_id}/repositories/search")
async def search_repositories(
    account_id: int,
    search_params: RepositorySearchParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search available repositories for a GitHub account."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        results = await repository_selector.search_available_repositories(
            github_account=account,
            search_query=search_params.search_query,
            page=search_params.page,
            per_page=search_params.per_page,
            include_private=search_params.include_private,
            organization=search_params.organization,
            language=search_params.language,
            sort_by=search_params.sort_by
        )

        # Add selection status to each repository
        selected_repos = await repository_selector.get_selected_repositories(
            db, account_id, active_only=True
        )
        selected_repo_ids = {selection.github_repo_id for selection in selected_repos}

        for repo in results["repositories"]:
            repo["is_selected"] = repo["id"] in selected_repo_ids

        return results

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search repositories: {str(e)}"
        )


@router.get("/accounts/{account_id}/repositories/selected")
async def get_selected_repositories(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's selected repositories for an account."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        selections = await repository_selector.get_selected_repositories(
            db, account_id, active_only=True
        )

        # Get the corresponding GitHubRepository records for each selection
        selection_data = []
        for selection in selections:
            # Try to find the corresponding GitHubRepository
            repo_query = await db.execute(
                select(GitHubRepository).where(
                    and_(
                        GitHubRepository.account_id == account_id,
                        GitHubRepository.github_repo_id == selection.github_repo_id
                    )
                )
            )
            repo = repo_query.scalar_one_or_none()

            selection_data.append({
                "id": selection.id,
                "github_repo_id": selection.github_repo_id,
                "internal_repo_id": repo.id if repo else None,  # Add internal repo ID if exists
                "repo_name": selection.repo_name,
                "repo_full_name": selection.repo_full_name,
                "repo_owner": selection.repo_owner,
                "is_private": selection.is_private,
                "description": selection.description,
                "language": selection.language,
                "default_branch": selection.default_branch,
                "sync_enabled": selection.sync_enabled,
                "selected_at": selection.selected_at.isoformat(),
                "last_synced_at": selection.last_synced_at.isoformat() if selection.last_synced_at else None
            })

        return {
            "selections": selection_data,
            "total_count": len(selections)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get selected repositories: {str(e)}"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get selected repositories: {str(e)}"
        )


@router.post("/accounts/{account_id}/repositories/selected")
async def add_repository_selection(
    account_id: int,
    request: RepositorySelectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a repository to user's selections."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        # First, get repository data from GitHub API
        github_repos = await repository_selector.github_api.get_user_repositories(
            access_token=account.access_token,
            per_page=100
        )

        # Find the specific repository
        repo_data = None
        for repo in github_repos:
            if repo['id'] == request.github_repo_id:
                repo_data = repo
                break

        if not repo_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found or not accessible"
            )

        selection = await repository_selector.add_repository_selection(
            db, account_id, repo_data
        )

        # Auto-clone repository to workspace after selection
        clone_success = False
        clone_message = ""

        try:
            from app.services.storage.user_storage_service import UserStorageService

            user_storage_service = UserStorageService()

            # Check if repository is already cloned as a valid git repository
            github_dir = user_storage_service.filesystem.get_github_directory(current_user.id)
            repo_dir = github_dir / str(account_id) / repo_data["name"]

            if not repo_dir.exists() or not (repo_dir / ".git").exists():
                # Directory doesn't exist or is not a valid git repository - clone it
                # Construct clone URL with access token for private repos
                clone_url = f"https://{account.access_token}@github.com/{repo_data['full_name']}.git"

                clone_success = await user_storage_service.clone_github_repo(
                    user_id=current_user.id,
                    account_id=account_id,
                    repo_name=repo_data["name"],
                    repo_url=clone_url,
                    branch=repo_data.get("default_branch")
                )

                if clone_success:
                    clone_message = "Repository cloned to workspace"

                    # Create GitHubRepository record for tracking
                    try:
                        existing_repo = await github_crud.get_repository_by_github_id(
                            db, repo_data["id"]
                        )

                        if not existing_repo:
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
                            await github_crud.create_repository(db, repo_create_data)
                    except Exception as repo_create_error:
                        # Don't fail the entire operation if repo record creation fails
                        print(f"Warning: Failed to create GitHubRepository record: {repo_create_error}")
                else:
                    clone_message = "Repository added but clone failed"
            else:
                clone_success = True
                clone_message = "Repository already cloned in workspace"

        except Exception as clone_error:
            # Don't fail the entire operation if cloning fails
            clone_message = f"Repository added but clone failed: {str(clone_error)}"
            print(f"Clone error for {repo_data['full_name']}: {clone_error}")

        return {
            "message": "Repository added to workspace",
            "clone_success": clone_success,
            "clone_message": clone_message,
            "selection": {
                "id": selection.id,
                "repo_full_name": selection.repo_full_name,
                "selected_at": selection.selected_at.isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add repository selection: {str(e)}"
        )


@router.post("/accounts/{account_id}/repositories/selected/bulk")
async def bulk_add_repository_selections(
    account_id: int,
    request: BulkRepositorySelectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add multiple repositories to user's selections."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        results = await repository_selector.bulk_add_repository_selections(
            db, account, request.github_repo_ids
        )

        return {
            "message": f"Added {results['added_count']} repositories to selections",
            "results": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk add repository selections: {str(e)}"
        )


@router.delete("/accounts/{account_id}/repositories/selected/{repo_id}")
async def remove_repository_selection(
    account_id: int,
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a repository from user's selections."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        success = await repository_selector.remove_repository_selection(
            db, account_id, repo_id
        )

        if success:
            return {"message": "Repository removed from selections"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository selection not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove repository selection: {str(e)}"
        )


@router.patch("/accounts/{account_id}/repositories/selected/{repo_id}/sync")
async def toggle_repository_sync(
    account_id: int,
    repo_id: int,
    request: RepositorySyncToggleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable sync for a selected repository."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        success = await repository_selector.update_repository_sync_status(
            db, account_id, repo_id, request.sync_enabled
        )

        if success:
            status_text = "enabled" if request.sync_enabled else "disabled"
            return {"message": f"Repository sync {status_text}"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository selection not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle repository sync: {str(e)}"
        )


@router.get("/accounts/{account_id}/repositories/statistics")
async def get_repository_statistics(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get statistics about repository selections."""
    github_crud = GitHubCRUD()

    # Verify account ownership
    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    try:
        stats = await repository_selector.get_repository_statistics(db, account_id)
        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repository statistics: {str(e)}"
        )
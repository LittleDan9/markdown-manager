"""Unified GitHub Repository Management - Simplified API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.unified_document import unified_document_service
from app.services.github.repository_selector import GitHubRepositorySelector
from app.crud.github_crud import GitHubCRUD

router = APIRouter()

# Use existing services
repository_selector = GitHubRepositorySelector()
github_crud = GitHubCRUD()


class UnifiedRepositoryResponse(BaseModel):
    """Unified repository response model."""
    id: int
    full_name: str
    name: str
    owner: str
    description: Optional[str]
    private: bool
    language: Optional[str]
    stargazers_count: int
    updated_at: str
    default_branch: str
    is_selected: bool


class UnifiedRepositoryListResponse(BaseModel):
    """Response for repository list."""
    repositories: List[UnifiedRepositoryResponse]
    total_count: int
    selected_count: int


class UnifiedRepositoryStatistics(BaseModel):
    """Repository statistics for unified approach."""
    total_available: int
    total_selected: int
    languages: List[str]


@router.get("/accounts/{account_id}/repositories")
async def get_unified_repositories(
    account_id: int,
    search: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedRepositoryListResponse:
    """
    Get repositories for GitHub account using unified approach.

    Simplified version of complex repository selection API.
    Returns both available and selected repositories in single call.
    """
    try:
        # Get account and validate ownership
        account = await github_crud.get_github_account_by_id(db, account_id)
        if not account or account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )

        # Get repositories using existing repository selector
        search_params = {
            "search_query": search or "",
            "page": 1,
            "per_page": limit,
            "include_private": True,
            "organization": "",
            "language": "",
            "sort_by": "updated"
        }

        repositories_data = await repository_selector.search_repositories(
            account_id, search_params, current_user.id, db
        )

        # Format response
        repositories = []
        for repo in repositories_data.get("repositories", []):
            repositories.append(UnifiedRepositoryResponse(
                id=repo["id"],
                full_name=repo["full_name"],
                name=repo["name"],
                owner=repo["owner"]["login"],
                description=repo.get("description"),
                private=repo["private"],
                language=repo.get("language"),
                stargazers_count=repo.get("stargazers_count", 0),
                updated_at=repo["updated_at"],
                default_branch=repo.get("default_branch", "main"),
                is_selected=repo.get("is_selected", False)
            ))

        selected_count = len([r for r in repositories if r.is_selected])

        return UnifiedRepositoryListResponse(
            repositories=repositories,
            total_count=len(repositories),
            selected_count=selected_count
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repositories: {str(e)}"
        )


@router.post("/accounts/{account_id}/repositories/{repository_id}")
async def add_unified_repository(
    account_id: int,
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Add repository to sync using unified approach.

    Simplified version that integrates with unified document service.
    """
    try:
        github_service = GitHubService()

        # Validate account ownership
        account = await github_service.get_github_account(db, account_id, current_user.id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )

        # Add repository selection
        await github_service.add_repository_selection(
            db, account_id, repository_id, current_user.id
        )

        # Sync with unified document service (create document entries)
        await unified_document_service.sync_github_repository(
            db=db,
            user_id=current_user.id,
            account_id=account_id,
            repository_id=repository_id
        )

        return {"message": "Repository added to sync", "repository_id": repository_id}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add repository: {str(e)}"
        )


@router.delete("/accounts/{account_id}/repositories/{repository_id}")
async def remove_unified_repository(
    account_id: int,
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove repository from sync using unified approach.

    Also removes associated documents from unified document service.
    """
    try:
        github_service = GitHubService()

        # Validate account ownership
        account = await github_service.get_github_account(db, account_id, current_user.id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )

        # Remove repository selection
        await github_service.remove_repository_selection(
            db, account_id, repository_id, current_user.id
        )

        # Remove documents from unified service
        await unified_document_service.remove_github_repository_documents(
            db=db,
            user_id=current_user.id,
            repository_id=repository_id
        )

        return {"message": "Repository removed from sync", "repository_id": repository_id}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove repository: {str(e)}"
        )


@router.get("/accounts/{account_id}/repositories/statistics")
async def get_unified_repository_statistics(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnifiedRepositoryStatistics:
    """
    Get repository statistics using unified approach.

    Simplified statistics compared to complex breakdown.
    """
    try:
        github_service = GitHubService()

        # Validate account ownership
        account = await github_service.get_github_account(db, account_id, current_user.id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )

        # Get statistics
        stats = await github_service.get_repository_statistics(db, account_id)

        return UnifiedRepositoryStatistics(
            total_available=stats.get("total_available", 0),
            total_selected=stats.get("total_selected", 0),
            languages=stats.get("languages", [])
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )
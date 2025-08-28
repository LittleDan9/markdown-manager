"""GitHub synchronization endpoints."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud.document import DocumentCRUD
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubPullRequest,
    GitHubPullResponse,
    GitHubConflictResolution,
    GitHubConflictResponse
)
from app.services.github_sync_service import github_sync_service

router = APIRouter()
document_crud = DocumentCRUD()


@router.post("/documents/{document_id}/pull", response_model=GitHubPullResponse)
async def pull_github_changes(
    document_id: int,
    pull_request: GitHubPullRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Pull changes from GitHub repository."""

    # Get document and verify ownership
    document = await document_crud.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Pull remote changes
    result = await github_sync_service.pull_remote_changes(
        db=db,
        document=document,
        user_id=current_user.id,
        force_overwrite=pull_request.force_overwrite
    )

    return GitHubPullResponse(**result)


@router.post("/documents/{document_id}/resolve-conflicts", response_model=GitHubConflictResponse)
async def resolve_conflicts(
    document_id: int,
    conflict_resolution: GitHubConflictResolution,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Resolve merge conflicts with user-provided content."""

    # Get document and verify ownership
    document = await document_crud.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Resolve conflicts
    result = await github_sync_service.resolve_conflicts(
        db=db,
        document=document,
        resolved_content=conflict_resolution.resolved_content,
        user_id=current_user.id
    )

    return GitHubConflictResponse(**result)


@router.get("/documents/{document_id}/sync-history")
async def get_sync_history(
    document_id: int,
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get synchronization history for a document."""

    # Get document and verify ownership
    document = await document_crud.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id:
        return []

    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    history = await github_crud.get_document_sync_history(
        db, document_id=document_id, limit=limit
    )

    return history

"""GitHub synchronization and import endpoints."""
from datetime import datetime
from typing import List, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.routers.documents.helpers import get_document_response
from app.schemas.document import Document
from app.schemas.github import (
    GitHubImportRequest,
    GitHubStatusResponse,
    GitHubSyncHistoryEntry,
    GitHubPullRequest,
    GitHubPullResponse,
    GitHubConflictResolution,
    GitHubConflictResponse
)
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


@router.post("/import", response_model=Document)
async def import_file_from_github(
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    """Import a markdown file from GitHub."""
    from app.crud.document import DocumentCRUD
    from app.crud.category import get_category_by_name, create_category
    from app.schemas.category import CategoryCreate

    github_crud = GitHubCRUD()
    document_crud = DocumentCRUD()

    repo = await github_crud.get_repository(db, import_request.repository_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get file content from GitHub
    branch = import_request.branch or repo.default_branch or "main"
    content, sha = await github_service.get_file_content(
        repo.account.access_token,
        repo.repo_owner,
        repo.repo_name,
        import_request.file_path,
        ref=branch
    )

    # Ensure we have a valid category_id - create repo/branch category if needed
    category_id = import_request.category_id
    if not category_id:
        category_name = f"{repo.repo_name}/{branch}"
        category = await get_category_by_name(db, category_name, current_user.id)
        if not category:
            category_create = CategoryCreate(name=category_name)
            category = await create_category(db, category_create, current_user.id)
        category_id = category.id

    # Create document
    document_name = import_request.document_name or import_request.file_path.split("/")[-1]

    # Remove file extension from document name if present
    if document_name.endswith('.md'):
        document_name = document_name[:-3]

    document = await document_crud.create(
        db=db,
        user_id=current_user.id,
        name=document_name,
        content=content,
        category_id=category_id,
    )

    # Set GitHub metadata for Phase 3 sync functionality
    document.github_repository_id = import_request.repository_id
    document.github_file_path = import_request.file_path
    document.github_branch = import_request.branch or repo.default_branch or "main"
    document.github_sha = sha
    # Use content hash for local comparison, not GitHub SHA
    document.local_sha = github_service.generate_content_hash(content)
    document.github_sync_status = "synced"
    document.last_github_sync_at = datetime.utcnow()

    await db.commit()
    await db.refresh(document)

    # Use shared function to return consistent document format
    return await get_document_response(db, document.id, current_user)


async def _validate_github_document(
    db: AsyncSession,
    document_id: int,
    current_user: User
):
    """Validate document exists and is linked to GitHub."""
    from app.crud.document import DocumentCRUD
    
    document_crud = DocumentCRUD()
    
    # Get document and verify ownership
    document = await document_crud.get(db, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )
    
    return document


async def _fix_legacy_sha_and_check_local_changes(
    db: AsyncSession,
    document,
    github_service: GitHubService
) -> tuple[bool, str]:
    """Fix legacy SHA format and check for local changes."""
    # Generate current content hash
    current_content_hash = github_service.generate_content_hash(document.content)

    # Fix legacy documents where local_sha was set to GitHub SHA instead of content hash
    # GitHub SHAs are 40 chars, content hashes are 64 chars
    if document.local_sha and len(document.local_sha) == 40:
        document.local_sha = github_service.generate_content_hash(document.content)
        await db.commit()

    has_local_changes = current_content_hash != (document.local_sha or "")
    return has_local_changes, current_content_hash


async def _check_remote_changes(
    db: AsyncSession,
    document,
    github_crud: GitHubCRUD,
    github_service: GitHubService
) -> tuple[bool, str | None, Any]:
    """Check for remote changes and get repository info."""
    has_remote_changes = False
    remote_content = None
    repository = None

    try:
        repository = await github_crud.get_repository(db, document.github_repository_id)
        if repository and repository.account:
            # Get current file content from GitHub
            try:
                remote_content, remote_sha = await github_service.get_file_content(
                    repository.account.access_token,
                    repository.repo_owner,
                    repository.repo_name,
                    document.github_file_path or "",
                    ref=document.github_branch or "main"
                )
                # Check if remote content differs from what we have locally
                has_remote_changes = remote_sha != document.github_sha
            except Exception:
                # File might not exist remotely or other error
                has_remote_changes = False
    except Exception:
        # Repository access error
        pass
    
    return has_remote_changes, remote_content, repository


def _determine_sync_status(has_local_changes: bool, has_remote_changes: bool) -> str:
    """Determine overall sync status based on local and remote changes."""
    if has_local_changes and has_remote_changes:
        return "conflict"
    elif has_local_changes:
        return "local_changes"
    elif has_remote_changes:
        return "remote_changes"
    else:
        return "synced"


async def _update_document_sync_status(
    db: AsyncSession,
    document,
    sync_status: str
) -> None:
    """Update document sync status if it changed."""
    if document.github_sync_status != sync_status:
        document.github_sync_status = sync_status
        await db.commit()


@router.get("/documents/{document_id}/status", response_model=GitHubStatusResponse)
async def get_document_github_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubStatusResponse:
    """Get GitHub sync status for a document."""
    github_crud = GitHubCRUD()

    # Validate document and GitHub linkage
    document = await _validate_github_document(db, document_id, current_user)

    # Fix legacy SHA format and check for local changes
    has_local_changes, _ = await _fix_legacy_sha_and_check_local_changes(
        db, document, github_service
    )

    # Check for remote changes and get repository info
    has_remote_changes, remote_content, repository = await _check_remote_changes(
        db, document, github_crud, github_service
    )

    # Determine overall sync status
    sync_status = _determine_sync_status(has_local_changes, has_remote_changes)

    # Update document sync status if needed
    await _update_document_sync_status(db, document, sync_status)

    return GitHubStatusResponse(
        is_github_document=True,
        sync_status=sync_status,
        has_local_changes=has_local_changes,
        has_remote_changes=has_remote_changes,
        github_repository=repository.repo_full_name if repository else None,
        github_branch=document.github_branch,
        github_file_path=document.github_file_path,
        last_sync=document.last_github_sync_at,
        status_info=document.github_status_info,
        remote_content=remote_content
    )


@router.get("/documents/{document_id}/sync-history", response_model=List[GitHubSyncHistoryEntry])
async def get_document_sync_history(
    document_id: int,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[GitHubSyncHistoryEntry]:
    """Get sync history for a document."""
    from app.crud.document import DocumentCRUD

    document_crud = DocumentCRUD()
    github_crud = GitHubCRUD()

    # Get document and verify ownership
    document = await document_crud.get(db, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )

    history = await github_crud.get_document_sync_history(db, document_id, limit)
    return [GitHubSyncHistoryEntry.model_validate(entry) for entry in history]


@router.post("/documents/{document_id}/pull", response_model=GitHubPullResponse)
async def pull_github_changes(
    document_id: int,
    pull_request: GitHubPullRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Pull changes from GitHub repository."""
    from app.crud.document import DocumentCRUD
    from app.services.github_sync_service import github_sync_service

    document_crud = DocumentCRUD()

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Resolve merge conflicts with user-provided content."""
    from app.crud.document import DocumentCRUD
    from app.services.github_sync_service import github_sync_service

    document_crud = DocumentCRUD()

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

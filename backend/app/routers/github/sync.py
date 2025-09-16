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
from app.services.github.cache import github_cache_service
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


@router.post("/import", response_model=Document)
async def import_file_from_github(
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    """Import a markdown file from GitHub repository to filesystem."""
    from app.crud.document import DocumentCRUD
    from app.crud.category import get_category_by_name, create_category
    from app.schemas.category import CategoryCreate
    from app.services.storage import UserStorage

    github_crud = GitHubCRUD()
    document_crud = DocumentCRUD()
    user_storage_service = UserStorage()

    repo = await github_crud.get_repository(db, import_request.repository_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Check if repository is cloned to filesystem
    repo_dir = user_storage_service.get_github_repo_directory(
        current_user.id, repo.account_id, repo.repo_name
    )

    if not repo_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository not cloned to filesystem. Please sync the account first."
        )

    # Ensure the requested file exists in the cloned repository
    branch = import_request.branch or repo.default_branch or "main"
    file_path = import_request.file_path.strip('/')
    repo_file_path = repo_dir / file_path

    if not repo_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_path}' not found in repository branch '{branch}'"
        )

    # Read content from filesystem
    try:
        content = await user_storage_service.read_document(
            current_user.id,
            f"github/{repo.account_id}/{repo.repo_name}/{file_path}"
        )
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Could not read file content from filesystem"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file: {str(e)}"
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

    # Create document with filesystem path
    document_name = import_request.document_name or import_request.file_path.split("/")[-1]

    # Remove file extension from document name if present
    if document_name.endswith('.md'):
        document_name = document_name[:-3]

    # Create database record pointing to filesystem location
    filesystem_path = f"github/{repo.account_id}/{repo.repo_name}/{file_path}"
    document = await document_crud.create(
        db=db,
        user_id=current_user.id,
        name=document_name,
        category_id=category_id,
        content=content,  # This will be written to filesystem
        file_path=filesystem_path,
        repository_type="github_repo",
        folder_path=f"/GitHub/{repo.repo_name}/{branch}"
    )

    # Set GitHub metadata for sync functionality
    document.github_repository_id = import_request.repository_id
    document.github_file_path = import_request.file_path
    document.github_branch = import_request.branch or repo.default_branch or "main"

    # Get SHA from git repository
    try:
        commits = await user_storage_service.get_document_history(
            current_user.id,
            f"github/{repo.account_id}/{repo.repo_name}/{file_path}",
            limit=1
        )
        if commits:
            document.github_sha = commits[0].hash
    except Exception:
        # If we can't get the git hash, generate a content hash as fallback
        document.github_sha = github_service.generate_content_hash(content)

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
    github_service: GitHubService,
    user_storage_service
) -> tuple[bool, str]:
    """Fix legacy SHA format and check for local changes."""
    # Read current content from filesystem
    current_content = await user_storage_service.read_document(
        document.user_id,
        document.file_path or ""
    )

    if current_content is None:
        # File doesn't exist on filesystem
        return True, ""  # Consider this as local changes (file missing)

    # Generate current content hash
    current_content_hash = github_service.generate_content_hash(current_content)

    # Fix legacy documents where local_sha was set to GitHub SHA instead of content hash
    # GitHub SHAs are 40 chars, content hashes are 64 chars
    if document.local_sha and len(document.local_sha) == 40:
        document.local_sha = current_content_hash
        await db.commit()

    has_local_changes = current_content_hash != (document.local_sha or "")
    return has_local_changes, current_content_hash


async def _check_remote_changes(
    db: AsyncSession,
    document,
    github_crud: GitHubCRUD,
    github_service: GitHubService,
    force_refresh: bool = False
) -> tuple[bool, str | None, Any]:
    """Check for remote changes and get repository info."""
    has_remote_changes = False
    remote_content = None
    repository = None

    try:
        repository = await github_crud.get_repository(db, document.github_repository_id)
        if repository and repository.account:
            # Get current file content from GitHub with caching
            try:
                async def fetch_remote_content():
                    content, sha = await github_service.get_file_content(
                        repository.account.access_token,
                        repository.repo_owner,
                        repository.repo_name,
                        document.github_file_path or "",
                        ref=document.github_branch or "main"
                    )
                    return {"content": content, "sha": sha}

                cached_result = await github_cache_service.get_or_fetch_file_content(
                    document.github_repository_id,
                    document.github_file_path or "",
                    document.github_branch or "main",
                    fetch_remote_content,
                    force_refresh=force_refresh
                )

                remote_content = cached_result["content"]
                remote_sha = cached_result["sha"]

                # Debug SHA comparison
                print("=== Status Check SHA Comparison ===")
                print(f"  Document ID: {document.id}")
                print(f"  Local github_sha: {document.github_sha}")
                print(f"  Remote SHA: {remote_sha}")
                print(f"  Force refresh: {force_refresh}")

                repo_id = document.github_repository_id
                file_path = document.github_file_path or ''
                branch = document.github_branch or 'main'
                cache_key = f"github_file:{repo_id}:{file_path}:{branch}"
                print(f"  Cache key would be: {cache_key}")

                # Check if remote content differs from what we have locally
                # Special handling: if we just updated the document and GitHub API
                # is still returning stale data, trust our local database
                has_remote_changes = remote_sha != document.github_sha

                # Additional check: if the document was recently updated (within 30 seconds)
                # and the local SHA matches a recent commit, consider it synced
                if has_remote_changes and document.last_github_sync_at:
                    from datetime import datetime, timezone
                    time_since_sync = datetime.now(timezone.utc) - document.last_github_sync_at.replace(tzinfo=timezone.utc)
                    if time_since_sync.total_seconds() < 30:
                        print(f"  Recent sync detected ({time_since_sync.total_seconds()}s ago), trusting local state")
                        has_remote_changes = False

                print(f"  Has remote changes: {has_remote_changes}")

            except Exception as e:
                print(f"Error fetching remote content: {e}")
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
    force_refresh: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubStatusResponse:
    """Get GitHub sync status for a document."""
    print(f"Status endpoint called with: document_id={document_id}, force_refresh={force_refresh}")
    github_crud = GitHubCRUD()

    # Initialize user storage service for filesystem operations
    from app.services.storage import UserStorage
    user_storage_service = UserStorage()

    # Validate document and GitHub linkage
    document = await _validate_github_document(db, document_id, current_user)

    # Fix legacy SHA format and check for local changes
    has_local_changes, _ = await _fix_legacy_sha_and_check_local_changes(
        db, document, github_service, user_storage_service
    )

    # Check for remote changes and get repository info
    has_remote_changes, remote_content, repository = await _check_remote_changes(
        db, document, github_crud, github_service, force_refresh
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
        remote_content=remote_content,
        github_account_id=repository.account_id if repository else None
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
    """Pull changes from GitHub repository to filesystem."""
    from app.crud.document import DocumentCRUD
    from app.services.storage import UserStorage

    document_crud = DocumentCRUD()
    user_storage_service = UserStorage()

    # Get document and verify ownership
    document = await document_crud.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id or not document.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub or missing file path"
        )

    # Get repository info
    github_crud = GitHubCRUD()
    repository = await github_crud.get_repository(db, document.github_repository_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub repository not found"
        )

    try:
        # Get latest content from GitHub
        content, sha = await github_service.get_file_content(
            repository.account.access_token,
            repository.repo_owner,
            repository.repo_name,
            document.github_file_path or "",
            ref=document.github_branch or "main"
        )

        # Write content to filesystem
        await user_storage_service.write_document(
            current_user.id,
            document.file_path,
            content,
            commit_message=f"Pull changes from GitHub: {document.name}"
        )

        # Update document metadata
        document.github_sha = sha
        document.local_sha = github_service.generate_content_hash(content)
        document.github_sync_status = "synced"
        document.last_github_sync_at = datetime.utcnow()

        await db.commit()

        return GitHubPullResponse(
            success=True,
            message="Successfully pulled changes from GitHub",
            had_conflicts=False,
            changes_pulled=True,
            backup_created=False
        )

    except Exception as e:
        return GitHubPullResponse(
            success=False,
            message=f"Failed to pull changes: {str(e)}",
            had_conflicts=False,
            changes_pulled=False,
            backup_created=False
        )


@router.post("/documents/{document_id}/resolve-conflicts", response_model=GitHubConflictResponse)
async def resolve_conflicts(
    document_id: int,
    conflict_resolution: GitHubConflictResolution,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Resolve merge conflicts with user-provided content."""
    from app.crud.document import DocumentCRUD
    from app.services.storage import UserStorage

    document_crud = DocumentCRUD()
    user_storage_service = UserStorage()

    # Get document and verify ownership
    document = await document_crud.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id or not document.file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub or missing file path"
        )

    try:
        # Write resolved content to filesystem
        await user_storage_service.write_document(
            current_user.id,
            document.file_path,
            conflict_resolution.resolved_content,
            commit_message=f"Resolve conflicts for {document.name}"
        )

        # Update document metadata
        document.local_sha = github_service.generate_content_hash(conflict_resolution.resolved_content)
        document.github_sync_status = "synced"
        document.last_github_sync_at = datetime.utcnow()

        await db.commit()

        return GitHubConflictResponse(
            success=True,
            message="Conflicts resolved successfully",
            ready_to_commit=True
        )

    except Exception as e:
        return GitHubConflictResponse(
            success=False,
            message=f"Failed to resolve conflicts: {str(e)}",
            ready_to_commit=False
        )

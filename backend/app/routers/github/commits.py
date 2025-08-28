"""GitHub commit workflow endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import GitHubCommitRequest, GitHubCommitResponse
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


async def _validate_document_and_repository(
    db: AsyncSession,
    document_id: int,
    current_user: User
) -> tuple:
    """Validate document and repository access."""
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

    # Verify it's a GitHub document
    if not document.github_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )

    # Get repository and account
    repository = await github_crud.get_repository(db, document.github_repository_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub repository not found"
        )

    account = repository.account
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    return document, repository, account


def _determine_target_branch(
    commit_request: GitHubCommitRequest,
    document,
    repository
) -> str:
    """Determine the target branch for the commit."""
    target_branch = commit_request.branch or document.github_branch or repository.default_branch
    create_new_branch = commit_request.create_new_branch and bool(commit_request.new_branch_name)
    
    if create_new_branch and commit_request.new_branch_name:
        target_branch = commit_request.new_branch_name
    
    return target_branch


async def _check_for_conflicts(
    commit_request: GitHubCommitRequest,
    document,
    account,
    repository
) -> None:
    """Check for conflicts if not forcing commit."""
    if commit_request.force_commit:
        return

    try:
        # Get current file content from GitHub
        _, remote_sha = await github_service.get_file_content(
            account.access_token,
            repository.repo_owner,
            repository.repo_name,
            document.github_file_path or "",
            ref=document.github_branch or "main"
        )

        # Check if remote file has changed since last sync
        if remote_sha != document.github_sha:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Remote file has been modified since last sync. Use force_commit=true to override."
            )
    except Exception as e:
        # If we can't get the file, it might not exist, which is okay for new files
        if "not found" not in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error checking remote file status: {str(e)}"
            )


async def _perform_commit(
    commit_request: GitHubCommitRequest,
    document,
    account,
    repository,
    target_branch: str
) -> dict:
    """Perform the actual commit to GitHub."""
    # Create new branch if requested
    if commit_request.create_new_branch and commit_request.new_branch_name:
        # TODO: Implement branch creation in GitHubService
        pass

    # Commit the file
    commit_result = await github_service.commit_file(
        account.access_token,
        repository.repo_owner,
        repository.repo_name,
        document.github_file_path or "",
        document.content,
        commit_request.commit_message,
        branch=target_branch,
        sha=document.github_sha
    )
    
    return commit_result


async def _update_document_metadata(
    db: AsyncSession,
    document,
    commit_result: dict,
    target_branch: str
) -> None:
    """Update document metadata after successful commit."""
    document.github_sha = commit_result["sha"]
    document.local_sha = github_service.generate_content_hash(document.content)
    document.github_sync_status = "synced"
    document.last_github_sync_at = datetime.utcnow()

    # Update branch if it changed
    if target_branch != document.github_branch:
        document.github_branch = target_branch

    await db.commit()


@router.post("/documents/{document_id}", response_model=GitHubCommitResponse)
async def commit_document_to_github(
    document_id: int,
    commit_request: GitHubCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubCommitResponse:
    """Commit local document changes to GitHub."""
    # Validate document and repository access
    document, repository, account = await _validate_document_and_repository(
        db, document_id, current_user
    )

    # Determine target branch
    target_branch = _determine_target_branch(commit_request, document, repository)

    # Check for conflicts if not forcing
    await _check_for_conflicts(commit_request, document, account, repository)

    try:
        # Perform the commit
        commit_result = await _perform_commit(
            commit_request, document, account, repository, target_branch
        )

        # Update document metadata
        await _update_document_metadata(db, document, commit_result, target_branch)

        return GitHubCommitResponse(
            success=True,
            commit_sha=commit_result["sha"],
            commit_url=commit_result.get("html_url", ""),
            branch=target_branch,
            message="File committed successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to commit file: {str(e)}"
        )

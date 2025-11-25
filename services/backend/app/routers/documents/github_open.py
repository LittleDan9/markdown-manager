"""GitHub document opening endpoints."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document
from app.crud import document as document_crud
from app.services.github import GitHubService
from app.services.storage.user import UserStorage
from .response_utils import create_document_response

router = APIRouter()


async def _validate_github_document(db: AsyncSession, document_id: int, current_user: User):
    """Validate document exists and is linked to GitHub."""
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if not document.github_repository_id or not document.github_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )

    return document


async def _get_repository_and_token(db: AsyncSession, document, current_user: User):
    """Get GitHub repository and access token."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    repository = await github_crud.get_repository(db, document.github_repository_id)
    if not repository or repository.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub repository not found or access denied"
        )

    # Access token is stored in the account
    access_token = repository.account.access_token
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub access token not found. Please reconnect your GitHub account."
        )

    return repository, access_token


async def _ensure_repo_cloned(github_service, storage_service, current_user, repository, document):
    """Ensure repository is cloned and on correct branch."""
    repo_dir = storage_service.get_github_repo_directory(
        current_user.id, repository.account_id, repository.repo_name
    )

    if not repo_dir.exists():
        try:
            repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}.git"
            await github_service.clone_repository(
                repo_url,
                repo_dir,
                branch=document.github_branch or repository.default_branch or "main"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to clone repository: {str(e)}"
            )

    # Checkout correct branch and pull changes
    branch = document.github_branch or repository.default_branch or "main"
    try:
        # Use GitHub filesystem service for git operations
        await github_service._filesystem_service.pull_changes(repo_dir, branch)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to checkout/pull branch {branch}: {e}")

    return repo_dir, branch


async def _sync_file_content(db, document, repo_dir, storage_service, current_user, repository):
    """Sync file content from repo to filesystem."""
    repo_file_path = repo_dir / document.github_file_path.strip('/')
    if not repo_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{document.github_file_path}' not found in repository"
        )

    try:
        content = repo_file_path.read_text(encoding='utf-8')
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file content: {str(e)}"
        )

    # Ensure document has filesystem path
    if not document.file_path:
        filesystem_path = f"github/{repository.account_id}/{repository.repo_name}/{document.github_file_path}"
        document.file_path = filesystem_path
        await db.commit()

    # Write to filesystem
    try:
        await storage_service.write_document(
            user_id=current_user.id,
            file_path=document.file_path,
            content=content,
            commit_message=f"Sync GitHub document: {document.name}",
            auto_commit=True
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to write content to filesystem: {e}")

    return content


@router.post("/{document_id}/github/open", response_model=Document)
async def open_github_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """
    Open a GitHub document with proper repo management and filesystem sync.

    This endpoint ensures GitHub documents work exactly like local documents by:
    1. Verifying the document exists and is linked to GitHub
    2. Ensuring the repository is cloned to the filesystem
    3. Checking out the correct branch
    4. Syncing the file content to the filesystem
    5. Returning the document via standard response with filesystem content

    This makes GitHub documents work seamlessly with the existing document
    workflow that expects content to be available from the filesystem.
    """
    # Validate document
    document = await _validate_github_document(db, document_id, current_user)

    # Get repository and access token
    repository, access_token = await _get_repository_and_token(db, document, current_user)

    # Initialize services
    github_service = GitHubService()
    storage_service = UserStorage()

    # Ensure repo is cloned and on correct branch
    repo_dir, branch = await _ensure_repo_cloned(
        github_service, storage_service, current_user, repository, document
    )

    # Sync file content
    content = await _sync_file_content(db, document, repo_dir, storage_service, current_user, repository)

    # Update sync status
    document.github_sync_status = "synced"
    document.last_github_sync_at = datetime.utcnow()
    await db.commit()

    # Return document using standard response format
    return await create_document_response(
        document=document,
        user_id=current_user.id,
        content=content
    )
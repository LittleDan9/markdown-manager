"""Document saving operations for GitHub."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.crud.document import DocumentCRUD
from app.crud.github_crud import GitHubCRUD
from app.services.github_service import GitHubService
from app.services.storage.user import UserStorage
from .schemas import SaveToGitHubRequest, SaveToGitHubResponse
from .validators import validate_document_access, validate_repository_access, get_existing_file_sha

router = APIRouter()
github_service = GitHubService()


async def load_document_content_async(
    storage_service: UserStorage,
    document,
    current_user: User
) -> str:
    """Load document content from storage or fallback."""
    document_content = ""

    if hasattr(document, 'file_path') and document.file_path:
        try:
            content = await storage_service.read_document(
                user_id=current_user.id,
                file_path=document.file_path
            )
            document_content = content or ""
        except Exception:
            # Fallback to database content
            document_content = getattr(document, 'content', "")
    else:
        # Legacy document without file_path
        document_content = getattr(document, 'content', "")

    if not document_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no content to save"
        )

    return document_content


@router.post("/documents/{document_id}/save", response_model=SaveToGitHubResponse)
async def save_document_to_github(
    document_id: int,
    save_request: SaveToGitHubRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveToGitHubResponse:
    """Save a local document to GitHub repository."""

    # Initialize services
    document_crud = DocumentCRUD()
    github_crud = GitHubCRUD()
    storage_service = UserStorage()

    # Validate access
    document = await validate_document_access(document_crud, db, document_id, current_user)
    repository = await validate_repository_access(github_crud, db, save_request.repository_id, current_user)

    # Load document content
    document_content = await load_document_content_async(storage_service, document, current_user)

    # Prepare file path and commit message
    file_path = save_request.file_path
    if not file_path.endswith('.md'):
        file_path += '.md'

    commit_message = save_request.commit_message or f"Add {getattr(document, 'title', 'document')}"

    # Get existing file SHA if it exists (for updates)
    existing_sha = await get_existing_file_sha(
        github_service, repository, file_path, save_request.branch
    )

    try:
        # Save file to GitHub using the commit_file method
        result = await github_service.commit_file(
            access_token=repository.account.access_token,
            owner=repository.repo_owner,
            repo=repository.repo_name,
            file_path=file_path,
            content=document_content,
            message=commit_message,
            branch=save_request.branch,
            sha=existing_sha,
            create_branch=save_request.create_branch,
            base_branch=save_request.base_branch
        )

        # Create response
        repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}"
        file_url = f"{repo_url}/blob/{save_request.branch}/{file_path}"

        return SaveToGitHubResponse(
            success=True,
            message="Document saved to GitHub successfully",
            repository_url=repo_url,
            file_url=file_url,
            commit_sha=result.get("commit", {}).get("sha", "unknown"),
            branch=save_request.branch,
            document_id=document_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to save document to GitHub: {str(e)}"
        )
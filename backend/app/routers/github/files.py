"""GitHub files and content browsing endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import GitHubFileInfo
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD

router = APIRouter()
github_service = GitHubService()


@router.get("/{repo_id}/browse")
async def browse_repository_files(
    repo_id: int,
    path: str = Query("", description="Directory path to browse"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubFileInfo]:
    """Browse files in a GitHub repository."""
    github_crud = GitHubCRUD()

    repo = await github_crud.get_repository(db, repo_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get repository contents
    contents = await github_service.get_repository_contents(
        repo.account.access_token, repo.repo_owner, repo.repo_name, path
    )

    files = []
    for item in contents:
        file_info = GitHubFileInfo(
            name=item["name"],
            path=item["path"],
            type=item["type"],
            size=item.get("size", 0),
            download_url=item.get("download_url"),
            sha=item["sha"],
            content=None  # Content is not fetched in browse mode
        )
        files.append(file_info)

    return files


@router.get("/{repo_id}/contents")
async def get_repository_contents(
    repo_id: int,
    path: str = Query("", description="Directory path to browse"),
    branch: str = Query("main", description="Branch to browse"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Get repository contents at a specific path - supports all file types."""
    github_crud = GitHubCRUD()

    repo = await github_crud.get_repository(db, repo_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get repository contents from GitHub API
    try:
        contents = await github_service.get_repository_contents(
            repo.account.access_token, repo.repo_owner, repo.repo_name, path, ref=branch
        )
        return contents
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch repository contents: {str(e)}"
        )


@router.get("/check-document-exists")
async def check_document_exists(
    repository_id: int = Query(..., description="GitHub repository ID"),
    file_path: str = Query(..., description="File path to check"),
    branch: str = Query(default="main", description="Branch name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check if a document already exists for the given GitHub file."""
    from app.crud.document import DocumentCRUD

    document_crud = DocumentCRUD()
    github_crud = GitHubCRUD()

    # Verify repository access
    repo = await github_crud.get_repository(db, repository_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Check if document exists
    existing_doc = await document_crud.get_by_github_metadata(
        db=db,
        user_id=current_user.id,
        repository_id=repository_id,
        file_path=file_path,
        branch=branch
    )

    if existing_doc:
        return {
            "exists": True,
            "document_id": existing_doc.id,
            "document_name": existing_doc.name
        }
    else:
        return {"exists": False}

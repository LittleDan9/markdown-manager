"""Main documents router that aggregates all document sub-routers."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.crud import github_settings as github_settings_crud
from app.models.github_models import GitHubAccount
from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    Document,
    DocumentCreate,
    DocumentList,
)
from app.schemas.github_save import GitHubSaveRequest, GitHubSaveResponse, DiagramConversionInfo
from app.services.github.filesystem import github_filesystem_service
from app.services.github.conversion import get_diagram_conversion_service
from app.services.github.api import GitHubAPIService
from app.services.unified_document import unified_document_service
from . import categories, crud, current, sharing, folders, recents, github_open
from .docs import DOCUMENT_CRUD_DOCS

router = APIRouter()


class DocumentGitStatus(BaseModel):
    """Git status for a document's repository."""
    current_branch: str = Field(..., description="Current git branch")
    has_uncommitted_changes: bool = Field(..., description="Whether there are uncommitted changes")
    has_staged_changes: bool = Field(..., description="Whether there are staged changes")
    has_untracked_files: bool = Field(..., description="Whether there are untracked files")
    modified_files: list[str] = Field(default_factory=list, description="List of modified files")
    staged_files: list[str] = Field(default_factory=list, description="List of staged files")
    untracked_files: list[str] = Field(default_factory=list, description="List of untracked files")
    ahead_behind: dict = Field(default_factory=dict, description="Commits ahead/behind remote")
    repository_type: str = Field(..., description="Type of repository (local/github)")
    github_info: Optional[dict] = Field(None, description="GitHub-specific information if available")


class CommitRequest(BaseModel):
    """Request for committing changes."""
    commit_message: str = Field(..., description="Commit message")


class StashRequest(BaseModel):
    """Request for stashing changes."""
    message: Optional[str] = Field(None, description="Optional stash message")
    include_untracked: bool = Field(False, description="Include untracked files in stash")


class StashResponse(BaseModel):
    """Response for stash operations."""
    success: bool
    stash_id: Optional[str] = None
    message: str
    operation: Optional[str] = None


class CreateBranchRequest(BaseModel):
    """Request for creating a new branch."""
    branch_name: str = Field(..., description="Name of the new branch")
    base_branch: Optional[str] = Field(None, description="Base branch (current branch if None)")
    switch_to_branch: bool = Field(True, description="Whether to switch to the new branch after creation")


class CreateBranchResponse(BaseModel):
    """Response for branch creation."""
    success: bool
    branch_name: str
    base_branch: Optional[str] = None
    current_branch: str
    switched: bool
    message: str


class BranchInfo(BaseModel):
    """Information about repository branches."""
    current_branch: str
    local_branches: list[dict]
    remote_branches: list[dict]
    total_local: int
    total_remote: int


class GitHistoryResponse(BaseModel):
    """Response for git history."""
    commits: list[dict]
    current_branch: str
    total: int
    repository_type: str


@router.get("/{document_id}/git/status", response_model=DocumentGitStatus)
async def get_document_git_status(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentGitStatus:
    """Get git status for a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Determine the repository path based on document properties
        from pathlib import Path
        from app.configs.settings import settings

        # Base user storage path
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, provide repository status information
            from app.crud.github_crud import GitHubCRUD

            github_crud = GitHubCRUD()

            # Get the GitHub repository details
            repository = await github_crud.get_repository(db, document.github_repository_id)
            if not repository:
                return {"error": "GitHub repository not found"}

            # Get the GitHub account for API access
            account = await github_crud.get_account(db, repository.account_id)
            if not account:
                return {"error": "GitHub account not found"}

            # For GitHub repositories, we can provide:
            # - Repository information
            # - Current branch (from document or repository default)
            # - Local vs remote sync status
            # - Whether document has local changes (if we track local content hash)

            current_branch = document.github_branch or repository.default_branch

            # Determine sync status
            sync_status = "unknown"
            has_local_changes = False

            if document.github_sync_status:
                sync_status = document.github_sync_status
                has_local_changes = sync_status in ["local_changes", "conflict"]
            elif document.github_sha and document.local_sha:
                # Compare hashes to determine if there are local changes
                has_local_changes = document.github_sha != document.local_sha
                sync_status = "local_changes" if has_local_changes else "synced"

            return {
                "current_branch": current_branch,
                "has_uncommitted_changes": has_local_changes,
                "has_staged_changes": False,  # GitHub repos don't have staging concept
                "has_untracked_files": False,  # GitHub repos don't have untracked files concept
                "modified_files": [document.name] if has_local_changes else [],
                "staged_files": [],
                "untracked_files": [],
                "ahead_behind": {},  # Could be implemented with GitHub API calls
                "repository_type": "github",
                "github_info": {
                    "repository_id": repository.id,
                    "repository_name": repository.repo_full_name,
                    "default_branch": repository.default_branch,
                    "current_branch": current_branch,
                    "sync_status": sync_status,
                    "last_sync": document.last_github_sync_at.isoformat() if document.last_github_sync_at else None,
                    "github_sha": document.github_sha,
                    "local_sha": document.local_sha
                }
            }
        else:
            # For local documents, determine repository path from file_path
            # file_path format: "local/CategoryName/filename.md"
            if document.file_path and document.file_path.startswith("local/"):
                # Extract category from file path
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]  # e.g., "General"
                    repo_path = user_storage_path / "local" / category_name
                else:
                    # Fallback to user root
                    repo_path = user_storage_path
            else:
                # Fallback to user root for documents without proper file_path
                repo_path = user_storage_path

        # Initialize git repository if it doesn't exist
        if not repo_path.exists():
            repo_path.mkdir(parents=True, exist_ok=True)

        if not (repo_path / ".git").exists():
            # Initialize git repository
            success, stdout, stderr = await github_filesystem_service._run_git_command(
                repo_path, ["init"]
            )
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to initialize git repository: {stderr}"
                )

            # Create initial commit if there are any files
            success, stdout, stderr = await github_filesystem_service._run_git_command(
                repo_path, ["add", "."]
            )
            if success:
                success, stdout, stderr = await github_filesystem_service._run_git_command(
                    repo_path, ["commit", "-m", f"Initial commit for {repo_path.name}"]
                )

        # Get git status using the filesystem service
        git_status = await github_filesystem_service.get_repository_status(repo_path)

        # Enhance with GitHub information if document has GitHub repository
        github_info = None
        if document.github_repository_id:
            try:
                # Could add GitHub API calls here to get remote status
                github_info = {
                    "repository_id": document.github_repository_id,
                    "has_remote": True
                }
            except Exception as e:
                # Don't fail if GitHub info unavailable
                github_info = {"error": str(e)}

        return DocumentGitStatus(
            current_branch=git_status.get("current_branch", "main"),
            has_uncommitted_changes=git_status.get("has_uncommitted_changes", False),
            has_staged_changes=git_status.get("has_staged_changes", False),
            has_untracked_files=git_status.get("has_untracked_files", False),
            modified_files=git_status.get("modified_files", []),
            staged_files=git_status.get("staged_files", []),
            untracked_files=git_status.get("untracked_files", []),
            ahead_behind=git_status.get("ahead_behind", {}),
            repository_type="github" if document.github_repository_id else "local",
            github_info=github_info
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get git status: {str(e)}"
        )


@router.post("/{document_id}/git/commit")
async def commit_document_changes(
    document_id: int,
    commit_request: CommitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Commit changes for a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Determine the repository path based on document properties
        from pathlib import Path
        from app.configs.settings import settings

        # Base user storage path
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, we need to get the repository details
            raise HTTPException(
                status_code=501,
                detail="GitHub repository git operations not yet implemented"
            )
        else:
            # For local documents, determine repository path from file_path
            if document.file_path and document.file_path.startswith("local/"):
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    repo_path = user_storage_path / "local" / category_name
                else:
                    repo_path = user_storage_path
            else:
                repo_path = user_storage_path

        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=404,
                detail="Git repository not found for document"
            )

        # Stage all changes and commit
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path, ["add", "-A"]
        )

        if not success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to stage files: {stderr}"
            )

        # Commit the changes
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path, ["commit", "-m", commit_request.commit_message]
        )

        if not success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to commit: {stderr}"
            )

        # Get the commit hash
        success, commit_hash, _ = await github_filesystem_service._run_git_command(
            repo_path, ["rev-parse", "HEAD"]
        )

        commit_hash = commit_hash.strip() if success else "unknown"

        return {
            "success": True,
            "commit_hash": commit_hash,
            "message": f"Successfully committed changes: {commit_request.commit_message}"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit changes: {str(e)}"
        )


@router.get("/{document_id}/git/history")
async def get_document_git_history(
    document_id: int,
    limit: int = Query(10, ge=1, le=50, description="Number of commits to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get git commit history for a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # Determine the repository path based on document properties
        from pathlib import Path
        from app.configs.settings import settings

        # Base user storage path
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, use GitHub API for commit history
            from app.crud.github_crud import GitHubCRUD

            github_crud = GitHubCRUD()

            # Get the GitHub repository details
            repository = await github_crud.get_repository(db, document.github_repository_id)
            if not repository:
                return {"commits": [], "total": 0, "error": "GitHub repository not found"}

            # Get the GitHub account for API access
            account = await github_crud.get_account(db, repository.account_id)
            if not account:
                return {"commits": [], "total": 0, "error": "GitHub account not found"}

            try:
                # Use GitHub API to get commit history for the specific file
                current_branch = document.github_branch or repository.default_branch
                file_path = document.github_file_path

                if not file_path:
                    return {
                        "commits": [],
                        "total": 0,
                        "repository_type": "github",
                        "error": "No file path specified for GitHub document"
                    }

                # Initialize GitHub API service and get commit history
                from app.services.github.api import GitHubAPIService
                github_api = GitHubAPIService()

                # Parse repository owner and name from repo_full_name
                repo_parts = repository.repo_full_name.split('/')
                if len(repo_parts) != 2:
                    return {
                        "commits": [],
                        "total": 0,
                        "repository_type": "github",
                        "error": "Invalid repository name format"
                    }

                owner, repo_name = repo_parts

                # Get commit history from GitHub API
                commits = await github_api.get_file_commits(
                    access_token=account.access_token,
                    owner=owner,
                    repo=repo_name,
                    file_path=file_path,
                    branch=current_branch,
                    limit=limit
                )

                return {
                    "commits": commits,
                    "total": len(commits),
                    "repository_path": f"github/{repository.repo_full_name}",
                    "repository_type": "github",
                    "github_info": {
                        "repository_name": repository.repo_full_name,
                        "branch": current_branch,
                        "file_path": file_path,
                        "owner": owner,
                        "repo": repo_name
                    }
                }
            except Exception as e:
                return {
                    "commits": [],
                    "total": 0,
                    "repository_type": "github",
                    "error": f"Failed to fetch GitHub history: {str(e)}"
                }
        else:
            # For local documents, determine repository path from file_path
            if document.file_path and document.file_path.startswith("local/"):
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    repo_path = user_storage_path / "local" / category_name
                else:
                    repo_path = user_storage_path
            else:
                repo_path = user_storage_path

        if not repo_path.exists():
            return {"commits": [], "total": 0}

        # Get git log
        from app.services.github.filesystem import GitHubFilesystemService
        github_filesystem_service = GitHubFilesystemService()

        # Run git log command to get commit history
        success, stdout, stderr = await github_filesystem_service._run_git_command(
            repo_path,
            ["log", f"--max-count={limit}", "--pretty=format:%H|%h|%s|%an|%ae|%ad|%ar", "--date=iso"]
        )

        if not success:
            if "not a git repository" in stderr.lower():
                return {"commits": [], "total": 0}
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get git history: {stderr}"
            )

        commits = []
        if stdout.strip():
            for line in stdout.strip().split('\n'):
                parts = line.split('|')
                if len(parts) >= 7:
                    commits.append({
                        "hash": parts[0],
                        "short_hash": parts[1],
                        "message": parts[2],
                        "author_name": parts[3],
                        "author_email": parts[4],
                        "date": parts[5],
                        "relative_date": parts[6]
                    })

        return {
            "commits": commits,
            "total": len(commits),
            "repository_path": str(repo_path),
            "repository_type": document.repository_type or "local"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get git history: {str(e)}"
        )


@router.post("/{document_id}/git/stash", response_model=StashResponse)
async def stash_document_changes(
    document_id: int,
    stash_request: StashRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StashResponse:
    """Stash uncommitted changes in a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # For now, we'll implement local stash operations
        # GitHub repos can use local git stash on cloned repositories
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, we need the cloned repository path
            # This would need to be implemented based on the GitHub cloning structure
            raise HTTPException(
                status_code=501,
                detail="Stash operations for GitHub repositories not yet implemented"
            )
        else:
            # For local documents, get category repository
            if document.file_path and document.file_path.startswith("local/"):
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    repo_path = user_storage_path / "local" / category_name
                else:
                    repo_path = user_storage_path
            else:
                repo_path = user_storage_path

        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=404,
                detail="Git repository not found for document"
            )

        # Perform stash operation
        result = await git_service.stash_changes(
            repo_path,
            message=stash_request.message,
            include_untracked=stash_request.include_untracked
        )

        if result["success"]:
            return StashResponse(
                success=True,
                stash_id=result.get("stash_id"),
                message=result["message"],
                operation="stash"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to stash changes")
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stash changes: {str(e)}"
        )


@router.post("/{document_id}/git/branches", response_model=CreateBranchResponse)
async def create_document_branch(
    document_id: int,
    branch_request: CreateBranchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreateBranchResponse:
    """Create a new git branch for a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, we need the cloned repository path
            raise HTTPException(
                status_code=501,
                detail="Branch operations for GitHub repositories not yet implemented"
            )
        else:
            # For local documents, get category repository
            if document.file_path and document.file_path.startswith("local/"):
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    repo_path = user_storage_path / "local" / category_name
                else:
                    repo_path = user_storage_path
            else:
                repo_path = user_storage_path

        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=404,
                detail="Git repository not found for document"
            )

        # Create branch
        result = await git_service.create_branch(
            repo_path,
            branch_name=branch_request.branch_name,
            base_branch=branch_request.base_branch,
            switch_to_branch=branch_request.switch_to_branch
        )

        if result["success"]:
            return CreateBranchResponse(
                success=True,
                branch_name=result["branch_name"],
                base_branch=result.get("base_branch"),
                current_branch=result["current_branch"],
                switched=result["switched"],
                message=result["message"]
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to create branch")
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create branch: {str(e)}"
        )


@router.get("/{document_id}/git/branches", response_model=BranchInfo)
async def get_document_branches(
    document_id: int,
    include_remote: bool = Query(False, description="Include remote branches"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BranchInfo:
    """Get branch information for a document's repository."""

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        if document.repository_type == "github" and document.github_repository_id:
            # For GitHub documents, we need the cloned repository path
            raise HTTPException(
                status_code=501,
                detail="Branch listing for GitHub repositories not yet implemented"
            )
        else:
            # For local documents, get category repository
            if document.file_path and document.file_path.startswith("local/"):
                path_parts = document.file_path.split("/")
                if len(path_parts) >= 2:
                    category_name = path_parts[1]
                    repo_path = user_storage_path / "local" / category_name
                else:
                    repo_path = user_storage_path
            else:
                repo_path = user_storage_path

        if not repo_path.exists() or not (repo_path / ".git").exists():
            raise HTTPException(
                status_code=404,
                detail="Git repository not found for document"
            )

        # Get branch information
        result = await git_service.list_branches(repo_path, include_remote=include_remote)

        return BranchInfo(
            current_branch=result["current_branch"],
            local_branches=result["local_branches"],
            remote_branches=result["remote_branches"],
            total_local=result["total_local"],
            total_remote=result["total_remote"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get branch information: {str(e)}"
        )


# Base document operations (list and create) - these need to be on the main router
@router.get("", response_model=DocumentList, **DOCUMENT_CRUD_DOCS["list"])
async def get_documents(
    category: Optional[str] = Query(None, description="Filter by category (legacy)"),
    folder_path: Optional[str] = Query(None, description="Filter by folder path"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentList:
    """Get all documents for the current user with folder or category filtering."""

    if folder_path is not None:
        # New folder-based filtering
        from app.models.document import Document as DocumentModel
        normalized_path = DocumentModel.normalize_folder_path(folder_path)
        orm_documents = await document_crud.document.get_documents_by_folder_path(
            db, current_user.id, normalized_path
        )
        # Apply pagination manually since folder method doesn't support it yet
        orm_documents = orm_documents[skip:skip + limit]

    elif category and category != "All":
        # Legacy category-based filtering
        orm_documents = await document_crud.document.get_by_user_and_category(
            db=db, user_id=current_user.id, category=category, skip=skip, limit=limit
        )
    else:
        # All documents
        orm_documents = await document_crud.document.get_by_user(
            db=db, user_id=current_user.id, skip=skip, limit=limit
        )

    # Get categories for backward compatibility
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=current_user.id
    )

    # Use the helper function to create responses with filesystem content
    from .response_utils import create_document_list_response
    documents = await create_document_list_response(
        documents=orm_documents,
        user_id=current_user.id
    )

    return DocumentList(
        documents=documents, total=len(documents), categories=categories
    )


@router.post("", response_model=Document, **DOCUMENT_CRUD_DOCS["create"])
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Create a new document with filesystem storage and folder or category support."""
    from app.services.storage.user import UserStorage
    from .response_utils import create_document_response
    from app.models.document import Document as DocumentModel
    from app.schemas.document import DocumentConflictError

    storage_service = UserStorage()

    # Handle both folder_path and category_id during transition
    folder_path = None
    category_id = None

    if hasattr(document_data, 'folder_path') and document_data.folder_path:
        # New folder-based approach
        folder_path = DocumentModel.normalize_folder_path(document_data.folder_path)
    elif hasattr(document_data, 'category_id') and document_data.category_id:
        # Legacy category-based approach
        category_id = document_data.category_id

        # Convert category to folder path for storage
        from app.crud.category import get_user_categories
        categories = await get_user_categories(db, current_user.id)
        category = next((cat for cat in categories if cat.id == category_id), None)
        if category:
            folder_path = f"/{category.name}"
    else:
        # Default folder if neither provided
        folder_path = "/General"

    # Ensure we have a folder path
    folder_path = folder_path or "/General"

    # Check for duplicate documents in folder
    existing_docs = await document_crud.document.get_documents_by_folder_path(
        db, current_user.id, folder_path
    )

    for existing_doc in existing_docs:
        if existing_doc.name == document_data.name:
            existing_document_schema = Document.model_validate(
                existing_doc, from_attributes=True
            )

            conflict_detail = DocumentConflictError(
                detail="A document with this name already exists in this folder.",
                conflict_type="name_conflict",
                existing_document=existing_document_schema,
            )
            raise HTTPException(status_code=400, detail=conflict_detail.model_dump())

    # Determine file path for filesystem storage
    # For local categories, store in local/{category_name}/filename.md
    # Ensure filename has .md extension
    filename = document_data.name if document_data.name.endswith('.md') else f"{document_data.name}.md"
    category_name = folder_path.strip('/').split('/')[-1] if folder_path != '/' else 'General'
    # File path relative to user directory
    file_path = f"local/{category_name}/{filename}"

    # Write content to filesystem
    content = document_data.content or ""
    filesystem_success = await storage_service.write_document(
        user_id=current_user.id,
        file_path=file_path,
        content=content,
        commit_message=f"Create document: {document_data.name}",
        auto_commit=True
    )

    if not filesystem_success:
        raise HTTPException(
            status_code=500,
            detail="Failed to create document in filesystem storage"
        )

    # Create database record with file_path reference
    document = DocumentModel(
        name=document_data.name,
        file_path=file_path,
        repository_type="local",
        folder_path=folder_path,
        category_id=category_id,  # Keep for transition
        user_id=current_user.id
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Use the helper function to create the response
    return await create_document_response(
        document=document,
        user_id=current_user.id,
        content=content
    )


# ========================================
# GIT MANAGEMENT MODAL ENDPOINTS
# ========================================

@router.get("/git/overview")
async def get_git_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get overview of all user repositories for git management modal."""
    try:
        from sqlalchemy import select
        from app.models.document import Document as DocumentModel

        # Get all documents for the user
        query = select(DocumentModel).where(DocumentModel.user_id == current_user.id)
        result = await db.execute(query)
        documents = result.scalars().all()

        # Group documents by repository
        repositories = {}

        for doc in documents:
            if doc.repository_type == "github" and doc.github_repository_id:
                # For GitHub documents, use the repository ID as the key
                key = f"github_{doc.github_repository_id}"

                if key not in repositories:
                    # Get GitHub repo details
                    from app.crud.github_crud import GitHubCRUD
                    github_crud = GitHubCRUD()
                    repository = await github_crud.get_repository(db, doc.github_repository_id)

                    if repository:
                        repositories[key] = {
                            "name": repository.repo_full_name,
                            "type": "github",
                            "document_count": 0,
                            "last_updated": None,
                            "status": "synced"
                        }

                if key in repositories:
                    repositories[key]["document_count"] += 1
                    # Update last_updated if this document is newer
                    if (repositories[key]["last_updated"] is None or
                            (doc.updated_at and doc.updated_at > repositories[key]["last_updated"])):
                        repositories[key]["last_updated"] = doc.updated_at

            elif doc.file_path and doc.file_path.startswith("local/"):
                # For local documents, extract category name from file_path
                path_parts = doc.file_path.split("/")
                if len(path_parts) >= 2:
                    repo_name = path_parts[1]  # Category name
                    key = f"local_{repo_name}"

                    if key not in repositories:
                        repositories[key] = {
                            "name": repo_name,
                            "type": "local",
                            "document_count": 0,
                            "last_updated": None,
                            "status": "active"
                        }

                    repositories[key]["document_count"] += 1
                    # Update last_updated if this document is newer
                    if (repositories[key]["last_updated"] is None or
                            (doc.updated_at and doc.updated_at > repositories[key]["last_updated"])):
                        repositories[key]["last_updated"] = doc.updated_at

        # Convert to list format and prepare timestamps
        repo_list = []
        for repo in repositories.values():
            if repo["last_updated"]:
                repo["last_updated"] = repo["last_updated"].isoformat()
            repo_list.append(repo)

        return {
            "repositories": repo_list,
            "total_repositories": len(repo_list),
            "total_documents": sum(repo["document_count"] for repo in repo_list)
        }

    except Exception as e:
        return {
            "repositories": [],
            "total_repositories": 0,
            "total_documents": 0,
            "error": f"Failed to load repository overview: {str(e)}"
        }


@router.get("/git/operation-logs")
async def get_git_operation_logs(
    limit: int = Query(50, ge=1, le=100, description="Number of logs to retrieve"),
    operation_type: Optional[str] = Query(None, description="Filter by operation type"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get git operation logs for the current user."""
    try:
        from sqlalchemy import select, desc
        from app.models.git_operations import GitOperationLog

        # Build query with filters
        query = select(GitOperationLog).where(GitOperationLog.user_id == current_user.id)

        if operation_type:
            query = query.where(GitOperationLog.operation_type == operation_type)
        if success is not None:
            query = query.where(GitOperationLog.success == success)

        # Order by most recent and limit
        query = query.order_by(desc(GitOperationLog.created_at)).limit(limit)

        result = await db.execute(query)
        logs = result.scalars().all()

        log_dicts = [log.to_dict() for log in logs]

        return {
            "logs": log_dicts,
            "total": len(log_dicts),
            "filters": {
                "operation_type": operation_type,
                "success": success,
                "limit": limit
            }
        }

    except Exception as e:
        return {
            "logs": [],
            "total": 0,
            "error": f"Failed to load operation logs: {str(e)}"
        }


@router.get("/git/stashes")
async def get_all_git_stashes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get git stashes from all user repositories."""
    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)
        all_stashes = []

        # Get stashes from local repositories
        local_path = user_storage_path / "local"
        if local_path.exists():
            for category_dir in local_path.iterdir():
                if category_dir.is_dir() and (category_dir / ".git").exists():
                    try:
                        stashes = await git_service.list_stashes(category_dir)
                        if stashes:  # stashes is a list, not a dict
                            all_stashes.extend([
                                {
                                    **stash,
                                    "repository_name": category_dir.name,
                                    "repository_type": "local",
                                    "repository_path": str(category_dir)
                                }
                                for stash in stashes  # stashes is already the list
                            ])
                    except Exception:
                        # Skip repositories with stash errors
                        continue

        repo_count = 0
        if (user_storage_path / "local").exists():
            repo_count = len([d for d in (user_storage_path / "local").iterdir()
                             if d.is_dir() and (d / ".git").exists()])

        return {
            "stashes": all_stashes,
            "total": len(all_stashes),
            "repositories_checked": repo_count
        }

    except Exception as e:
        return {
            "stashes": [],
            "total": 0,
            "error": f"Failed to load stashes: {str(e)}"
        }


@router.get("/git/branches/all")
async def get_all_git_branches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get branches from all user repositories (local and GitHub)."""
    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService
        from app.models.github_models import GitHubRepository
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)
        all_repositories = []

        # Get branches from local repositories
        local_path = user_storage_path / "local"
        if local_path.exists():
            for category_dir in local_path.iterdir():
                if category_dir.is_dir() and (category_dir / ".git").exists():
                    try:
                        branches = await git_service.list_branches(category_dir, include_remote=False)
                        all_repositories.append({
                            "repository_name": category_dir.name,
                            "repository_type": "local",
                            "repository_path": str(category_dir),
                            "current_branch": branches["current_branch"],
                            "local_branches": branches["local_branches"],
                            "remote_branches": branches["remote_branches"],
                            "total_local": branches["total_local"],
                            "total_remote": branches["total_remote"]
                        })
                    except Exception as e:
                        # Add repository with error info
                        all_repositories.append({
                            "repository_name": category_dir.name,
                            "repository_type": "local",
                            "repository_path": str(category_dir),
                            "error": f"Failed to get branches: {str(e)}",
                            "current_branch": "unknown",
                            "local_branches": [],
                            "remote_branches": [],
                            "total_local": 0,
                            "total_remote": 0
                        })

        # Get branches from synchronized GitHub repositories only
        try:
            from app.models.github_models import GitHubAccount, GitHubRepositorySelection

            # Only get repositories that are both selected and have sync enabled
            github_repos_result = await db.execute(
                select(GitHubRepository)
                .join(GitHubAccount, GitHubRepository.account_id == GitHubAccount.id)
                .join(GitHubRepositorySelection, GitHubRepositorySelection.github_repo_id == GitHubRepository.github_repo_id)
                .options(selectinload(GitHubRepository.account))
                .where(GitHubAccount.user_id == current_user.id)
                .where(GitHubRepositorySelection.github_account_id == GitHubAccount.id)
                .where(GitHubRepositorySelection.sync_enabled)
            )
            github_repos = github_repos_result.scalars().all()

            for github_repo in github_repos:
                try:
                    import httpx

                    # Call GitHub API to get branches
                    headers = {
                        "Authorization": f"Bearer {github_repo.account.access_token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "MarkdownManager/1.0"
                    }

                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            f"https://api.github.com/repos/{github_repo.repo_full_name}/branches",
                            headers=headers
                        )
                        if response.status_code == 200:
                            branches_data = response.json()
                        else:
                            branches_data = None

                    if branches_data:
                        # Convert GitHub API response to our format
                        # GitHub branches are remote branches since they exist on GitHub's servers
                        branch_names = [branch["name"] for branch in branches_data]
                        default_branch = github_repo.default_branch
                        if default_branch in branch_names:
                            current_branch = default_branch
                        elif branch_names:
                            current_branch = branch_names[0]
                        else:
                            current_branch = "unknown"

                        # Format remote branches with name and is_current properties like local branches
                        remote_branches = [
                            {
                                "name": branch_name,
                                "is_current": branch_name == current_branch
                            }
                            for branch_name in branch_names
                        ]

                        all_repositories.append({
                            "repository_name": github_repo.repo_full_name,
                            "repository_type": "github",
                            "repository_path": f"github://{github_repo.repo_full_name}",
                            "current_branch": current_branch,
                            "local_branches": [],  # GitHub repos have no local branches
                            "remote_branches": remote_branches,  # All GitHub branches are remote
                            "total_local": 0,
                            "total_remote": len(remote_branches),
                            "default_branch": github_repo.default_branch,
                            "github_repo_id": github_repo.id
                        })
                except Exception as e:
                    # Add repository with error info
                    all_repositories.append({
                        "repository_name": github_repo.repo_full_name,
                        "repository_type": "github",
                        "repository_path": f"github://{github_repo.repo_full_name}",
                        "error": f"Failed to get branches: {str(e)}",
                        "current_branch": github_repo.default_branch or "unknown",
                        "local_branches": [],  # GitHub repos have no local branches
                        "remote_branches": [],  # Empty on error
                        "total_local": 0,
                        "total_remote": 0,
                        "github_repo_id": github_repo.id
                    })
        except Exception as e:
            print(f"Error loading GitHub repositories: {e}")
            # Continue without GitHub repos if there's an error

        return {
            "repositories": all_repositories,
            "total_repositories": len(all_repositories),
            "total_branches": sum(repo.get("total_local", 0) + repo.get("total_remote", 0)
                                  for repo in all_repositories if "error" not in repo)
        }

    except Exception as e:
        return {
            "repositories": [],
            "total_repositories": 0,
            "total_branches": 0,
            "error": f"Failed to load branch information: {str(e)}"
        }


@router.post("/git/stash/apply")
async def apply_git_stash(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply a git stash from any repository."""
    try:
        from pathlib import Path
        from app.services.storage.git_service import GitService

        repository_path = request.get("repository_path")
        stash_id = request.get("stash_id", "stash@{0}")
        pop = request.get("pop", False)

        if not repository_path:
            return {"success": False, "error": "Repository path is required"}

        repo_path = Path(repository_path)
        if not repo_path.exists() or not (repo_path / ".git").exists():
            return {"success": False, "error": "Git repository not found"}

        git_service = GitService()
        result = await git_service.apply_stash(repo_path, stash_id, pop)

        return result

    except Exception as e:
        return {"success": False, "error": f"Failed to apply stash: {str(e)}"}


@router.post("/git/stash/create")
async def create_git_stash(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a git stash in a specific repository."""
    try:
        from pathlib import Path
        from app.services.storage.git_service import GitService

        repository_path = request.get("repository_path")
        message = request.get("message", "")
        include_untracked = request.get("include_untracked", False)

        if not repository_path:
            return {"success": False, "error": "Repository path is required"}

        repo_path = Path(repository_path)
        if not repo_path.exists() or not (repo_path / ".git").exists():
            return {"success": False, "error": "Git repository not found"}

        git_service = GitService()
        result = await git_service.stash_changes(repo_path, message, include_untracked)

        return result

    except Exception as e:
        return {"success": False, "error": f"Failed to create stash: {str(e)}"}


@router.get("/git/settings")
async def get_git_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get git configuration settings for the current user."""
    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        # Get settings from the first available repository
        local_path = user_storage_path / "local"
        git_config = {
            "user_name": "Markdown Manager",
            "user_email": "system@markdown-manager.local",
            "auto_commit_on_save": True,
            "auto_init_repos": True,
            "operation_logging": True
        }

        if local_path.exists():
            for category_dir in local_path.iterdir():
                if category_dir.is_dir() and (category_dir / ".git").exists():
                    try:
                        # Get git config from repository
                        success, name_output, _ = await git_service._run_git_command(
                            category_dir, ["config", "user.name"]
                        )
                        if success and name_output.strip():
                            git_config["user_name"] = name_output.strip()

                        success, email_output, _ = await git_service._run_git_command(
                            category_dir, ["config", "user.email"]
                        )
                        if success and email_output.strip():
                            git_config["user_email"] = email_output.strip()
                        break
                    except Exception:
                        continue

        return {
            "settings": git_config,
            "success": True
        }

    except Exception as e:
        return {
            "settings": {},
            "success": False,
            "error": f"Failed to get git settings: {str(e)}"
        }


@router.post("/git/settings")
async def update_git_settings(
    request: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update git configuration settings for the current user."""
    try:
        from pathlib import Path
        from app.configs.settings import settings
        from app.services.storage.git_service import GitService

        git_service = GitService()
        user_storage_path = Path(settings.markdown_storage_root) / str(current_user.id)

        new_settings = request.get("settings", {})
        user_name = new_settings.get("user_name")
        user_email = new_settings.get("user_email")

        updated_repos = []
        errors = []

        # Update git config in all repositories
        local_path = user_storage_path / "local"
        if local_path.exists():
            for category_dir in local_path.iterdir():
                if category_dir.is_dir() and (category_dir / ".git").exists():
                    try:
                        if user_name:
                            success, _, stderr = await git_service._run_git_command(
                                category_dir, ["config", "user.name", user_name]
                            )
                            if not success:
                                errors.append(f"Failed to set name in {category_dir.name}: {stderr}")
                                continue

                        if user_email:
                            success, _, stderr = await git_service._run_git_command(
                                category_dir, ["config", "user.email", user_email]
                            )
                            if not success:
                                errors.append(f"Failed to set email in {category_dir.name}: {stderr}")
                                continue

                        updated_repos.append(category_dir.name)
                    except Exception as e:
                        errors.append(f"Error updating {category_dir.name}: {str(e)}")

        return {
            "success": len(errors) == 0,
            "updated_repositories": updated_repos,
            "errors": errors,
            "message": (f"Updated git config in {len(updated_repos)} repositories"
                        if updated_repos else "No repositories updated")
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to update git settings: {str(e)}"
        }


@router.post("/{document_id}/github/save", response_model=GitHubSaveResponse)
async def save_document_to_github(
    document_id: int,
    request: GitHubSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save document to GitHub with automatic diagram conversion.

    This endpoint:
    1. Retrieves the document and user's GitHub settings
    2. Converts advanced diagrams to GitHub-compatible format if enabled
    3. Uploads diagram images to the repository
    4. Commits the converted document content
    """

    # Get the document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Load the actual document content using the unified document service
    try:
        document_with_content = await unified_document_service.get_document_with_content(
            db, document_id, current_user.id
        )
        document_content = document_with_content.get("content", f"# {document.name}\n\nThis document has no content yet.")
    except Exception as e:
        # Fallback to empty content if loading fails
        document_content = f"# {document.name}\n\nFailed to load content: {str(e)}"

    # Get user's GitHub settings
    github_settings = await github_settings_crud.get_github_settings_by_user_id(db, current_user.id)
    if not github_settings:
        raise HTTPException(
            status_code=400,
            detail="GitHub settings not configured. Please configure GitHub integration first."
        )

    # Get GitHub account for the repository
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    github_accounts = list(result.scalars().all())
    if not github_accounts:
        raise HTTPException(
            status_code=400,
            detail="GitHub account not connected. Please connect your GitHub account first."
        )

    # Use the first GitHub account (in a real implementation,
    # you'd want to select based on the repository)
    github_account = github_accounts[0]

    # Initialize services outside try block for cleanup
    conversion_service = None

    try:
        # Initialize services
        conversion_service = await get_diagram_conversion_service()
        github_api_service = GitHubAPIService()

        # Determine if we should convert diagrams
        should_convert = request.auto_convert_diagrams
        if should_convert is None:
            should_convert = github_settings.auto_convert_diagrams

        # Prepare settings for conversion
        conversion_settings = {
            'auto_convert_diagrams': should_convert,
            'diagram_format': github_settings.diagram_format,
            'fallback_to_standard': github_settings.fallback_to_standard
        }

        converted_content = document_content
        converted_diagrams = []
        conversion_errors = []
        converted_content = document_content
        converted_diagrams = []

        # Get repository info first to have owner/name for conversion
        from app.models.github_models import GitHubRepository
        repository_result = await db.execute(
            select(GitHubRepository).where(GitHubRepository.id == request.repository_id)
        )
        repository = repository_result.scalar_one_or_none()
        if not repository:
            raise HTTPException(
                status_code=400,
                detail=f"Repository with ID {request.repository_id} not found"
            )

        # Extract owner and repo name from repo_full_name (format: "owner/repo")
        if '/' not in repository.repo_full_name:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid repository repo_full_name format: {repository.repo_full_name}"
            )

        repository_owner, repository_name = repository.repo_full_name.split('/', 1)

        # Convert diagrams if enabled
        if should_convert:
            try:
                rendered_diagrams_dict = (
                    [diagram.dict() for diagram in request.rendered_diagrams]
                    if request.rendered_diagrams else None
                )

                conversion_result = await conversion_service.convert_document(
                    document_content,
                    conversion_settings,
                    repository_path=".markdown-manager/diagrams/",
                    repository_owner=repository_owner,
                    repository_name=repository_name,
                    branch=request.branch,
                    rendered_diagrams=rendered_diagrams_dict
                )

                converted_content = conversion_result.converted_content
                converted_diagrams = [
                    {
                        'filename': d.filename,
                        'image_data': d.image_data,
                        'image_format': d.image_format,
                        'hash': d.hash,
                        'needs_upload': d.needs_upload
                    }
                    for d in conversion_result.diagrams
                ]
                conversion_errors = conversion_result.errors

            except Exception as e:
                conversion_errors.append(f"Diagram conversion failed: {str(e)}")

        # If there are conversion errors and user wants strict conversion, fail
        if conversion_errors and should_convert:
            return GitHubSaveResponse(
                success=False,
                errors=conversion_errors,
                diagrams_converted=0,
                total_diagrams=len(converted_diagrams)
            )

        # Save to GitHub
        if converted_diagrams:
            # Use the enhanced commit method with diagrams
            result = await github_api_service.commit_file_with_diagrams(
                access_token=github_account.access_token,
                owner=repository_owner,
                repo=repository_name,
                file_path=request.file_path,
                content=converted_content,
                message=request.commit_message,
                branch=request.branch,
                diagrams=converted_diagrams,
                create_branch=request.create_branch,
                base_branch=request.base_branch
            )
        else:
            # Use the standard commit method
            result = await github_api_service.commit_file(
                access_token=github_account.access_token,
                owner=repository_owner,
                repo=repository_name,
                file_path=request.file_path,
                content=converted_content,
                message=request.commit_message,
                branch=request.branch,
                create_branch=request.create_branch,
                base_branch=request.base_branch
            )

            # Format result to match our expected structure
            result = {
                'commit': result,
                'uploaded_diagrams': [],
                'errors': [],
                'success': True,
                'diagrams_uploaded': 0,
                'total_diagrams': 0
            }

        # Format response
        commit_info = result.get('commit', {})
        commit_sha = None
        commit_url = None
        file_url = None

        if commit_info and 'commit' in commit_info:
            commit_sha = commit_info['commit'].get('sha')
            if commit_sha:
                commit_url = f"https://github.com/{repository_owner}/{repository_name}/commit/{commit_sha}"
                file_url = (f"https://github.com/{repository_owner}/{repository_name}/"
                            f"blob/{request.branch}/{request.file_path}")

        # Format diagram info
        diagram_info = []
        for uploaded in result.get('uploaded_diagrams', []):
            diagram_info.append(DiagramConversionInfo(
                filename=uploaded['filename'],
                path=uploaded['path'],
                hash=uploaded['hash'],
                format=uploaded['format'],
                sha=uploaded.get('sha'),
                size=uploaded['size'],
                original_code=""  # We'd need to store this from conversion
            ))

        return GitHubSaveResponse(
            success=result.get('success', False),
            commit_sha=commit_sha,
            commit_url=commit_url,
            file_url=file_url,
            converted_diagrams=diagram_info,
            errors=result.get('errors', []) + conversion_errors,
            diagrams_converted=result.get('diagrams_uploaded', 0),
            total_diagrams=result.get('total_diagrams', 0)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save document to GitHub: {str(e)}"
        )

    finally:
        # Clean up the conversion service
        if conversion_service is not None:
            try:
                await conversion_service.cleanup()
            except Exception:
                pass


# Include all document sub-routers
# NOTE: Order matters! More specific routes must come before generic ones
router.include_router(github_open.router, tags=["documents"])  # GitHub document opening
router.include_router(recents.router, tags=["documents"])  # /recent before /{document_id}
router.include_router(current.router, tags=["documents"])  # /current before /{document_id}
router.include_router(folders.router, tags=["documents"])  # NEW: folder operations
router.include_router(categories.router, tags=["documents"])
router.include_router(sharing.router, tags=["documents"])
router.include_router(crud.router, tags=["documents"])  # /{document_id} must come last

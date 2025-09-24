"""Main documents router that aggregates all document sub-routers."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    Document,
    DocumentCreate,
    DocumentList,
)
from app.services.github.filesystem import github_filesystem_service
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


# Include all document sub-routers
# NOTE: Order matters! More specific routes must come before generic ones
router.include_router(github_open.router, tags=["documents"])  # GitHub document opening
router.include_router(recents.router, tags=["documents"])  # /recent before /{document_id}
router.include_router(current.router, tags=["documents"])  # /current before /{document_id}
router.include_router(folders.router, tags=["documents"])  # NEW: folder operations
router.include_router(categories.router, tags=["documents"])
router.include_router(sharing.router, tags=["documents"])
router.include_router(crud.router, tags=["documents"])  # /{document_id} must come last

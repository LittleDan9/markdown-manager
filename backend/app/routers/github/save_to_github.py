"""GitHub save operations for local documents."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD
from app.crud.document import DocumentCRUD
from app.services.storage.user import UserStorage

router = APIRouter()
github_service = GitHubService()


class SaveToGitHubRequest(BaseModel):
    """Request schema for saving a document to GitHub."""
    repository_id: int = Field(..., description="GitHub repository ID")
    file_path: str = Field(..., description="Path where to save the file in the repository")
    branch: str = Field(default="main", description="Target branch")
    commit_message: Optional[str] = Field(None, description="Custom commit message")
    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")
    base_branch: Optional[str] = Field(None, description="Base branch for new branch creation")


class SaveToGitHubResponse(BaseModel):
    """Response schema for GitHub save operation."""
    success: bool
    message: str
    repository_url: str
    file_url: str
    commit_sha: str
    branch: str
    document_id: int


class GitHubRepositoryListItem(BaseModel):
    """Repository list item for repository selection."""
    id: int
    name: str
    full_name: str
    owner: str
    is_private: bool
    default_branch: str
    account_username: str


class RepositoryStatusResponse(BaseModel):
    """Response schema for repository status."""
    branch: str
    staged_files: List[str]
    modified_files: List[str]
    untracked_files: List[str]
    has_changes: bool
    needs_attention: bool
    status_message: str


@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)
async def get_repository_status(
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryStatusResponse:
    """Get the current git status of a repository."""
    from app.services.github.filesystem import github_filesystem_service
    from pathlib import Path
    from app.configs.settings import settings
    
    github_crud = GitHubCRUD()
    
    # Validate repository access
    repository = await _validate_repository_access(github_crud, db, repository_id, current_user)
    
    # Construct repository path
    repo_path = (
        Path(settings.markdown_storage_root)
        / str(current_user.id)
        / "github"
        / str(repository.account_id)
        / repository.repo_name
    )
    
    if not repo_path.exists() or not (repo_path / ".git").exists():
        # Repository not cloned locally - no status issues
        return RepositoryStatusResponse(
            branch="main",
            staged_files=[],
            modified_files=[],
            untracked_files=[],
            has_changes=False,
            needs_attention=False,
            status_message="Repository not cloned locally"
        )
    
    # Get repository status
    status = await github_filesystem_service.get_repository_status(repo_path)
    
    if "error" in status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get repository status: {status['error']}"
        )
    
    # Determine if repository needs attention before branch operations
    needs_attention = status.get("has_changes", False)
    
    status_message = "Repository is clean"
    if needs_attention:
        status_message = "Repository has uncommitted changes that need to be committed or stashed before creating branches"
    
    return RepositoryStatusResponse(
        branch=status.get("branch", "unknown"),
        staged_files=status.get("staged_files", []),
        modified_files=status.get("modified_files", []),
        untracked_files=status.get("untracked_files", []),
        has_changes=status.get("has_changes", False),
        needs_attention=needs_attention,
        status_message=status_message
    )


class RepositoryStatusResponse(BaseModel):
    """Response schema for repository status."""
    branch: str
    staged_files: List[str]
    modified_files: List[str]
    untracked_files: List[str]
    has_changes: bool
    needs_attention: bool
    status_message: str


@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)
async def get_user_repositories_for_save(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepositoryListItem]:
    """Get user's selected repositories available for saving documents."""
    github_crud = GitHubCRUD()
    
    # Get all user GitHub accounts
    accounts = await github_crud.get_user_accounts(db, current_user.id)
    
    if not accounts:
        return []
    
    repositories = []
    
    # Import the repository selector to get selected repositories
    from app.services.github.repository_selector import GitHubRepositorySelector
    repository_selector = GitHubRepositorySelector()
    
    for account in accounts:
        # Get only selected repositories for this account
        selected_repos = await repository_selector.get_selected_repositories(
            db, account.id, active_only=True
        )
        
        for selection in selected_repos:
            # Get the corresponding GitHubRepository record if it exists
            from sqlalchemy import select, and_
            from app.models.github_models import GitHubRepository
            
            repo_query = await db.execute(
                select(GitHubRepository).where(
                    and_(
                        GitHubRepository.account_id == account.id,
                        GitHubRepository.github_repo_id == selection.github_repo_id
                    )
                )
            )
            repo = repo_query.scalar_one_or_none()
            
            # Use data from selection record, fallback to repo record if available
            repositories.append(GitHubRepositoryListItem(
                id=repo.id if repo else selection.id,  # Use internal repo ID if available
                name=selection.repo_name,
                full_name=selection.repo_full_name,
                owner=selection.repo_owner,
                is_private=selection.is_private,
                default_branch=selection.default_branch,
                account_username=account.username
            ))
    
    return repositories


@router.get("/repositories/{repository_id}/branches")
async def get_repository_branches_for_save(
    repository_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Get branches for a repository."""
    github_crud = GitHubCRUD()
    
    # Validate repository access
    repository = await github_crud.get_repository(db, repository_id)
    if not repository or repository.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    # Get branches from GitHub API
    try:
        branches = await github_service.get_repository_branches(
            repository.account.access_token,
            repository.repo_owner,
            repository.repo_name
        )
        return branches
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get repository branches: {str(e)}"
        )


async def _validate_document_access(
    document_crud: DocumentCRUD,
    db: AsyncSession,
    document_id: int,
    current_user: User
):
    """Validate document ownership."""
    document = await document_crud.get(db, document_id)
    
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document


async def _validate_repository_access(
    github_crud: GitHubCRUD,
    db: AsyncSession,
    repository_id: int,
    current_user: User
):
    """Validate repository access for selected repositories."""
    # First try to get from GitHubRepository table
    repository = await github_crud.get_repository(db, repository_id)
    
    if repository and repository.account.user_id == current_user.id:
        return repository
    
    # If not found in GitHubRepository, check if it's a selected repository
    from app.services.github.repository_selector import GitHubRepositorySelector
    
    repository_selector = GitHubRepositorySelector()
    
    # Get all user accounts
    accounts = await github_crud.get_user_accounts(db, current_user.id)
    
    for account in accounts:
        selected_repos = await repository_selector.get_selected_repositories(
            db, account.id, active_only=True
        )
        
        for selection in selected_repos:
            # Check if this selection matches our repository_id
            # (repository_id might be the selection.id in this case)
            if selection.id == repository_id:
                # Create a repository-like object from the selection data
                class MockRepository:
                    def __init__(self, selection, account):
                        self.id = selection.id
                        self.repo_name = selection.repo_name
                        self.repo_owner = selection.repo_owner
                        self.default_branch = selection.default_branch
                        self.is_private = selection.is_private
                        self.github_repo_id = selection.github_repo_id
                        self.account = account
                        self.account_id = account.id
                
                return MockRepository(selection, account)
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Repository not found or not selected"
    )


async def _load_document_content(
    storage_service: UserStorage,
    document,
    current_user: User
) -> str:
    """Load document content from storage or fallback."""
    document_content = ""
    
    if document.file_path:
        try:
            content = await storage_service.read_document(
                user_id=current_user.id,
                file_path=document.file_path
            )
            document_content = content or ""
        except Exception:
            # Fallback to empty content
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


async def _get_existing_file_sha(
    github_service: GitHubService,
    repository,
    file_path: str,
    branch: str
) -> Optional[str]:
    """Get existing file SHA if file exists."""
    try:
        _, existing_sha = await github_service.get_file_content(
            repository.account.access_token,
            repository.repo_owner,
            repository.repo_name,
            file_path,
            branch
        )
        return existing_sha
    except Exception:
        # File doesn't exist, which is fine for new files
        return None


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
    document = await _validate_document_access(document_crud, db, document_id, current_user)
    repository = await _validate_repository_access(github_crud, db, save_request.repository_id, current_user)
    
    # Load document content
    document_content = await _load_document_content(storage_service, document, current_user)
    
    # Prepare file path and commit message
    file_path = save_request.file_path
    if not file_path.endswith('.md'):
        file_path += '.md'
    
    commit_message = save_request.commit_message or f"Add {document.name}"
    
    # Check if file already exists
    existing_sha = await _get_existing_file_sha(github_service, repository, file_path, save_request.branch)
    
    try:
        # Create or update the file in GitHub
        result = await github_service.create_or_update_file(
            access_token=repository.account.access_token,
            owner=repository.repo_owner,
            repo=repository.repo_name,
            path=file_path,
            content=document_content,
            message=commit_message,
            sha=existing_sha,
            branch=save_request.branch
        )
        
        # If creating a new branch, we need to use the commit_file method instead
        if save_request.create_branch and save_request.base_branch:
            result = await github_service.commit_file(
                access_token=repository.account.access_token,
                owner=repository.repo_owner,
                repo=repository.repo_name,
                file_path=file_path,
                content=document_content,
                message=commit_message,
                branch=save_request.branch,
                sha=existing_sha,
                create_branch=True,
                base_branch=save_request.base_branch
            )
        else:
            result = await github_service.create_or_update_file(
                access_token=repository.account.access_token,
                owner=repository.repo_owner,
                repo=repository.repo_name,
                path=file_path,
                content=document_content,
                message=commit_message,
                sha=existing_sha,
                branch=save_request.branch
            )
        
        # Update document with GitHub metadata
        document.github_repository_id = repository.id
        document.github_file_path = file_path
        document.github_sha = result.get("content", {}).get("sha", "")
        document.local_sha = github_service.generate_content_hash(document_content)
        document.source = "github"
        
        await db.commit()
        await db.refresh(document)
        
        # Construct response message and URLs
        repository_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}"
        file_url = f"{repository_url}/blob/{save_request.branch}/{file_path}"
        
        success_message = "Document saved to GitHub successfully"
        if save_request.create_branch and save_request.base_branch:
            success_message += f" on new branch '{save_request.branch}' created from '{save_request.base_branch}'"
        
        return SaveToGitHubResponse(
            success=True,
            message=success_message,
            repository_url=repository_url,
            file_url=file_url,
            commit_sha=result.get("commit", {}).get("sha", ""),
            branch=save_request.branch,
            document_id=document_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to save document to GitHub: {str(e)}"
        )

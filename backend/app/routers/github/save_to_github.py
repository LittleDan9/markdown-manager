"""GitHub save operations for local documents.""""""GitHub save operations for local documents.""""""GitHub save operations for local documents."""

from typing import List, Optional

from typing import List, Optionalfrom typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, statusfrom fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user

from app.database import get_dbfrom sqlalchemy.ext.asyncio import AsyncSessionfrom sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

from app.services.github_service import GitHubServicefrom pydantic import BaseModel, Fieldfrom pydantic import BaseModel, Field

from app.crud.github_crud import GitHubCRUD

from app.crud.document import DocumentCRUD

from app.services.storage.user import UserStorage

from app.core.auth import get_current_userfrom app.core.auth import get_current_user

router = APIRouter()

github_service = GitHubService()from app.database import get_dbfrom app.database import get_db



from app.models import Userfrom app.models import User

class SaveToGitHubRequest(BaseModel):

    """Request schema for saving a document to GitHub."""from app.services.github_service import GitHubServicefrom app.services.github_service import GitHubService

    repository_id: int = Field(..., description="GitHub repository ID")

    file_path: str = Field(..., description="Path where to save the file in the repository")from app.crud.github_crud import GitHubCRUDfrom app.crud.github_crud import GitHubCRUD

    branch: str = Field(default="main", description="Target branch")

    commit_message: Optional[str] = Field(None, description="Custom commit message")from app.crud.document import DocumentCRUDfrom app.crud.document import DocumentCRUD

    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")

    base_branch: Optional[str] = Field(None, description="Base branch for new branch creation")from app.services.storage.user import UserStoragefrom app.services.storage.user import UserStorage





class SaveToGitHubResponse(BaseModel):

    """Response schema for GitHub save operation."""router = APIRouter()router = APIRouter()

    success: bool

    message: strgithub_service = GitHubService()github_service = GitHubService()

    repository_url: str

    file_url: str

    commit_sha: str

    branch: str

    document_id: int

class SaveToGitHubRequest(BaseModel):class SaveToGitHubRequest(BaseModel):



class GitHubRepositoryListItem(BaseModel):    """Request schema for saving a document to GitHub."""    """Request schema for saving a document to GitHub."""

    """Repository list item for repository selection."""

    id: int    repository_id: int = Field(..., description="GitHub repository ID")    repository_id: int = Field(..., description="GitHub repository ID")

    name: str

    full_name: str    file_path: str = Field(..., description="Path where to save the file in the repository")    file_path: str = Field(..., description="Path where to save the file in the repository")

    owner: str

    is_private: bool    branch: str = Field(default="main", description="Target branch")    branch: str = Field(default="main", description="Target branch")

    default_branch: str

    account_username: str    commit_message: Optional[str] = Field(None, description="Custom commit message")    commit_message: Optional[str] = Field(None, description="Custom commit message")



    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")

class RepositoryStatusResponse(BaseModel):

    """Response schema for repository status."""    base_branch: Optional[str] = Field(None, description="Base branch for new branch creation")    base_branch: Optional[str] = Field(None, description="Base branch for new branch creation")

    branch: str

    staged_files: List[str]

    modified_files: List[str]

    untracked_files: List[str]

    has_changes: bool

    needs_attention: boolclass SaveToGitHubResponse(BaseModel):class SaveToGitHubResponse(BaseModel):

    status_message: str

    """Response schema for GitHub save operation."""    """Response schema for GitHub save operation."""



@router.get("/user-repositories")    success: bool    success: bool

async def get_user_repositories_for_save(

    current_user: User = Depends(get_current_user),    message: str    message: str

    db: AsyncSession = Depends(get_db),

) -> List[GitHubRepositoryListItem]:    repository_url: str    repository_url: str

    """Get user's selected repositories available for saving documents."""

    github_crud = GitHubCRUD()    file_url: str    file_url: str



    # Get all user GitHub accounts    commit_sha: str    commit_sha: str

    accounts = await github_crud.get_user_accounts(db, current_user.id)

        branch: str    branch: str

    if not accounts:

        return []    document_id: int    document_id: int



    repositories = []



    # Import the repository selector to get selected repositories

    from app.services.github.repository_selector import GitHubRepositorySelector

    repository_selector = GitHubRepositorySelector()class GitHubRepositoryListItem(BaseModel):class GitHubRepositoryListItem(BaseModel):



    for account in accounts:    """Repository list item for repository selection."""    """Repository list item for repository selection."""

        # Get only selected repositories for this account

        selected_repos = await repository_selector.get_selected_repositories(    id: int    id: int

            db, account.id, active_only=True

        )    name: str    name: str



        for selection in selected_repos:    full_name: str    full_name: str

            # Get the corresponding GitHubRepository record if it exists

            from sqlalchemy import select, and_    owner: str    owner: str

            from app.models.github_models import GitHubRepository

                is_private: bool    is_private: bool

            repo_query = await db.execute(

                select(GitHubRepository).where(    default_branch: str    default_branch: str

                    and_(

                        GitHubRepository.account_id == account.id,    account_username: str    account_username: str

                        GitHubRepository.github_repo_id == selection.github_repo_id

                    )

                )

            )

            repo = repo_query.scalar_one_or_none()

            class RepositoryStatusResponse(BaseModel):class RepositoryStatusResponse(BaseModel):

            # Use data from selection record, fallback to repo record if available

            repositories.append(GitHubRepositoryListItem(    """Response schema for repository status."""    """Response schema for repository status."""

                id=repo.id if repo else selection.id,  # Use internal repo ID if available

                name=selection.repo_name,    branch: str    branch: str

                full_name=selection.repo_full_name,

                owner=selection.repo_owner,    staged_files: List[str]    staged_files: List[str]

                is_private=selection.is_private,

                default_branch=selection.default_branch,    modified_files: List[str]    modified_files: List[str]

                account_username=account.username

            ))    untracked_files: List[str]    untracked_files: List[str]



    return repositories    has_changes: bool    has_changes: bool



    needs_attention: bool    needs_attention: bool

@router.get("/repositories/{repository_id}/branches")

async def get_repository_branches_for_save(    status_message: str    status_message: str

    repository_id: int,

    current_user: User = Depends(get_current_user),

    db: AsyncSession = Depends(get_db),

) -> List[dict]:

    """Get branches for a repository."""

    github_crud = GitHubCRUD()@router.get("/user-repositories")@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)



    # Validate repository accessasync def get_user_repositories_for_save(async def get_repository_status(

    repository = await _validate_repository_access(github_crud, db, repository_id, current_user)

        current_user: User = Depends(get_current_user),    repository_id: int,

    # Get branches from GitHub API

    try:    db: AsyncSession = Depends(get_db),    current_user: User = Depends(get_current_user),

        branches = await github_service.get_repository_branches(

            repository.account.access_token,) -> List[GitHubRepositoryListItem]:    db: AsyncSession = Depends(get_db),

            repository.repo_owner,

            repository.repo_name    """Get user's selected repositories available for saving documents.""") -> RepositoryStatusResponse:

        )

        return branches    github_crud = GitHubCRUD()    """Get the current git status of a repository."""

    except Exception as e:

        raise HTTPException(        from app.services.github.filesystem import github_filesystem_service

            status_code=status.HTTP_400_BAD_REQUEST,

            detail=f"Failed to get repository branches: {str(e)}"    # Get all user GitHub accounts    from pathlib import Path

        )

    accounts = await github_crud.get_user_accounts(db, current_user.id)    from app.configs.settings import settings



@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)

async def get_repository_status(

    repository_id: int,    if not accounts:    github_crud = GitHubCRUD()

    current_user: User = Depends(get_current_user),

    db: AsyncSession = Depends(get_db),        return []

) -> RepositoryStatusResponse:

    """Get the current git status of a repository."""        # Validate repository access

    from app.services.github.filesystem import github_filesystem_service

    from pathlib import Path    repositories = []    repository = await _validate_repository_access(github_crud, db, repository_id, current_user)

    from app.configs.settings import settings



    github_crud = GitHubCRUD()

        # Import the repository selector to get selected repositories    # Construct repository path

    # Validate repository access

    repository = await _validate_repository_access(github_crud, db, repository_id, current_user)    from app.services.github.repository_selector import GitHubRepositorySelector    repo_path = (



    # Construct repository path    repository_selector = GitHubRepositorySelector()        Path(settings.markdown_storage_root)

    repo_path = (

        Path(settings.markdown_storage_root)            / str(current_user.id)

        / str(current_user.id)

        / "github"    for account in accounts:        / "github"

        / str(repository.account_id)

        / repository.repo_name        # Get only selected repositories for this account        / str(repository.account_id)

    )

            selected_repos = await repository_selector.get_selected_repositories(        / repository.repo_name

    if not repo_path.exists() or not (repo_path / ".git").exists():

        return RepositoryStatusResponse(            db, account.id, active_only=True    )

            branch="unknown",

            staged_files=[],        )

            modified_files=[],

            untracked_files=[],            if not repo_path.exists() or not (repo_path / ".git").exists():

            has_changes=False,

            needs_attention=False,        for selection in selected_repos:        # Repository not cloned locally - no status issues

            status_message="Repository not cloned locally"

        )            # Get the corresponding GitHubRepository record if it exists        return RepositoryStatusResponse(



    # Get repository status            from sqlalchemy import select, and_            branch="main",

    status = await github_filesystem_service.get_repository_status(repo_path)

                from app.models.github_models import GitHubRepository            staged_files=[],

    if "error" in status:

        return RepositoryStatusResponse(                        modified_files=[],

            branch="unknown",

            staged_files=[],            repo_query = await db.execute(            untracked_files=[],

            modified_files=[],

            untracked_files=[],                select(GitHubRepository).where(            has_changes=False,

            has_changes=False,

            needs_attention=False,                    and_(            needs_attention=False,

            status_message=f"Error getting status: {status['error']}"

        )                        GitHubRepository.account_id == account.id,            status_message="Repository not cloned locally"



    # Determine if repository needs attention before branch operations                        GitHubRepository.github_repo_id == selection.github_repo_id        )

    needs_attention = status.get("has_changes", False)

                        )

    status_message = "Repository is clean"

    if needs_attention:                )    # Get repository status

        status_message = "Repository has uncommitted changes"

                )    status = await github_filesystem_service.get_repository_status(repo_path)

    return RepositoryStatusResponse(

        branch=status.get("branch", "unknown"),            repo = repo_query.scalar_one_or_none()

        staged_files=status.get("staged_files", []),

        modified_files=status.get("modified_files", []),                if "error" in status:

        untracked_files=status.get("untracked_files", []),

        has_changes=status.get("has_changes", False),            # Use data from selection record, fallback to repo record if available        raise HTTPException(

        needs_attention=needs_attention,

        status_message=status_message            repositories.append(GitHubRepositoryListItem(            status_code=status.HTTP_400_BAD_REQUEST,

    )

                id=repo.id if repo else selection.id,  # Use internal repo ID if available            detail=f"Failed to get repository status: {status['error']}"



@router.post("/documents/{document_id}/save", response_model=SaveToGitHubResponse)                name=selection.repo_name,        )

async def save_document_to_github(

    document_id: int,                full_name=selection.repo_full_name,

    save_request: SaveToGitHubRequest,

    current_user: User = Depends(get_current_user),                owner=selection.repo_owner,    # Determine if repository needs attention before branch operations

    db: AsyncSession = Depends(get_db),

) -> SaveToGitHubResponse:                is_private=selection.is_private,    needs_attention = status.get("has_changes", False)

    """Save a local document to GitHub repository."""

                    default_branch=selection.default_branch,

    # Initialize services

    document_crud = DocumentCRUD()                account_username=account.username    status_message = "Repository is clean"

    github_crud = GitHubCRUD()

    storage_service = UserStorage()            ))    if needs_attention:



    # Validate access            status_message = "Repository has uncommitted changes that need to be committed or stashed before creating branches"

    document = await _validate_document_access(document_crud, db, document_id, current_user)

    repository = await _validate_repository_access(github_crud, db, save_request.repository_id, current_user)    return repositories



    # Load document content    return RepositoryStatusResponse(

    document_content = await _load_document_content(storage_service, document, current_user)

            branch=status.get("branch", "unknown"),

    # Prepare file path and commit message

    file_path = save_request.file_path@router.get("/repositories/{repository_id}/branches")        staged_files=status.get("staged_files", []),

    if not file_path.endswith('.md'):

        file_path += '.md'async def get_repository_branches_for_save(        modified_files=status.get("modified_files", []),



    commit_message = save_request.commit_message or f"Add {document.title or 'document'}"    repository_id: int,        untracked_files=status.get("untracked_files", []),



    # Get existing file SHA if it exists (for updates)    current_user: User = Depends(get_current_user),        has_changes=status.get("has_changes", False),

    existing_sha = await _get_existing_file_sha(

        github_service, repository, file_path, save_request.branch    db: AsyncSession = Depends(get_db),        needs_attention=needs_attention,

    )

    ) -> List[dict]:        status_message=status_message

    try:

        # Save file to GitHub using the commit_file method    """Get branches for a repository."""    )

        result = await github_service.commit_file(

            access_token=repository.account.access_token,    github_crud = GitHubCRUD()

            owner=repository.repo_owner,

            repo=repository.repo_name,

            file_path=file_path,

            content=document_content,    # Validate repository access@router.get("/user-repositories")

            message=commit_message,

            branch=save_request.branch,    repository = await _validate_repository_access(github_crud, db, repository_id, current_user)async def get_user_repositories_for_save(

            sha=existing_sha,

            create_branch=save_request.create_branch,        current_user: User = Depends(get_current_user),

            base_branch=save_request.base_branch

        )    # Get branches from GitHub API    db: AsyncSession = Depends(get_db),



        # Create response    try:) -> List[GitHubRepositoryListItem]:

        repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}"

        file_url = f"{repo_url}/blob/{save_request.branch}/{file_path}"        branches = await github_service.get_repository_branches(    """Get user's selected repositories available for saving documents."""



        return SaveToGitHubResponse(            repository.account.access_token,    github_crud = GitHubCRUD()

            success=True,

            message="Document saved to GitHub successfully",            repository.repo_owner,

            repository_url=repo_url,

            file_url=file_url,            repository.repo_name    # Get all user GitHub accounts

            commit_sha=result.get("commit", {}).get("sha", "unknown"),

            branch=save_request.branch,        )    accounts = await github_crud.get_user_accounts(db, current_user.id)

            document_id=document_id

        )        return branches



    except Exception as e:    except Exception as e:    if not accounts:

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,        raise HTTPException(        return []

            detail=f"Failed to save document to GitHub: {str(e)}"

        )            status_code=status.HTTP_400_BAD_REQUEST,



            detail=f"Failed to get repository branches: {str(e)}"    repositories = []

async def _validate_document_access(

    document_crud: DocumentCRUD,        )

    db: AsyncSession,

    document_id: int,    # Import the repository selector to get selected repositories

    current_user: User

):    from app.services.github.repository_selector import GitHubRepositorySelector

    """Validate document ownership."""

    document = await document_crud.get(db, document_id)@router.get("/repositories/{repository_id}/status", response_model=RepositoryStatusResponse)    repository_selector = GitHubRepositorySelector()



    if not document or document.user_id != current_user.id:async def get_repository_status(

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,    repository_id: int,    for account in accounts:

            detail="Document not found"

        )    current_user: User = Depends(get_current_user),        # Get only selected repositories for this account



    return document    db: AsyncSession = Depends(get_db),        selected_repos = await repository_selector.get_selected_repositories(



) -> RepositoryStatusResponse:            db, account.id, active_only=True

async def _validate_repository_access(

    github_crud: GitHubCRUD,    """Get the current git status of a repository."""        )

    db: AsyncSession,

    repository_id: int,    from app.services.github.filesystem import github_filesystem_service

    current_user: User

):    from pathlib import Path        for selection in selected_repos:

    """Validate repository access for selected repositories."""

    # First try to get from GitHubRepository table    from app.configs.settings import settings            # Get the corresponding GitHubRepository record if it exists

    repository = await github_crud.get_repository(db, repository_id)

                    from sqlalchemy import select, and_

    if repository and repository.account.user_id == current_user.id:

        return repository    github_crud = GitHubCRUD()            from app.models.github_models import GitHubRepository



    # If not found in GitHubRepository, check if it's a selected repository

    from app.services.github.repository_selector import GitHubRepositorySelector

        # Validate repository access            repo_query = await db.execute(

    repository_selector = GitHubRepositorySelector()

        repository = await _validate_repository_access(github_crud, db, repository_id, current_user)                select(GitHubRepository).where(

    # Get all user accounts

    accounts = await github_crud.get_user_accounts(db, current_user.id)                        and_(



    for account in accounts:    # Construct repository path                        GitHubRepository.account_id == account.id,

        selected_repos = await repository_selector.get_selected_repositories(

            db, account.id, active_only=True    repo_path = (                        GitHubRepository.github_repo_id == selection.github_repo_id

        )

                Path(settings.markdown_storage_root)                    )

        for selection in selected_repos:

            # Check if this selection matches our repository_id        / str(current_user.id)                )

            if selection.id == repository_id:

                # Create a repository-like object from the selection data        / "github"            )

                class MockRepository:

                    def __init__(self, selection, account):        / str(repository.account_id)            repo = repo_query.scalar_one_or_none()

                        self.id = selection.id

                        self.repo_name = selection.repo_name        / repository.repo_name

                        self.repo_owner = selection.repo_owner

                        self.default_branch = selection.default_branch    )            # Use data from selection record, fallback to repo record if available

                        self.is_private = selection.is_private

                        self.github_repo_id = selection.github_repo_id                repositories.append(GitHubRepositoryListItem(

                        self.account = account

                        self.account_id = account.id    if not repo_path.exists() or not (repo_path / ".git").exists():                id=repo.id if repo else selection.id,  # Use internal repo ID if available



                return MockRepository(selection, account)        return RepositoryStatusResponse(                name=selection.repo_name,



    raise HTTPException(            branch="unknown",                full_name=selection.repo_full_name,

        status_code=status.HTTP_404_NOT_FOUND,

        detail="Repository not found or not selected"            staged_files=[],                owner=selection.repo_owner,

    )

            modified_files=[],                is_private=selection.is_private,



async def _load_document_content(            untracked_files=[],                default_branch=selection.default_branch,

    storage_service: UserStorage,

    document,            has_changes=False,                account_username=account.username

    current_user: User

) -> str:            needs_attention=False,            ))

    """Load document content from storage or fallback."""

    document_content = ""            status_message="Repository not cloned locally"



    if document.file_path:        )    return repositories

        try:

            content = await storage_service.read_document(

                user_id=current_user.id,

                file_path=document.file_path    # Get repository status

            )

            document_content = content or ""    status = await github_filesystem_service.get_repository_status(repo_path)@router.get("/repositories/{repository_id}/branches")

        except Exception:

            # Fallback to database content    async def get_repository_branches_for_save(

            document_content = getattr(document, 'content', "")

    else:    if "error" in status:    repository_id: int,

        # Legacy document without file_path

        document_content = getattr(document, 'content', "")        return RepositoryStatusResponse(    current_user: User = Depends(get_current_user),



    if not document_content:            branch="unknown",    db: AsyncSession = Depends(get_db),

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,            staged_files=[],) -> List[dict]:

            detail="Document has no content to save"

        )            modified_files=[],    """Get branches for a repository."""



    return document_content            untracked_files=[],    github_crud = GitHubCRUD()



            has_changes=False,

async def _get_existing_file_sha(

    github_service: GitHubService,            needs_attention=False,    # Validate repository access

    repository,

    file_path: str,            status_message=f"Error getting status: {status['error']}"    repository = await github_crud.get_repository(db, repository_id)

    branch: str

) -> Optional[str]:        )    if not repository or repository.account.user_id != current_user.id:

    """Get existing file SHA if file exists."""

    try:            raise HTTPException(

        _, existing_sha = await github_service.get_file_content(

            repository.account.access_token,    # Determine if repository needs attention before branch operations            status_code=status.HTTP_404_NOT_FOUND,

            repository.repo_owner,

            repository.repo_name,    needs_attention = status.get("has_changes", False)            detail="Repository not found"

            file_path,

            branch            )

        )

        return existing_sha    status_message = "Repository is clean"

    except Exception:

        # File doesn't exist, which is fine for new files    if needs_attention:    # Get branches from GitHub API

        return None
        status_message = "Repository has uncommitted changes"    try:

            branches = await github_service.get_repository_branches(

    return RepositoryStatusResponse(            repository.account.access_token,

        branch=status.get("branch", "unknown"),            repository.repo_owner,

        staged_files=status.get("staged_files", []),            repository.repo_name

        modified_files=status.get("modified_files", []),        )

        untracked_files=status.get("untracked_files", []),        return branches

        has_changes=status.get("has_changes", False),    except Exception as e:

        needs_attention=needs_attention,        raise HTTPException(

        status_message=status_message            status_code=status.HTTP_400_BAD_REQUEST,

    )            detail=f"Failed to get repository branches: {str(e)}"

        )



@router.post("/documents/{document_id}/save", response_model=SaveToGitHubResponse)

async def save_document_to_github(async def _validate_document_access(

    document_id: int,    document_crud: DocumentCRUD,

    save_request: SaveToGitHubRequest,    db: AsyncSession,

    current_user: User = Depends(get_current_user),    document_id: int,

    db: AsyncSession = Depends(get_db),    current_user: User

) -> SaveToGitHubResponse:):

    """Save a local document to GitHub repository."""    """Validate document ownership."""

        document = await document_crud.get(db, document_id)

    # Initialize services

    document_crud = DocumentCRUD()    if not document or document.user_id != current_user.id:

    github_crud = GitHubCRUD()        raise HTTPException(

    storage_service = UserStorage()            status_code=status.HTTP_404_NOT_FOUND,

                detail="Document not found"

    # Validate access        )

    document = await _validate_document_access(document_crud, db, document_id, current_user)

    repository = await _validate_repository_access(github_crud, db, save_request.repository_id, current_user)    return document



    # Load document content

    document_content = await _load_document_content(storage_service, document, current_user)async def _validate_repository_access(

        github_crud: GitHubCRUD,

    # Prepare file path and commit message    db: AsyncSession,

    file_path = save_request.file_path    repository_id: int,

    if not file_path.endswith('.md'):    current_user: User

        file_path += '.md'):

        """Validate repository access for selected repositories."""

    commit_message = save_request.commit_message or f"Add {document.title or 'document'}"    # First try to get from GitHubRepository table

        repository = await github_crud.get_repository(db, repository_id)

    # Get existing file SHA if it exists (for updates)

    existing_sha = await _get_existing_file_sha(    if repository and repository.account.user_id == current_user.id:

        github_service, repository, file_path, save_request.branch        return repository

    )

        # If not found in GitHubRepository, check if it's a selected repository

    try:    from app.services.github.repository_selector import GitHubRepositorySelector

        # Save file to GitHub using the commit_file method

        result = await github_service.commit_file(    repository_selector = GitHubRepositorySelector()

            access_token=repository.account.access_token,

            owner=repository.repo_owner,    # Get all user accounts

            repo=repository.repo_name,    accounts = await github_crud.get_user_accounts(db, current_user.id)

            file_path=file_path,

            content=document_content,    for account in accounts:

            message=commit_message,        selected_repos = await repository_selector.get_selected_repositories(

            branch=save_request.branch,            db, account.id, active_only=True

            sha=existing_sha,        )

            create_branch=save_request.create_branch,

            base_branch=save_request.base_branch        for selection in selected_repos:

        )            # Check if this selection matches our repository_id

                    # (repository_id might be the selection.id in this case)

        # Create response            if selection.id == repository_id:

        repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}"                # Create a repository-like object from the selection data

        file_url = f"{repo_url}/blob/{save_request.branch}/{file_path}"                class MockRepository:

                            def __init__(self, selection, account):

        return SaveToGitHubResponse(                        self.id = selection.id

            success=True,                        self.repo_name = selection.repo_name

            message="Document saved to GitHub successfully",                        self.repo_owner = selection.repo_owner

            repository_url=repo_url,                        self.default_branch = selection.default_branch

            file_url=file_url,                        self.is_private = selection.is_private

            commit_sha=result.get("commit", {}).get("sha", "unknown"),                        self.github_repo_id = selection.github_repo_id

            branch=save_request.branch,                        self.account = account

            document_id=document_id                        self.account_id = account.id

        )

                        return MockRepository(selection, account)

    except Exception as e:

        raise HTTPException(    raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,        status_code=status.HTTP_404_NOT_FOUND,

            detail=f"Failed to save document to GitHub: {str(e)}"        detail="Repository not found or not selected"

        )    )





async def _validate_document_access(async def _load_document_content(

    document_crud: DocumentCRUD,    storage_service: UserStorage,

    db: AsyncSession,    document,

    document_id: int,    current_user: User

    current_user: User) -> str:

):    """Load document content from storage or fallback."""

    """Validate document ownership."""    document_content = ""

    document = await document_crud.get(db, document_id)

        if document.file_path:

    if not document or document.user_id != current_user.id:        try:

        raise HTTPException(            content = await storage_service.read_document(

            status_code=status.HTTP_404_NOT_FOUND,                user_id=current_user.id,

            detail="Document not found"                file_path=document.file_path

        )            )

                document_content = content or ""

    return document        except Exception:

            # Fallback to empty content

            document_content = getattr(document, 'content', "")

async def _validate_repository_access(    else:

    github_crud: GitHubCRUD,        # Legacy document without file_path

    db: AsyncSession,        document_content = getattr(document, 'content', "")

    repository_id: int,

    current_user: User    if not document_content:

):        raise HTTPException(

    """Validate repository access for selected repositories."""            status_code=status.HTTP_400_BAD_REQUEST,

    # First try to get from GitHubRepository table            detail="Document has no content to save"

    repository = await github_crud.get_repository(db, repository_id)        )



    if repository and repository.account.user_id == current_user.id:    return document_content

        return repository



    # If not found in GitHubRepository, check if it's a selected repositoryasync def _get_existing_file_sha(

    from app.services.github.repository_selector import GitHubRepositorySelector    github_service: GitHubService,

        repository,

    repository_selector = GitHubRepositorySelector()    file_path: str,

        branch: str

    # Get all user accounts) -> Optional[str]:

    accounts = await github_crud.get_user_accounts(db, current_user.id)    """Get existing file SHA if file exists."""

        try:

    for account in accounts:        _, existing_sha = await github_service.get_file_content(

        selected_repos = await repository_selector.get_selected_repositories(            repository.account.access_token,

            db, account.id, active_only=True            repository.repo_owner,

        )            repository.repo_name,

                    file_path,

        for selection in selected_repos:            branch

            # Check if this selection matches our repository_id        )

            if selection.id == repository_id:        return existing_sha

                # Create a repository-like object from the selection data    except Exception:

                class MockRepository:        # File doesn't exist, which is fine for new files

                    def __init__(self, selection, account):        return None

                        self.id = selection.id

                        self.repo_name = selection.repo_name

                        self.repo_owner = selection.repo_owner@router.post("/documents/{document_id}/save", response_model=SaveToGitHubResponse)

                        self.default_branch = selection.default_branchasync def save_document_to_github(

                        self.is_private = selection.is_private    document_id: int,

                        self.github_repo_id = selection.github_repo_id    save_request: SaveToGitHubRequest,

                        self.account = account    current_user: User = Depends(get_current_user),

                        self.account_id = account.id    db: AsyncSession = Depends(get_db),

                ) -> SaveToGitHubResponse:

                return MockRepository(selection, account)    """Save a local document to GitHub repository."""



    raise HTTPException(    # Initialize services

        status_code=status.HTTP_404_NOT_FOUND,    document_crud = DocumentCRUD()

        detail="Repository not found or not selected"    github_crud = GitHubCRUD()

    )    storage_service = UserStorage()



    # Validate access

async def _load_document_content(    document = await _validate_document_access(document_crud, db, document_id, current_user)

    storage_service: UserStorage,    repository = await _validate_repository_access(github_crud, db, save_request.repository_id, current_user)

    document,

    current_user: User    # Load document content

) -> str:    document_content = await _load_document_content(storage_service, document, current_user)

    """Load document content from storage or fallback."""

    document_content = ""    # Prepare file path and commit message

        file_path = save_request.file_path

    if document.file_path:    if not file_path.endswith('.md'):

        try:        file_path += '.md'

            content = await storage_service.read_document(

                user_id=current_user.id,    commit_message = save_request.commit_message or f"Add {document.title or 'document'}"

                file_path=document.file_path

            )    # Get existing file SHA if it exists (for updates)

            document_content = content or ""    existing_sha = await _get_existing_file_sha(

        except Exception:        github_service, repository, file_path, save_request.branch

            # Fallback to database content    )

            document_content = getattr(document, 'content', "")

    else:    try:

        # Legacy document without file_path        # Create branch if requested

        document_content = getattr(document, 'content', "")        if save_request.create_branch:

                # Create branch using the API service's commit_file method with create_branch=True

    if not document_content:            pass  # Will be handled by the commit_file method

        raise HTTPException(

            status_code=status.HTTP_400_BAD_REQUEST,        # Save file to GitHub using the commit_file method

            detail="Document has no content to save"        result = await github_service.commit_file(

        )            access_token=repository.account.access_token,

                owner=repository.repo_owner,

    return document_content            repo=repository.repo_name,

            file_path=file_path,

            content=document_content,

async def _get_existing_file_sha(            message=commit_message,

    github_service: GitHubService,            branch=save_request.branch,

    repository,            sha=existing_sha,

    file_path: str,            create_branch=save_request.create_branch,

    branch: str            base_branch=save_request.base_branch

) -> Optional[str]:        )

    """Get existing file SHA if file exists."""

    try:        # Create response

        _, existing_sha = await github_service.get_file_content(        repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}"

            repository.account.access_token,        file_url = f"{repo_url}/blob/{save_request.branch}/{file_path}"

            repository.repo_owner,

            repository.repo_name,        return SaveToGitHubResponse(

            file_path,            success=True,

            branch            message="Document saved to GitHub successfully",

        )            repository_url=repo_url,

        return existing_sha            file_url=file_url,

    except Exception:            commit_sha=result.get("commit", {}).get("sha", "unknown"),

        # File doesn't exist, which is fine for new files            branch=save_request.branch,

        return None            document_id=document_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to save document to GitHub: {str(e)}"
        )

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

"""Enhanced GitHub import endpoints with folder structure support."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.github.importer import GitHubImportService
from app.services.github_service import GitHubService

router = APIRouter()


class GitHubImportRequest(BaseModel):
    branch: str = Field(default="main", max_length=100)
    file_paths: Optional[List[str]] = None  # If None, import all files
    overwrite_existing: bool = Field(default=False)


class GitHubSyncRequest(BaseModel):
    branch: str = Field(default="main", max_length=100)
    cleanup_orphaned: bool = Field(default=True)


class GitHubImportResponse(BaseModel):
    repository_id: int
    branch: str
    results: dict
    folder_structure: dict


class GitHubFileInfo(BaseModel):
    name: str
    path: str
    folder_path: str  # New: computed folder path in our system
    sha: str
    size: int
    type: str  # file or dir
    download_url: Optional[str] = None


@router.post("/repositories/{repository_id}/import")
async def import_repository_files(
    repository_id: int,
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Import files from GitHub repository with proper folder structure."""
    
    github_import_service = GitHubImportService(db)
    github_service = GitHubService()

    # Get repository
    repository = await github_import_service.get_repository_by_id(repository_id)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Get GitHub account and access token
    github_account = repository.account
    if not github_account or github_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to repository")

    access_token = github_account.access_token

    # Import files
    if import_request.file_paths:
        # Import specific files
        results = {'imported': [], 'updated': [], 'errors': [], 'skipped': []}
        for file_path in import_request.file_paths:
            try:
                # Get file info from GitHub
                file_content, sha = await github_service.get_file_content(
                    access_token,
                    repository.repo_owner,
                    repository.repo_name,
                    file_path,
                    import_request.branch
                )
                
                # Create file data structure
                file_data = {
                    'name': file_path.split('/')[-1],
                    'path': file_path,
                    'type': 'file',
                    'sha': sha
                }
                
                document = await github_import_service.import_repository_file(
                    current_user.id, repository, access_token, file_data, import_request.branch
                )
                
                results['imported'].append({
                    'document_id': document.id,
                    'file_path': file_path,
                    'name': document.name
                })
                
            except Exception as e:
                results['errors'].append({'file': file_path, 'error': str(e)})
    else:
        # Import entire repository
        results = await github_import_service.sync_repository_structure(
            current_user.id,
            repository,
            access_token,
            import_request.branch
        )

    # Get folder structure for response
    folder_structure = await github_import_service.get_folder_structure_for_user(current_user.id)

    return {
        "repository_id": repository_id,
        "branch": import_request.branch,
        "results": results,
        "folder_structure": folder_structure
    }


@router.post("/repositories/{repository_id}/sync")
async def sync_repository_structure(
    repository_id: int,
    sync_request: GitHubSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync repository structure and update folder paths."""
    
    github_import_service = GitHubImportService(db)

    # Get repository
    repository = await github_import_service.get_repository_by_id(repository_id)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Get GitHub account and access token
    github_account = repository.account
    if not github_account or github_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to repository")

    access_token = github_account.access_token

    # Sync repository structure
    results = await github_import_service.sync_repository_structure(
        current_user.id, repository, access_token, sync_request.branch
    )

    return {
        "repository_id": repository_id,
        "branch": sync_request.branch,
        "sync_results": results
    }


@router.get("/folders")
async def get_github_folders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all GitHub folder structures for the user."""
    
    github_import_service = GitHubImportService(db)
    folder_structure = await github_import_service.get_folder_structure_for_user(current_user.id)

    return folder_structure


@router.get("/repositories/{repository_id}/tree")
async def get_repository_tree_structure(
    repository_id: int,
    branch: str = "main",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get repository file tree structure for folder browsing."""
    
    github_import_service = GitHubImportService(db)
    github_service = GitHubService()

    # Get repository
    repository = await github_import_service.get_repository_by_id(repository_id)
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Get GitHub account and access token
    github_account = repository.account
    if not github_account or github_account.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to repository")

    access_token = github_account.access_token

    try:
        # Get repository contents
        contents = await github_service.get_repository_contents_cached(
            access_token,
            repository.repo_owner,
            repository.repo_name,
            repository.id,
            path="",
            ref=branch
        )

        # Build tree structure with folder paths
        tree_structure = []
        for item in contents:
            if item['type'] == 'file' and item['name'].endswith('.md'):
                folder_path = repository.get_file_folder_path(item['path'], branch)
                tree_structure.append({
                    'name': item['name'],
                    'path': item['path'],
                    'folder_path': folder_path,
                    'sha': item['sha'],
                    'size': item['size'],
                    'type': item['type'],
                    'download_url': item.get('download_url')
                })
            elif item['type'] == 'dir':
                tree_structure.append({
                    'name': item['name'],
                    'path': item['path'],
                    'folder_path': repository.get_branch_folder_path(branch) + '/' + item['path'],
                    'sha': item['sha'],
                    'size': item['size'],
                    'type': item['type'],
                    'download_url': None
                })

        return {
            'repository_id': repository_id,
            'branch': branch,
            'tree': tree_structure,
            'root_folder_path': repository.get_branch_folder_path(branch)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get repository tree: {str(e)}"
        )

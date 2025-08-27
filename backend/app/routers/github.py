"""GitHub integration API routes."""
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.github import (
    GitHubAccount,
    GitHubFileInfo,
    GitHubImportRequest,
    GitHubRepository,
    GitHubRepositoryResponse,
    GitHubCommitRequest,
    GitHubCommitResponse,
    GitHubStatusResponse,
    GitHubPullRequest,
    GitHubPullResponse,
    GitHubSyncHistoryEntry,
)
from app.services.github_service import GitHubService
from app.crud.github_crud import GitHubCRUD

router = APIRouter(tags=["github"])
github_service = GitHubService()


async def sync_repositories_background(
    account_id: int,
    access_token: str,
    db_session_factory,
):
    """Background task to sync repositories after OAuth connection."""
    try:
        # Create a new database session for the background task
        async with db_session_factory() as db:
            from app.crud.github_crud import GitHubCRUD
            github_crud = GitHubCRUD()

            # Fetch repositories from GitHub
            github_repos = await github_service.get_user_repositories(access_token)

            # Create or update repositories in database
            for repo_data in github_repos:
                repo_info = {
                    "github_repo_id": repo_data["id"],
                    "repo_name": repo_data["name"],
                    "repo_full_name": repo_data["full_name"],
                    "repo_owner": repo_data["owner"]["login"],
                    "description": repo_data.get("description"),
                    "default_branch": repo_data.get("default_branch", "main"),
                    "is_private": repo_data.get("private", False),
                    "account_id": account_id,
                }

                # Check if repository already exists
                existing_repo = await github_crud.get_repository_by_github_id(
                    db, repo_data["id"]
                )

                if existing_repo:
                    await github_crud.update_repository(db, existing_repo.id, repo_info)
                else:
                    await github_crud.create_repository(db, repo_info)

            await db.commit()

            # Update the account's last_sync timestamp
            from datetime import datetime
            await github_crud.update_account(db, account_id, {
                "last_sync": datetime.utcnow()  # Use naive UTC datetime
            })

            print(f"Successfully synced {len(github_repos)} repositories for account {account_id}")

    except Exception as sync_error:
        print(f"Background repository sync failed for account {account_id}: {sync_error}")


@router.get("/auth/url")
async def get_auth_url(current_user: User = Depends(get_current_user)) -> dict:
    """Generate GitHub OAuth authorization URL."""
    # Generate a random state for CSRF protection and include user ID
    random_state = secrets.token_urlsafe(24)
    # Encode user ID in the state (in production, use proper encryption)
    state = f"{current_user.id}:{random_state}"

    authorization_url = github_service.get_authorization_url(state)

    return {
        "authorization_url": authorization_url,
        "state": state
    }


@router.get("/auth/callback")
async def oauth_callback_page(
    code: str = Query(...),
    state: str = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """Handle GitHub OAuth callback and process the connection."""
    try:
        # Extract user ID from state
        if not state or ':' not in state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")

        user_id_str, _ = state.split(':', 1)
        user_id = int(user_id_str)

        # Get the user
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        # Exchange code for token
        token_data = await github_service.exchange_code_for_token(code, state)
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token")

        # Get user info from GitHub
        github_user = await github_service.get_user_info(access_token)

        # Check if GitHub account already exists and handle appropriately
        from app.crud.github_crud import GitHubCRUD
        github_crud = GitHubCRUD()

        # Check if account already exists by GitHub ID
        existing_account = await github_crud.get_account_by_github_id(
            db, github_user["id"]
        )

        if existing_account:
            # Account exists - update the access token and other info
            account_data = {
                "access_token": access_token,
                "username": github_user["login"],
                "display_name": github_user.get("name"),
                "email": github_user.get("email"),
                "avatar_url": github_user.get("avatar_url"),
            }
            account = await github_crud.update_account(db, existing_account.id, account_data)
            account_id = existing_account.id
        else:
            # Account doesn't exist - create new one
            account_data = {
                "github_id": github_user["id"],
                "username": github_user["login"],
                "display_name": github_user.get("name"),
                "email": github_user.get("email"),
                "avatar_url": github_user.get("avatar_url"),
                "access_token": access_token,
                "user_id": user.id,
            }
            account = await github_crud.create_account(db, account_data)
            account_id = account.id

        # Schedule background repository sync
        from app.database import AsyncSessionLocal
        background_tasks.add_task(
            sync_repositories_background,
            account_id,
            access_token,
            AsyncSessionLocal
        )

        # Success HTML
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>GitHub Connected</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 400px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }
                .success { color: #28a745; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>✓ GitHub Connected</h2>
                <p class="success">Your GitHub account has been connected successfully!</p>
                <p>This window will close automatically.</p>
            </div>

            <script>
                setTimeout(() => {
                    window.close();
                }, 2000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)

    except Exception as e:
        # Error HTML
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>GitHub Connection Failed</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f5f5f5;
                }}
                .container {{
                    max-width: 400px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }}
                .error {{ color: #dc3545; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>✗ Connection Failed</h2>
                <p class="error">Failed to connect your GitHub account.</p>
                <p>Error: {str(e)}</p>
                <p>This window will close automatically.</p>
            </div>

            <script>
                setTimeout(() => {{
                    window.close();
                }}, 3000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content)


@router.get("/accounts")
async def list_github_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubAccount]:
    """List user's GitHub accounts with repository counts."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    accounts = await github_crud.get_user_accounts(db, current_user.id)

    # Add repository count to each account
    enhanced_accounts = []
    for account in accounts:
        account_dict = {
            "id": account.id,
            "github_id": account.github_id,
            "username": account.username,
            "display_name": account.display_name,
            "email": account.email,
            "avatar_url": account.avatar_url,
            "is_active": account.is_active,
            "user_id": account.user_id,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
            "last_sync": account.last_sync,
            "repository_count": len(account.repositories) if account.repositories else 0
        }
        enhanced_accounts.append(GitHubAccount(**account_dict))

    return enhanced_accounts


@router.delete("/accounts/{account_id}")
async def disconnect_github_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Disconnect a GitHub account."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    await github_crud.delete_account(db, account_id)
    return {"message": "GitHub account disconnected successfully"}


@router.get("/repositories")
async def list_repositories(
    account_id: int = Query(None, description="GitHub account ID (optional - returns all if not specified)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepositoryResponse]:
    """List repositories for a GitHub account or all accounts."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    if account_id:
        # Get repositories for specific account
        account = await github_crud.get_account(db, account_id)
        if not account or account.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GitHub account not found"
            )
        repositories = await github_crud.get_account_repositories(db, account_id)
    else:
        # Get repositories for all user's GitHub accounts
        accounts = await github_crud.get_user_accounts(db, current_user.id)
        repositories = []
        for account in accounts:
            account_repos = await github_crud.get_account_repositories(db, account.id)
            repositories.extend(account_repos)

    return [GitHubRepositoryResponse.from_repo(repo) for repo in repositories]


@router.post("/repositories/sync")
async def sync_repositories(
    account_id: int = Query(..., description="GitHub account ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepository]:
    """Sync repositories from GitHub."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    # Fetch repositories from GitHub
    github_repos = await github_service.get_user_repositories(account.access_token)

    synced_repos = []
    for repo_data in github_repos:
        # Check if repository already exists
        existing_repo = await github_crud.get_repository_by_github_id(
            db, repo_data["id"]
        )

        if existing_repo:
            # Update existing repository
            update_data = {
                "repo_name": repo_data["name"],
                "description": repo_data.get("description"),
                "default_branch": repo_data["default_branch"],
                "is_private": repo_data["private"],
            }
            repo = await github_crud.update_repository(db, existing_repo.id, update_data)
        else:
            # Create new repository
            repo_create_data = {
                "github_repo_id": repo_data["id"],
                "repo_full_name": repo_data["full_name"],
                "repo_name": repo_data["name"],
                "repo_owner": repo_data["owner"]["login"],
                "description": repo_data.get("description"),
                "default_branch": repo_data["default_branch"],
                "is_private": repo_data["private"],
                "account_id": account_id,
            }
            repo = await github_crud.create_repository(db, repo_create_data)

        synced_repos.append(GitHubRepository.model_validate(repo))

    # Update the account's last_sync timestamp
    from datetime import datetime
    await github_crud.update_account(db, account_id, {
        "last_sync": datetime.utcnow()  # Use naive UTC datetime
    })

    return synced_repos


@router.get("/repositories/{repo_id}/files")
async def browse_repository_files(
    repo_id: int,
    path: str = Query("", description="Directory path to browse"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubFileInfo]:
    """Browse files in a GitHub repository."""
    from app.crud.github_crud import GitHubCRUD
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
        if item["type"] == "file" and item["name"].endswith((".md", ".markdown")):
            files.append(
                GitHubFileInfo(
                    path=item["path"],
                    name=item["name"],
                    sha=item["sha"],
                    size=item["size"],
                    download_url=item["download_url"],
                    content=None,  # Content not fetched during browsing
                )
            )

    return files


@router.get("/repositories/{repo_id}/contents")
async def get_repository_contents(
    repo_id: int,
    path: str = Query("", description="Directory path to browse"),
    branch: str = Query("main", description="Branch to browse"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """Get repository contents at a specific path - supports all file types."""
    from app.crud.github_crud import GitHubCRUD
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
            repo.account.access_token,
            repo.repo_owner,
            repo.repo_name,
            path,
            branch
        )

        # Return simplified structure for browsing
        return [
            {
                "name": item["name"],
                "path": item["path"],
                "type": item["type"],  # "file" or "dir"
                "size": item.get("size", 0),
                "download_url": item.get("download_url")
            }
            for item in contents
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repository contents: {str(e)}"
        )


@router.post("/import")
async def import_file_from_github(
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Import a markdown file from GitHub."""
    from app.crud.github_crud import GitHubCRUD
    from app.crud.document import DocumentCRUD

    github_crud = GitHubCRUD()
    document_crud = DocumentCRUD()

    repo = await github_crud.get_repository(db, import_request.repository_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get file content from GitHub
    content, sha = await github_service.get_file_content(
        repo.account.access_token,
        repo.repo_owner,
        repo.repo_name,
        import_request.file_path
    )

    # Create document
    document_name = import_request.document_name or import_request.file_path.split("/")[-1]

    document = await document_crud.create(
        db=db,
        user_id=current_user.id,
        name=document_name,
        content=content,
        category_id=import_request.category_id,
    )

    return {
        "message": "File imported successfully",
        "document_id": document.id,
        "document_name": document.name
    }


# Phase 2: Commit Workflow Endpoints

@router.post("/documents/{document_id}/commit", response_model=GitHubCommitResponse)
async def commit_document_to_github(
    document_id: int,
    commit_request: GitHubCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubCommitResponse:
    """Commit local document changes to GitHub."""
    from app.crud.document import DocumentCRUD
    from datetime import datetime

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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub repository not found"
        )

    account = repository.account
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to GitHub repository"
        )

    # Determine target branch
    target_branch = commit_request.branch or document.github_branch or repository.default_branch
    create_new_branch = commit_request.create_new_branch and bool(commit_request.new_branch_name)

    if create_new_branch and commit_request.new_branch_name:
        target_branch = commit_request.new_branch_name

    # Check for conflicts if not forcing
    if not commit_request.force_commit:
        file_status = await github_service.check_file_status(
            account.access_token,
            repository.repo_owner,
            repository.repo_name,
            document.github_file_path or "",
            target_branch,
            document.local_sha or ""
        )

        if file_status["has_remote_changes"]:
            # Generate current content hash
            current_local_hash = github_service.generate_content_hash(document.content)

            # Check if local has changes too (conflict)
            if current_local_hash != document.local_sha:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Conflicts detected. Remote and local changes exist. Use force_commit=true to override."
                )
            else:
                # Only remote changes, update local first
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Remote changes detected. Pull changes first or use force_commit=true to override."
                )

    try:
        # Commit to GitHub
        commit_result = await github_service.commit_file(
            access_token=account.access_token,
            owner=repository.repo_owner,
            repo=repository.repo_name,
            file_path=document.github_file_path or "",
            content=document.content,
            message=commit_request.commit_message,
            branch=target_branch,
            sha=document.github_sha if not create_new_branch else None,
            create_branch=create_new_branch,
            base_branch=document.github_branch or repository.default_branch if create_new_branch else None
        )

        # Update document metadata
        new_content_hash = github_service.generate_content_hash(document.content)

        document.github_sha = commit_result["content"]["sha"]
        document.local_sha = new_content_hash
        document.github_sync_status = "synced"
        document.last_github_sync_at = datetime.utcnow()
        document.github_commit_message = commit_request.commit_message

        # Update branch if creating new one
        if create_new_branch:
            document.github_branch = target_branch

        await db.commit()
        await db.refresh(document)

        # Log sync operation
        await github_crud.create_sync_history(db, {
            "repository_id": repository.id,
            "document_id": document.id,
            "operation": "commit",
            "status": "success",
            "commit_sha": commit_result["content"]["sha"],
            "branch_name": target_branch,
            "message": commit_request.commit_message,
            "files_changed": 1
        })

        return GitHubCommitResponse(
            success=True,
            commit_sha=commit_result["content"]["sha"],
            commit_url=commit_result["commit"]["html_url"],
            branch=target_branch,
            message="Changes committed successfully to GitHub"
        )

    except Exception as e:
        # Revert document status on failure
        await db.rollback()

        # Log failed operation
        await github_crud.create_sync_history(db, {
            "repository_id": repository.id,
            "document_id": document.id,
            "operation": "commit",
            "status": "error",
            "branch_name": target_branch,
            "message": commit_request.commit_message,
            "error_details": str(e),
            "files_changed": 0
        })

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit to GitHub: {str(e)}"
        )


@router.get("/documents/{document_id}/status", response_model=GitHubStatusResponse)
async def get_document_github_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> GitHubStatusResponse:
    """Get GitHub sync status for a document."""
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
        return GitHubStatusResponse(
            is_github_document=False,
            sync_status="local",
            has_local_changes=False,
            has_remote_changes=False,
            github_repository=None,
            github_branch=None,
            github_file_path=None,
            last_sync=None,
            status_info=document.github_status_info,
            remote_content=None
        )

    # Generate current content hash
    current_content_hash = github_service.generate_content_hash(document.content)
    has_local_changes = current_content_hash != (document.local_sha or "")

    # Check remote status if linked to GitHub
    has_remote_changes = False
    remote_content = None
    repository = None

    try:
        repository = await github_crud.get_repository(db, document.github_repository_id)
        if repository and repository.account.user_id == current_user.id:
            file_status = await github_service.check_file_status(
                repository.account.access_token,
                repository.repo_owner,
                repository.repo_name,
                document.github_file_path or "",
                document.github_branch or repository.default_branch,
                document.local_sha or ""
            )
            has_remote_changes = file_status["has_remote_changes"]
            remote_content = file_status["content"] if has_remote_changes else None
    except Exception:
        # If we can't check remote status, assume no changes
        pass

    # Determine overall status
    if has_local_changes and has_remote_changes:
        sync_status = "conflict"
    elif has_local_changes:
        sync_status = "local_changes"
    elif has_remote_changes:
        sync_status = "remote_changes"
    else:
        sync_status = "synced"

    # Update document sync status if it changed
    if document.github_sync_status != sync_status:
        document.github_sync_status = sync_status
        await db.commit()

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
        remote_content=remote_content
    )


@router.get("/documents/{document_id}/sync-history", response_model=List[GitHubSyncHistoryEntry])
async def get_document_sync_history(
    document_id: int,
    limit: int = Query(10, ge=1, le=50),
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
        return []

    history = await github_crud.get_document_sync_history(db, document_id, limit)
    return [GitHubSyncHistoryEntry.model_validate(entry) for entry in history]


@router.get("/repositories/{repo_id}/branches")
async def get_repository_branches(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """Get branches for a repository."""
    github_crud = GitHubCRUD()

    repo = await github_crud.get_repository(db, repo_id)
    if not repo or repo.account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Get branches from GitHub API
    branches = await github_service.get_branches(
        repo.account.access_token, repo.repo_owner, repo.repo_name
    )

    return [
        {
            "name": branch["name"],
            "commit_sha": branch["commit"]["sha"],
            "is_default": branch["name"] == repo.default_branch
        }
        for branch in branches
    ]

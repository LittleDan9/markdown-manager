"""GitHub integration API routes."""
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
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
)
from app.services.github_service import GitHubService

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
    account_id: int = Query(..., description="GitHub account ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[GitHubRepository]:
    """List repositories for a GitHub account."""
    from app.crud.github_crud import GitHubCRUD
    github_crud = GitHubCRUD()

    account = await github_crud.get_account(db, account_id)
    if not account or account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    repositories = await github_crud.get_account_repositories(db, account_id)
    return [GitHubRepository.model_validate(repo) for repo in repositories]


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

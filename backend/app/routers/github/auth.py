"""GitHub OAuth authentication endpoints."""
import os
import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db, AsyncSessionLocal
from app.models import User
from app.services.github_service import GitHubService
from app.services.storage import UserStorage

router = APIRouter()
github_service = GitHubService()


async def sync_repositories_background(
    account_id: int,
    user_id: int,
    access_token: str,
    db_session_factory,
):
    """Background task to sync repositories after OAuth connection."""
    try:
        # Create a new database session for the background task
        async with db_session_factory() as db:
            from app.crud.github_crud import GitHubCRUD
            github_crud = GitHubCRUD()

            # Initialize user storage service for filesystem operations
            user_storage_service = UserStorage()

            # Check if user has repository selections configured
            from app.services.github.repository_selector import GitHubRepositorySelector
            repository_selector = GitHubRepositorySelector()

            selected_repos = await repository_selector.get_selected_repositories(
                db, account_id, active_only=True
            )

            # If user has manual selections, only sync those
            if selected_repos:
                print(f"Using manual repository selections: {len(selected_repos)} repositories selected")
                # Get GitHub data for selected repositories only
                github_repos = await github_service.get_user_repositories(access_token, per_page=100)
                selected_repo_ids = {selection.github_repo_id for selection in selected_repos}

                # Filter to only selected repositories with sync enabled
                github_repos = [
                    repo for repo in github_repos
                    if repo['id'] in selected_repo_ids
                ]

                # Further filter by sync_enabled status
                enabled_selections = [s for s in selected_repos if s.sync_enabled]
                enabled_repo_ids = {selection.github_repo_id for selection in enabled_selections}
                github_repos = [
                    repo for repo in github_repos
                    if repo['id'] in enabled_repo_ids
                ]

                print(f"Syncing {len(github_repos)} manually selected repositories")
            else:
                # Fall back to automatic filtering for large organizations
                # First, get a small sample to check repository count
                initial_repos = await github_service.get_user_repositories(access_token, page=1, per_page=10)

                # If user has many repos (likely in large org), use filtered approach
                # This helps avoid syncing 1000+ repos from large organizations
                if len(initial_repos) >= 10:
                    # Use filtered repository access for large organizations
                    # Only sync recently updated, non-archived, non-fork repositories
                    github_repos = await github_service.get_user_repositories_filtered(
                        access_token,
                        max_repos=int(os.getenv("GITHUB_MAX_REPOS_PER_ACCOUNT", "50")),
                        min_updated_days=int(os.getenv("GITHUB_MIN_UPDATED_DAYS", "180")),
                        include_forks=os.getenv("GITHUB_INCLUDE_FORKS", "false").lower() == "true",
                        exclude_archived=os.getenv("GITHUB_EXCLUDE_ARCHIVED", "true").lower() == "true"
                    )
                    max_repos = int(os.getenv("GITHUB_MAX_REPOS_PER_ACCOUNT", "50"))
                    print(f"Large organization detected. Syncing {len(github_repos)} "
                          f"filtered repositories (max {max_repos})")
                else:
                    # For smaller accounts, sync all repositories
                    github_repos = await github_service.get_user_repositories(access_token)

            # Create or update repositories in database and clone to filesystem
            for repo_data in github_repos:
                # Check if repository already exists
                existing_repo = await github_crud.get_repository_by_github_id(
                    db, repo_data["id"]
                )

                if existing_repo:
                    # Update existing repository
                    update_data = {
                        "repo_full_name": repo_data["full_name"],
                        "repo_name": repo_data["name"],
                        "repo_owner": repo_data["owner"]["login"],
                        "description": repo_data.get("description"),
                        "default_branch": repo_data.get("default_branch", "main"),
                        "is_private": repo_data.get("private", False),
                    }
                    await github_crud.update_repository(db, existing_repo.id, update_data)
                else:
                    # Create new repository
                    repo_create_data = {
                        "account_id": account_id,
                        "github_repo_id": repo_data["id"],
                        "repo_full_name": repo_data["full_name"],
                        "repo_name": repo_data["name"],
                        "repo_owner": repo_data["owner"]["login"],
                        "description": repo_data.get("description"),
                        "default_branch": repo_data.get("default_branch", "main"),
                        "is_private": repo_data.get("private", False),
                        "is_enabled": True,
                    }
                    await github_crud.create_repository(db, repo_create_data)

                # Clone repository to filesystem if not already present
                try:
                    repo_dir = user_storage_service.get_github_repo_directory(
                        user_id, account_id, repo_data["name"]
                    )

                    if not repo_dir.exists():
                        # Construct clone URL with access token for private repos
                        clone_url = f"https://{access_token}@github.com/{repo_data['full_name']}.git"

                        clone_success = await user_storage_service.clone_github_repo(
                            user_id=user_id,
                            account_id=account_id,
                            repo_name=repo_data["name"],
                            repo_url=clone_url,
                            branch=repo_data.get("default_branch")
                        )

                        if clone_success:
                            print(f"Successfully cloned repository {repo_data['full_name']} to filesystem")
                        else:
                            print(f"Failed to clone repository {repo_data['full_name']} to filesystem")
                    else:
                        print(f"Repository {repo_data['full_name']} already exists on filesystem")

                except Exception as clone_error:
                    print(f"Error cloning repository {repo_data['full_name']}: {clone_error}")
                    # Don't fail the entire sync for individual clone errors

            await db.commit()

            # Update the account's last_sync timestamp
            from datetime import datetime
            await github_crud.update_account(db, account_id, {
                "last_sync": datetime.utcnow()
            })

            print(f"Successfully synced {len(github_repos)} repositories for account {account_id}")

    except Exception as sync_error:
        print(f"Background repository sync failed for account {account_id}: {sync_error}")


@router.get("/url")
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


@router.get("/url-with-logout")
async def get_auth_url_with_logout(current_user: User = Depends(get_current_user)) -> dict:
    """Generate GitHub OAuth authorization URL with logout option for account switching."""
    # Generate a random state for CSRF protection and include user ID
    random_state = secrets.token_urlsafe(24)
    # Encode user ID in the state (in production, use proper encryption)
    state = f"{current_user.id}:{random_state}"

    urls = github_service.get_authorization_url_with_logout(state)

    return {
        "authorization_url": urls["authorization_url"],
        "logout_url": urls["logout_url"],
        "state": state
    }


@router.get("/callback")
async def oauth_callback_page(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    error_uri: str = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle GitHub OAuth callback and process the connection."""
    try:
        # Check if this is an error response from GitHub
        if error:
            error_message = error_description or error or "GitHub OAuth authorization was denied"
            error_params = urlencode({
                "error": error,
                "error_description": error_description or "",
                "error_uri": error_uri or ""
            })
            return RedirectResponse(
                url=f"/api/static/html/github/oauth-error.html?{error_params}",
                status_code=302
            )

        # Check if we have the required code parameter
        if not code:
            error_params = urlencode({
                "error": "missing_code",
                "error_description": "Authorization code is required but not provided"
            })
            return RedirectResponse(
                url=f"/api/static/html/github/oauth-error.html?{error_params}",
                status_code=302
            )

        # Extract user ID from state
        if not state or ':' not in state:
            raise ValueError("Invalid state parameter")

        user_id_str, _ = state.split(':', 1)
        user_id = int(user_id_str)

        # Get the user
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")

        # Exchange code for token
        token_data = await github_service.exchange_code_for_token(code, state)
        access_token = token_data.get("access_token")

        if not access_token:
            raise ValueError("Failed to get access token")

        # Get user info from GitHub
        github_user = await github_service.get_user_info(access_token)

        # Check if GitHub account already exists and handle appropriately
        from app.crud.github_crud import GitHubCRUD
        github_crud = GitHubCRUD()

        # Initialize UserStorage for filesystem operations
        user_storage_service = UserStorage()

        # Check if account already exists by GitHub ID
        existing_account = await github_crud.get_account_by_github_id(
            db, github_user["id"]
        )

        if existing_account:
            # Update existing account
            account_id = existing_account.id
            await github_crud.update_account(db, account_id, {
                "access_token": access_token,
                "username": github_user["login"],
                "display_name": github_user.get("name", github_user["login"]),
                "avatar_url": github_user.get("avatar_url")
            })
        else:
            # Create new account
            account_data = {
                "user_id": user_id,
                "github_id": github_user["id"],
                "username": github_user["login"],
                "display_name": github_user.get("name", github_user["login"]),
                "avatar_url": github_user.get("avatar_url"),
                "access_token": access_token,
            }
            account = await github_crud.create_account(db, account_data)
            account_id = account.id

            # Create GitHub directory structure for new account
            try:
                github_account_dir = user_storage_service.get_github_account_directory(
                    user_id, account_id
                )
                github_account_dir.mkdir(parents=True, exist_ok=True)
                print(f"Created GitHub account directory: {github_account_dir}")
            except Exception as dir_error:
                print(f"Warning: Failed to create GitHub directory structure: {dir_error}")
                # Don't fail the OAuth process for directory creation issues

        await db.commit()

        # Schedule background repository sync
        background_tasks.add_task(
            sync_repositories_background,
            account_id,
            user_id,
            access_token,
            AsyncSessionLocal
        )

        # Redirect to success page
        return RedirectResponse(url="/api/static/html/github/oauth-success.html")

    except Exception as e:
        # Redirect to error page with error message as query parameter
        error_message = str(e)
        error_params = urlencode({"error": error_message})
        return RedirectResponse(
            url=f"/api/static/html/github/oauth-error.html?{error_params}",
            status_code=400
        )

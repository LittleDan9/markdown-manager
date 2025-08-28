"""GitHub OAuth authentication endpoints."""
import secrets
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db, AsyncSessionLocal
from app.models import User
from app.services.github_service import GitHubService

router = APIRouter()
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


@router.get("/callback")
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

        await db.commit()

        # Schedule background repository sync
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
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>GitHub Connection Error</title>
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
                <p>Please try again or contact support.</p>
            </div>

            <script>
                setTimeout(() => {{
                    window.close();
                }}, 5000);
            </script>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html, status_code=400)

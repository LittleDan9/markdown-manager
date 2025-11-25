"""Login and authentication endpoints."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.configs.environment import environment_config
from app.core.auth import authenticate_user, create_access_token
from app.core.mfa import verify_backup_code, verify_totp_code
from app.crud import user as crud_user
from app.crud.github_crud import GitHubCRUD
from app.database import get_db, AsyncSessionLocal
from app.schemas.user import LoginMFARequest, LoginResponse, Token, UserLogin
from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)
router = APIRouter()


async def should_sync_account(account, force_sync: bool) -> bool:
    """Check if a GitHub account should be synced based on last sync time."""
    if force_sync:
        return True

    if not account.last_sync:
        return True  # Never synced before

    # Only sync if it's been more than 1 hour since last sync
    time_since_sync = datetime.now(timezone.utc) - account.last_sync
    return time_since_sync.total_seconds() > 3600  # 1 hour


async def sync_account_repositories(db, github_crud, github_service, account):
    """Sync repositories for a single GitHub account."""
    try:
        github_repos = await github_service.get_user_repositories(account.access_token)

        for repo_data in github_repos:
            repo_info = {
                "github_repo_id": repo_data["id"],
                "repo_name": repo_data["name"],
                "repo_full_name": repo_data["full_name"],
                "repo_owner": repo_data["owner"]["login"],
                "description": repo_data.get("description"),
                "default_branch": repo_data.get("default_branch", "main"),
                "is_private": repo_data.get("private", False),
                "account_id": account.id,
            }

            existing_repo = await github_crud.get_repository_by_github_id(db, repo_data["id"])
            if existing_repo:
                await github_crud.update_repository(db, existing_repo.id, repo_info)
            else:
                await github_crud.create_repository(db, repo_info)

        # Update last sync time
        await github_crud.update_account(
            db, account.id, {"last_sync": datetime.now(timezone.utc)}
        )

        print(f"Successfully synced {len(github_repos)} repositories for GitHub account {account.id}")
        return True

    except Exception as e:
        print(f"Error syncing repositories for GitHub account {account.id}: {e}")
        return False


async def sync_user_github_repositories_background(user_id: int, force_sync: bool = False):
    """Background task to sync all GitHub repositories for a user.

    Args:
        user_id: The user ID to sync repositories for
        force_sync: If True, sync regardless of last sync time. If False, only sync
                   if it's been more than 1 hour since last sync.
    """
    # Skip background sync during tests
    import os
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("ALEMBIC_USE_SQLITE") == "true":
        print(f"Skipping GitHub background sync for user {user_id} (test environment)")
        return

    async with AsyncSessionLocal() as db:
        try:
            github_crud = GitHubCRUD()
            github_service = GitHubService()

            github_accounts = await github_crud.get_user_accounts(db, user_id)

            for account in github_accounts:
                if account.access_token and await should_sync_account(account, force_sync):
                    await sync_account_repositories(db, github_crud, github_service, account)
                elif not force_sync:
                    print(f"Skipping sync for GitHub account {account.id} (last synced recently)")

            await db.commit()

        except Exception as e:
            print(f"Error in background GitHub sync for user {user_id}: {e}")


def create_refresh_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


@router.post("/login", response_model=LoginResponse)
async def login(
    user_credentials: UserLogin,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Authenticate user and return access token (or require MFA)."""
    user = await authenticate_user(
        db, user_credentials.email, user_credentials.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    # Check if MFA is enabled
    if user.mfa_enabled:
        return LoginResponse(mfa_required=True)

    # Normal login flow (no MFA)
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    # Refresh token expires in 14 days (consistent with frontend expectations)
    refresh_token_expires = timedelta(days=14)
    refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
        domain=environment_config.get_cookie_domain(),
    )

    # Start background task to sync GitHub repositories
    background_tasks.add_task(
        sync_user_github_repositories_background,
        user.id,
        True  # force_sync=True for login
    )

    # Load current document content if it exists
    if user.current_document and user.current_document.file_path:
        from app.services.storage.user import UserStorage
        try:
            # Load content from filesystem and add it to the document model
            storage_service = UserStorage()
            content = await storage_service.read_document(
                user_id=user.id,
                file_path=user.current_document.file_path
            )
            # Add content attribute to the document model for serialization
            user.current_document.content = content or ""
        except Exception as e:
            # If content loading fails, set content to empty string
            logger.warning(f"Failed to load current document content for user {user.id}: {e}")
            user.current_document.content = ""

    return LoginResponse(
        mfa_required=False,
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    background_tasks: BackgroundTasks,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Refresh access token using a valid refresh token (from cookie)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not refresh_token:
        raise credentials_exception
    try:
        payload = jwt.decode(
            refresh_token, settings.secret_key, algorithms=[settings.algorithm]
        )
        email = payload.get("sub")
        if not isinstance(email, str) or not email:
            raise credentials_exception
        token_type = payload.get("type")
        if token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await crud_user.get_user_by_email(db, email=email)
    if user is None or not user.is_active:
        raise credentials_exception
    # Issue new access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    # Optionally refresh the refresh token itself (sliding window - 14 days)
    refresh_token_expires = timedelta(days=14)
    new_refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
        domain=environment_config.get_cookie_domain(),
    )

    # Start background task to sync GitHub repositories (respects 1-hour limit)
    background_tasks.add_task(
        sync_user_github_repositories_background,
        user.id,
        False  # force_sync=False for refresh token (only sync if > 1 hour since last sync)
    )

    # Load current document content if it exists
    if user.current_document and user.current_document.file_path:
        from app.services.storage.user import UserStorage
        try:
            # Load content from filesystem and add it to the document model
            storage_service = UserStorage()
            content = await storage_service.read_document(
                user_id=user.id,
                file_path=user.current_document.file_path
            )
            # Add content attribute to the document model for serialization
            user.current_document.content = content or ""
        except Exception as e:
            # If content loading fails, set content to empty string
            logger.warning(f"Failed to load current document content for user {user.id} (refresh): {e}")
            user.current_document.content = ""

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login-mfa", response_model=Token)
async def login_mfa(
    mfa_credentials: LoginMFARequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Complete MFA login with TOTP code."""
    # Re-authenticate the user (verify password again for security)
    user = await authenticate_user(db, mfa_credentials.email, mfa_credentials.password)
    if not user or not user.is_active or not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA login attempt",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify TOTP code or backup code
    totp_valid = verify_totp_code(str(user.totp_secret), mfa_credentials.code)
    backup_valid = False

    if not totp_valid and user.backup_codes:
        backup_valid, updated_codes = verify_backup_code(
            user.backup_codes, mfa_credentials.code
        )
        # Update backup codes if one was used
        if backup_valid:
            await crud_user.update_backup_codes(db, int(user.id), updated_codes)

    if not totp_valid and not backup_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code or backup code",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    # Refresh token expires in 14 days (consistent with frontend expectations)
    refresh_token_expires = timedelta(days=14)
    refresh_token = create_refresh_token({"sub": user.email}, refresh_token_expires)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,  # Environment-based setting
        samesite="lax",
        max_age=14 * 24 * 60 * 60,
        path="/",
        domain=environment_config.get_cookie_domain(),
    )

    # Start background task to sync GitHub repositories
    background_tasks.add_task(
        sync_user_github_repositories_background,
        user.id,
        True  # force_sync=True for login
    )

    # Load current document content if it exists
    if user.current_document and user.current_document.file_path:
        from app.services.storage.user import UserStorage
        try:
            # Load content from filesystem and add it to the document model
            storage_service = UserStorage()
            content = await storage_service.read_document(
                user_id=user.id,
                file_path=user.current_document.file_path
            )
            # Add content attribute to the document model for serialization
            user.current_document.content = content or ""
        except Exception as e:
            # If content loading fails, set content to empty string
            logger.warning(f"Failed to load current document content for user {user.id} (MFA): {e}")
            user.current_document.content = ""

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", path="/", domain=environment_config.get_cookie_domain())
    return {"message": "Logged out"}

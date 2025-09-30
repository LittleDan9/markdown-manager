"""GitHub settings API routes."""
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import github_settings as github_settings_crud
from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.github_settings import (
    GitHubSettingsCreate,
    GitHubSettingsResponse,
    GitHubSettingsUpdate,
)

router = APIRouter()


@router.get("/", response_model=GitHubSettingsResponse)
async def get_github_settings(
    github_account_id: Optional[int] = Query(None, description="GitHub account ID for account-specific settings"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get GitHub settings for the current user."""
    settings = await github_settings_crud.get_github_settings_by_user_id(
        db, current_user.id, github_account_id
    )

    if not settings:
        # Create default settings and return them instead of just defaults
        settings = await github_settings_crud.get_or_create_github_settings(
            db, current_user.id, github_account_id
        )

    return settings


@router.post("/", response_model=GitHubSettingsResponse)
async def create_github_settings(
    settings: GitHubSettingsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create GitHub settings for the current user."""
    # Check if settings already exist
    existing = await github_settings_crud.get_github_settings_by_user_id(
        db, current_user.id, settings.github_account_id
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="GitHub settings already exist for this user/account combination"
        )

    return await github_settings_crud.create_github_settings(db, current_user.id, settings)


@router.put("/", response_model=GitHubSettingsResponse)
async def update_github_settings(
    settings: GitHubSettingsUpdate,
    github_account_id: Optional[int] = Query(None, description="GitHub account ID for account-specific settings"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update GitHub settings for the current user."""
    updated_settings = await github_settings_crud.update_github_settings(
        db, current_user.id, settings, github_account_id
    )

    if not updated_settings:
        raise HTTPException(status_code=404, detail="GitHub settings not found")

    return updated_settings


@router.patch("/", response_model=GitHubSettingsResponse)
async def get_or_create_github_settings(
    github_account_id: Optional[int] = Query(None, description="GitHub account ID for account-specific settings"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get existing GitHub settings or create with defaults."""
    return await github_settings_crud.get_or_create_github_settings(
        db, current_user.id, github_account_id
    )


@router.delete("/", response_model=dict)
async def delete_github_settings(
    github_account_id: Optional[int] = Query(None, description="GitHub account ID for account-specific settings"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete GitHub settings for the current user."""
    deleted = await github_settings_crud.delete_github_settings(
        db, current_user.id, github_account_id
    )

    if not deleted:
        raise HTTPException(status_code=404, detail="GitHub settings not found")

    return {"message": "GitHub settings deleted successfully"}
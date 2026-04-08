"""Spell check settings API router."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import spell_check_settings as crud
from app.database import get_db
from app.models.user import User
from app.schemas.spell_check_settings import (
    SpellCheckSettingsRequest,
    SpellCheckSettingsResponse,
)

router = APIRouter(prefix="/spell-check-settings", tags=["spell-check-settings"])


@router.get("/", response_model=SpellCheckSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get spell check settings for the current user. Returns 404 if no settings saved (use client defaults)."""
    settings = await crud.get_settings(db, int(current_user.id))
    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spell check settings not found, use client defaults",
        )
    return settings


@router.put("/", response_model=SpellCheckSettingsResponse)
async def save_settings(
    data: SpellCheckSettingsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create or update spell check settings for the current user."""
    return await crud.upsert_settings(db, int(current_user.id), data)


@router.delete("/")
async def reset_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Reset spell check settings to defaults by deleting the user's configuration."""
    deleted = await crud.delete_settings(db, int(current_user.id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No settings to reset",
        )
    return {"message": "Settings reset to defaults"}

"""CRUD operations for spell check settings."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.spell_check_settings import SpellCheckSettings
from app.schemas.spell_check_settings import SpellCheckSettingsRequest


async def get_settings(db: AsyncSession, user_id: int) -> Optional[SpellCheckSettings]:
    """Get spell check settings for a user."""
    result = await db.execute(
        select(SpellCheckSettings).where(SpellCheckSettings.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def upsert_settings(
    db: AsyncSession, user_id: int, data: SpellCheckSettingsRequest
) -> SpellCheckSettings:
    """Create or update spell check settings for a user."""
    result = await db.execute(
        select(SpellCheckSettings).where(SpellCheckSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = SpellCheckSettings(user_id=user_id)
        db.add(settings)

    # Only update fields that were provided
    if data.analysis_types is not None:
        settings.analysis_types = data.analysis_types
    if data.grammar_rules is not None:
        settings.grammar_rules = data.grammar_rules
    if data.style_settings is not None:
        settings.style_settings = data.style_settings
    if data.code_spell_settings is not None:
        settings.code_spell_settings = data.code_spell_settings
    if data.selected_language is not None:
        settings.selected_language = data.selected_language
    if data.selected_style_guide is not None:
        settings.selected_style_guide = data.selected_style_guide

    await db.commit()
    await db.refresh(settings)
    return settings


async def delete_settings(db: AsyncSession, user_id: int) -> bool:
    """Delete spell check settings for a user (resets to defaults)."""
    result = await db.execute(
        select(SpellCheckSettings).where(SpellCheckSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        return False

    await db.delete(settings)
    await db.commit()
    return True

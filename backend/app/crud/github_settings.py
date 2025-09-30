"""CRUD operations for GitHub settings."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github_settings import GitHubSettings
from app.schemas.github_settings import GitHubSettingsCreate, GitHubSettingsUpdate


async def get_github_settings_by_user_id(
    db: AsyncSession, user_id: int, github_account_id: Optional[int] = None
) -> Optional[GitHubSettings]:
    """Get GitHub settings for a user, optionally filtered by account."""
    query = select(GitHubSettings).where(GitHubSettings.user_id == user_id)

    if github_account_id is not None:
        query = query.where(GitHubSettings.github_account_id == github_account_id)
    else:
        # For global settings, get settings without account_id
        query = query.where(GitHubSettings.github_account_id.is_(None))

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_github_settings(
    db: AsyncSession, user_id: int, settings: GitHubSettingsCreate
) -> GitHubSettings:
    """Create new GitHub settings for a user."""
    db_settings = GitHubSettings(
        user_id=user_id,
        github_account_id=settings.github_account_id,
        auto_convert_diagrams=settings.auto_convert_diagrams,
        diagram_format=settings.diagram_format,
        fallback_to_standard=settings.fallback_to_standard,
        auto_sync_enabled=settings.auto_sync_enabled,
        default_commit_message=settings.default_commit_message,
        auto_push_enabled=settings.auto_push_enabled,
    )

    db.add(db_settings)
    await db.commit()
    await db.refresh(db_settings)
    return db_settings


async def update_github_settings(
    db: AsyncSession,
    user_id: int,
    settings: GitHubSettingsUpdate,
    github_account_id: Optional[int] = None
) -> Optional[GitHubSettings]:
    """Update GitHub settings for a user."""
    db_settings = await get_github_settings_by_user_id(db, user_id, github_account_id)

    if not db_settings:
        return None

    # Update fields that are provided
    update_data = settings.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_settings, field, value)

    await db.commit()
    await db.refresh(db_settings)
    return db_settings


async def get_or_create_github_settings(
    db: AsyncSession,
    user_id: int,
    github_account_id: Optional[int] = None
) -> GitHubSettings:
    """Get existing settings or create with defaults."""
    settings = await get_github_settings_by_user_id(db, user_id, github_account_id)

    if not settings:
        # Create with defaults
        default_settings = GitHubSettingsCreate(
            github_account_id=github_account_id,
            auto_convert_diagrams=False,
            diagram_format="svg",
            fallback_to_standard=True,
            auto_sync_enabled=True,
            default_commit_message=None,
            auto_push_enabled=False,
        )
        settings = await create_github_settings(db, user_id, default_settings)

    return settings


async def delete_github_settings(
    db: AsyncSession,
    user_id: int,
    github_account_id: Optional[int] = None
) -> bool:
    """Delete GitHub settings for a user."""
    settings = await get_github_settings_by_user_id(db, user_id, github_account_id)

    if not settings:
        return False

    await db.delete(settings)
    await db.commit()
    return True
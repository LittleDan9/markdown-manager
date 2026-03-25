"""
Attachment quota service for enforcing per-user storage limits.

Resolves effective quota via: per-user override → site default → hardcoded fallback.
"""
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site_setting import SiteSetting
from app.models.user import User
from app.crud.attachment import attachment_crud

logger = logging.getLogger(__name__)

# Default quota: 500 MB
DEFAULT_QUOTA_BYTES = 500 * 1024 * 1024
SITE_SETTING_KEY = "attachment.quota_bytes"


@dataclass
class QuotaUsage:
    """Current quota usage for a user."""

    used_bytes: int
    quota_bytes: int
    remaining_bytes: int
    percentage_used: float


@dataclass
class QuotaCheckResult:
    """Result of a quota check before upload."""

    allowed: bool
    usage: QuotaUsage
    message: Optional[str] = None


async def get_site_default_quota(db: AsyncSession) -> int:
    """Get the site-wide default attachment quota from settings."""
    result = await db.execute(
        select(SiteSetting.value).where(SiteSetting.key == SITE_SETTING_KEY)
    )
    value = result.scalar_one_or_none()
    if value is not None:
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning("Invalid site setting %s value: %s", SITE_SETTING_KEY, value)
    return DEFAULT_QUOTA_BYTES


async def get_effective_quota(db: AsyncSession, user_id: int) -> int:
    """
    Get the effective attachment quota for a user.

    Priority: per-user override → site default → hardcoded fallback.
    """
    # Check per-user override
    result = await db.execute(
        select(User.attachment_quota_bytes).where(User.id == user_id)
    )
    user_quota = result.scalar_one_or_none()
    if user_quota is not None:
        return user_quota

    # Fall back to site default
    return await get_site_default_quota(db)


async def get_quota_usage(db: AsyncSession, user_id: int) -> QuotaUsage:
    """Get current quota usage for a user."""
    used_bytes = await attachment_crud.get_user_total_size(db, user_id)
    quota_bytes = await get_effective_quota(db, user_id)
    remaining = max(0, quota_bytes - used_bytes)
    percentage = (used_bytes / quota_bytes * 100) if quota_bytes > 0 else 0.0

    return QuotaUsage(
        used_bytes=used_bytes,
        quota_bytes=quota_bytes,
        remaining_bytes=remaining,
        percentage_used=round(percentage, 1),
    )


async def check_quota(
    db: AsyncSession, user_id: int, incoming_file_size: int
) -> QuotaCheckResult:
    """
    Check if a user has enough quota for an incoming file.

    Args:
        db: Database session.
        user_id: The user's ID.
        incoming_file_size: Size of the file being uploaded in bytes.

    Returns:
        QuotaCheckResult indicating whether the upload is allowed.
    """
    usage = await get_quota_usage(db, user_id)

    if usage.used_bytes + incoming_file_size > usage.quota_bytes:
        return QuotaCheckResult(
            allowed=False,
            usage=usage,
            message=(
                f"Attachment quota exceeded. "
                f"Used: {_format_bytes(usage.used_bytes)}, "
                f"Quota: {_format_bytes(usage.quota_bytes)}, "
                f"File: {_format_bytes(incoming_file_size)}, "
                f"Remaining: {_format_bytes(usage.remaining_bytes)}"
            ),
        )

    return QuotaCheckResult(allowed=True, usage=usage)


def _format_bytes(size: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(size) < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024  # type: ignore[assignment]
    return f"{size:.1f} TB"

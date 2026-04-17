"""CRUD operations for user API keys."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs.settings import get_settings
from app.models.user_api_key import UserApiKey, encrypt_api_key, decrypt_api_key


async def get_keys_for_user(db: AsyncSession, user_id: int) -> list[UserApiKey]:
    """Return all API keys belonging to a user (newest first)."""
    result = await db.execute(
        select(UserApiKey)
        .where(UserApiKey.user_id == user_id)
        .order_by(UserApiKey.created_at.desc())
    )
    return list(result.scalars().all())


async def get_key_by_id(db: AsyncSession, key_id: int, user_id: int) -> UserApiKey | None:
    """Return a single key owned by *user_id*, or None."""
    result = await db.execute(
        select(UserApiKey).where(
            UserApiKey.id == key_id,
            UserApiKey.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_active_key(db: AsyncSession, user_id: int, provider: str) -> UserApiKey | None:
    """Return the active key for a given provider, or None."""
    result = await db.execute(
        select(UserApiKey).where(
            UserApiKey.user_id == user_id,
            UserApiKey.provider == provider,
            UserApiKey.is_active == True,  # noqa: E712
        )
        .order_by(UserApiKey.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_key(
    db: AsyncSession,
    user_id: int,
    provider: str,
    api_key: str,
    label: str | None = None,
    base_url: str | None = None,
    preferred_model: str | None = None,
    org_name: str | None = None,
) -> UserApiKey:
    """Create a new encrypted API key record."""
    secret = get_settings().secret_key
    row = UserApiKey(
        user_id=user_id,
        provider=provider,
        api_key_encrypted=encrypt_api_key(api_key, secret),
        label=label,
        base_url=base_url,
        preferred_model=preferred_model,
        org_name=org_name,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_key(
    db: AsyncSession,
    key_id: int,
    user_id: int,
    *,
    label: str | None = ...,  # type: ignore[assignment]
    base_url: str | None = ...,  # type: ignore[assignment]
    preferred_model: str | None = ...,  # type: ignore[assignment]
    org_name: str | None = ...,  # type: ignore[assignment]
    is_active: bool | None = None,
    api_key: str | None = None,
) -> UserApiKey | None:
    """Update fields on an existing key.  Sentinel ``...`` means 'no change'."""
    row = await get_key_by_id(db, key_id, user_id)
    if row is None:
        return None

    if label is not ...:
        row.label = label
    if base_url is not ...:
        row.base_url = base_url
    if preferred_model is not ...:
        row.preferred_model = preferred_model
    if org_name is not ...:
        row.org_name = org_name
    if is_active is not None:
        row.is_active = is_active
    if api_key is not None:
        secret = get_settings().secret_key
        row.api_key_encrypted = encrypt_api_key(api_key, secret)

    await db.commit()
    await db.refresh(row)
    return row


async def delete_key(db: AsyncSession, key_id: int, user_id: int) -> bool:
    """Delete a key.  Returns True if deleted, False if not found."""
    row = await get_key_by_id(db, key_id, user_id)
    if row is None:
        return False
    await db.delete(row)
    await db.commit()
    return True


def get_decrypted_api_key(row: UserApiKey) -> str:
    """Decrypt the API key from a UserApiKey row — used only at request time."""
    secret = get_settings().secret_key
    return decrypt_api_key(row.api_key_encrypted, secret)

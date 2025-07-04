"""User CRUD operations."""
from typing import Optional
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user: UserCreate) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
        bio=user.bio,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def update_user(
    db: AsyncSession, user_id: int, user_update: UserUpdate
) -> Optional[User]:
    """Update user information."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return None
    
    # Update only provided fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def update_user_password(
    db: AsyncSession, user_id: int, current_password: str, new_password: str
) -> bool:
    """Update user password."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return False
    
    # Verify current password
    if not verify_password(current_password, db_user.hashed_password):
        return False
    
    # Update password
    db_user.hashed_password = get_password_hash(new_password)
    await db.commit()
    return True


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Delete user."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return False
    
    await db.delete(db_user)
    await db.commit()
    return True


async def create_password_reset_token(
    db: AsyncSession, email: str, token: str, expires_at: datetime
) -> Optional[User]:
    """Create password reset token for user."""
    result = await db.execute(select(User).where(User.email == email))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return None
    
    db_user.reset_token = token
    db_user.reset_token_expires = expires_at
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def verify_password_reset_token(
    db: AsyncSession, token: str
) -> Optional[User]:
    """Verify password reset token and return user if valid."""
    result = await db.execute(
        select(User).where(
            User.reset_token == token,
            User.reset_token_expires > datetime.utcnow()
        )
    )
    return result.scalar_one_or_none()


async def reset_password_with_token(
    db: AsyncSession, token: str, new_password: str
) -> bool:
    """Reset password using valid token."""
    user = await verify_password_reset_token(db, token)
    if not user:
        return False
    
    # Update password and clear reset token
    user.hashed_password = get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    return True


async def setup_mfa(
    db: AsyncSession, user_id: int, secret: str, backup_codes: str
) -> bool:
    """Set up MFA for a user with secret and backup codes."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return False
    
    db_user.totp_secret = secret
    db_user.backup_codes = backup_codes
    db_user.mfa_enabled = False  # Not enabled until verified
    await db.commit()
    return True


async def enable_mfa(db: AsyncSession, user_id: int) -> bool:
    """Enable MFA for a user (after verification)."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user or not db_user.totp_secret:
        return False
    
    db_user.mfa_enabled = True
    await db.commit()
    return True


async def disable_mfa(db: AsyncSession, user_id: int) -> bool:
    """Disable MFA for a user and clear secrets."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return False
    
    db_user.mfa_enabled = False
    db_user.totp_secret = None
    db_user.backup_codes = None
    await db.commit()
    return True


async def update_backup_codes(
    db: AsyncSession, user_id: int, backup_codes: str
) -> bool:
    """Update backup codes for a user (after using one)."""
    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        return False
    
    db_user.backup_codes = backup_codes
    await db.commit()
    return True

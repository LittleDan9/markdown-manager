"""Admin user management API routes."""
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_admin_user
from app.database import get_db
from app.models.user import User
from pydantic import BaseModel, Field


# Admin-specific schemas
class AdminUserResponse(BaseModel):
    """Admin user response with essential fields and admin-specific info."""

    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool
    mfa_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    full_name: str
    sync_preview_scroll_enabled: bool
    autosave_enabled: bool
    editor_width_percentage: int
    current_doc_id: Optional[int] = None

    # Admin-specific fields
    last_login: Optional[datetime] = None
    reset_token_expires: Optional[datetime] = None
    document_count: Optional[int] = 0
    github_account_count: Optional[int] = 0

    class Config:
        from_attributes = True


class UserUpdateAdmin(BaseModel):
    """Admin user update schema."""

    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_verified: Optional[bool] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None


class ResetMFARequest(BaseModel):
    """Reset MFA request schema."""

    reason: Optional[str] = Field(None, description="Optional reason for MFA reset")


router = APIRouter(tags=["Admin - Users"])


@router.get("/stats")
async def get_user_stats(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get user statistics for admin dashboard."""
    # Get user counts
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True)))
    admin_users = await db.scalar(select(func.count(User.id)).where(User.is_admin.is_(True)))
    verified_users = await db.scalar(select(func.count(User.id)).where(User.is_verified.is_(True)))
    mfa_enabled_users = await db.scalar(select(func.count(User.id)).where(User.mfa_enabled.is_(True)))

    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "inactive_users": (total_users or 0) - (active_users or 0),
        "admin_users": admin_users or 0,
        "verified_users": verified_users or 0,
        "mfa_enabled_users": mfa_enabled_users or 0,
        "generated_at": datetime.utcnow()
    }


@router.get("", response_model=List[AdminUserResponse])
async def get_all_users(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    active_only: Optional[bool] = None,
    search: Optional[str] = None,
) -> Any:
    """Get all users with admin information."""
    query = select(User).options(
        selectinload(User.current_document),
        selectinload(User.documents),
        selectinload(User.github_accounts)
    )

    # Apply filters
    if active_only is not None:
        query = query.where(User.is_active == active_only)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            (User.email.ilike(search_term))
            | (User.first_name.ilike(search_term))
            | (User.last_name.ilike(search_term))
            | (User.display_name.ilike(search_term))
        )

    # Add ordering and pagination
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    # Convert to admin response format
    admin_users = []
    for user in users:
        admin_user_data = AdminUserResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            display_name=user.display_name,
            bio=user.bio,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_admin=user.is_admin,
            mfa_enabled=user.mfa_enabled,
            created_at=user.created_at,
            updated_at=user.updated_at,
            full_name=user.full_name,
            sync_preview_scroll_enabled=user.sync_preview_scroll_enabled,
            autosave_enabled=user.autosave_enabled,
            editor_width_percentage=user.editor_width_percentage,
            current_doc_id=user.current_doc_id,
            last_login=None,  # TODO: Implement last_login tracking
            reset_token_expires=user.reset_token_expires,
            document_count=len(user.documents) if user.documents else 0,
            github_account_count=len(user.github_accounts) if user.github_accounts else 0
        )
        admin_users.append(admin_user_data)

    return admin_users


@router.get("/{user_id}", response_model=AdminUserResponse)
async def get_user_by_id(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get specific user details by ID."""
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.current_document),
            selectinload(User.documents),
            selectinload(User.github_accounts)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    admin_user_data = AdminUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
        bio=user.bio,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_admin=user.is_admin,
        mfa_enabled=user.mfa_enabled,
        created_at=user.created_at,
        updated_at=user.updated_at,
        full_name=user.full_name,
        sync_preview_scroll_enabled=user.sync_preview_scroll_enabled,
        autosave_enabled=user.autosave_enabled,
        editor_width_percentage=user.editor_width_percentage,
        current_doc_id=user.current_doc_id,
        last_login=None,  # TODO: Implement last_login tracking
        reset_token_expires=user.reset_token_expires,
        document_count=len(user.documents) if user.documents else 0,
        github_account_count=len(user.github_accounts) if user.github_accounts else 0
    )

    return admin_user_data


@router.put("/{user_id}", response_model=AdminUserResponse)
async def update_user_admin(
    user_id: int,
    user_update: UserUpdateAdmin,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update user details as admin."""
    # Prevent admin from demoting themselves
    if user_id == admin_user.id and user_update.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove admin privileges from yourself"
        )

    # Get the user to update
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.documents),
            selectinload(User.github_accounts)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update user fields
    update_data = {}
    for field, value in user_update.model_dump(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value

    if update_data:
        update_data['updated_at'] = datetime.utcnow()

        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**update_data)
        )
        await db.commit()

        # Refresh user data
        await db.refresh(user)

    admin_user_data = AdminUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
        bio=user.bio,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_admin=user.is_admin,
        mfa_enabled=user.mfa_enabled,
        created_at=user.created_at,
        updated_at=user.updated_at,
        full_name=user.full_name,
        sync_preview_scroll_enabled=user.sync_preview_scroll_enabled,
        autosave_enabled=user.autosave_enabled,
        editor_width_percentage=user.editor_width_percentage,
        current_doc_id=user.current_doc_id,
        last_login=None,
        reset_token_expires=user.reset_token_expires,
        document_count=len(user.documents) if user.documents else 0,
        github_account_count=len(user.github_accounts) if user.github_accounts else 0
    )

    return admin_user_data


@router.post("/{user_id}/reset-mfa")
async def reset_user_mfa(
    user_id: int,
    reset_request: ResetMFARequest,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Reset user's MFA settings."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Reset MFA settings
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            mfa_enabled=False,
            totp_secret=None,
            backup_codes=None,
            updated_at=datetime.utcnow()
        )
    )
    await db.commit()

    return {
        "message": f"MFA reset for user {user.email}",
        "reason": reset_request.reason,
        "reset_by": admin_user.email,
        "reset_at": datetime.utcnow()
    }


@router.delete("/{user_id}")
async def delete_user_admin(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete user account as admin (only if inactive)."""
    # Prevent admin from deleting themselves
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Only allow deletion of inactive users
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete active user. Disable the user first."
        )

    # Delete the user (this will cascade to related records)
    await db.delete(user)
    await db.commit()

    return {
        "message": f"User {user.email} (ID: {user_id}) deleted successfully",
        "deleted_by": admin_user.email,
        "deleted_at": datetime.utcnow()
    }

"""User management API routes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_active_user
from app.crud import user as crud_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserUpdatePassword
from app.routers.documents.response_utils import create_document_response

router = APIRouter()


@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get user profile with properly loaded current document."""
    # Load user with current_document relationship
    result = await db.execute(
        select(User)
        .options(selectinload(User.current_document))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Handle current_document separately
    current_document_response = None
    if user.current_document:
        try:
            current_document_response = await create_document_response(
                document=user.current_document,
                user_id=user.id
            )
        except Exception as e:
            # Log the error but don't fail the entire request
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to load current document content for user {user.id}: {e}")
            current_document_response = None

    # Create response with properly loaded current_document
    user_data = UserResponse.model_validate(user)
    if current_document_response:
        user_data = user_data.model_copy(update={"current_document": current_document_response})

    return user_data


@router.put("/profile", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update user profile and settings."""
    updated_user = await crud_user.update_user(db, int(current_user.id), user_update)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Load user with current_document relationship for proper response
    result = await db.execute(
        select(User)
        .options(selectinload(User.current_document))
        .where(User.id == updated_user.id)
    )
    user_with_document = result.scalar_one_or_none()

    if not user_with_document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Handle current_document separately
    current_document_response = None
    if user_with_document.current_document:
        try:
            current_document_response = await create_document_response(
                document=user_with_document.current_document,
                user_id=user_with_document.id
            )
        except Exception as e:
            # Log the error but don't fail the entire request
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to load current document content for user {user_with_document.id}: {e}")
            current_document_response = None

    # Create response with properly loaded current_document
    user_data = UserResponse.model_validate(user_with_document)
    if current_document_response:
        user_data = user_data.model_copy(update={"current_document": current_document_response})

    return user_data


@router.put("/password")
async def update_password(
    password_update: UserUpdatePassword,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update user password."""
    success = await crud_user.update_user_password(
        db,
        int(current_user.id),
        password_update.current_password,
        password_update.new_password,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"message": "Password updated successfully"}


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete user account."""
    success = await crud_user.delete_user(db, int(current_user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return {"message": "Account deleted successfully"}

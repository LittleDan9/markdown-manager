"""User profile endpoints."""
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.routers.documents.response_utils import create_document_response

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get current user profile."""
    # Handle current_document with filesystem content if present
    current_document = None
    if current_user.current_doc_id and current_user.current_document:
        try:
            current_document = await create_document_response(
                document=current_user.current_document,
                user_id=current_user.id,
                content=None  # Will load from filesystem
            )
        except Exception as e:
            # Log error but continue without current document
            print(f"Error loading current document content for user {current_user.id}: {e}")
            current_document = None

    # Create response with properly loaded current document
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        display_name=current_user.display_name,
        bio=current_user.bio,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        is_admin=current_user.is_admin,
        mfa_enabled=current_user.mfa_enabled,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        full_name=current_user.full_name,
        sync_preview_scroll_enabled=current_user.sync_preview_scroll_enabled,
        autosave_enabled=current_user.autosave_enabled,
        current_doc_id=current_user.current_doc_id,
        current_document=current_document
    )

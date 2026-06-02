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
    response = UserResponse.model_validate(current_user)
    if current_document:
        response = response.model_copy(update={"current_document": current_document})
    return response

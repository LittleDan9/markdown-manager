"""Legacy document-categories listing endpoint.

Category create/update/delete now live in `app.routers.categories` (keyed on
`category_id`). This module only retains the read-only name list for backward
compatibility.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from .docs import CATEGORIES_DOCS

router = APIRouter()


@router.get("/categories", response_model=List[str], **CATEGORIES_DOCS["list"])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get all categories used by the current user."""
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=current_user.id
    )
    return categories

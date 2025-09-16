"""Document categories management API endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
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


@router.post("/categories", response_model=List[str], **CATEGORIES_DOCS["create"])
async def add_category(
    category: str = Body(..., embed=True, description="Category name to add"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Add a category for the current user."""
    success = await document_crud.document.add_category_for_user(
        db=db, user_id=int(current_user.id), category=category
    )
    if not success:
        raise HTTPException(status_code=400, detail="Category already exists")
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )
    return categories


@router.delete("/categories/{category}", response_model=List[str], **CATEGORIES_DOCS["delete"])
async def delete_category(
    category: str,
    delete_docs: bool = Query(
        False, alias="delete_docs", description="Delete all documents in this category"
    ),
    migrate_to: Optional[str] = Query(
        None, alias="migrate_to", description="Category to migrate documents to"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """
    Delete a category for the current user.
    If delete_docs=True, removes all documents in this category.
    Otherwise, moves documents to migrate_to (or 'General').
    """
    # Perform delete or migrate as requested
    affected = await document_crud.document.delete_category_for_user(
        db=db,
        user_id=int(current_user.id),
        category=category,
        delete_docs=delete_docs,
        migrate_to=migrate_to,
    )
    if affected == 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete General or category not found"
        )
    # Return updated category list
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )
    return categories

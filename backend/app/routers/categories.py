"""Categories API routes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import category as crud_category
from app.database import get_db
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CategoryWithStats,
)

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all categories for the current user."""
    categories = await crud_category.get_user_categories(db, int(current_user.id))
    return categories


@router.get("/stats", response_model=list[CategoryWithStats])
async def get_categories_with_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get all categories for the current user with document and dictionary counts."""
    categories = await crud_category.get_user_categories_with_stats(
        db, int(current_user.id)
    )
    return categories


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get a specific category."""
    category = await crud_category.get_category_by_id(
        db, category_id, int(current_user.id)
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new category."""
    # Check if category already exists
    existing_category = await crud_category.get_category_by_name(
        db, category_data.name, int(current_user.id)
    )
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category with this name already exists",
        )

    new_category = await crud_category.create_category(
        db, category_data, int(current_user.id)
    )
    return new_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Update a category."""
    # Check if new name conflicts with existing category
    if category_data.name:
        existing_category = await crud_category.get_category_by_name(
            db, category_data.name, int(current_user.id)
        )
        if existing_category and existing_category.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category with this name already exists",
            )

    updated_category = await crud_category.update_category(
        db, category_id, int(current_user.id), category_data
    )
    if not updated_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return updated_category


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a category."""
    success = await crud_category.delete_category(db, category_id, int(current_user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return {"message": "Category deleted successfully"}

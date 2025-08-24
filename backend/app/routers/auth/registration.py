"""User registration endpoints."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import user as crud_user
from app.crud import category as crud_category
from app.database import get_db
from app.schemas.user import UserCreate, UserResponse
from app.schemas.category import CategoryCreate

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    """Register a new user."""
    # Check if user already exists
    existing_user = await crud_user.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    user = await crud_user.create_user(db, user_data)

    # Create default categories for the new user
    default_categories = ["General", "Drafts"]
    for category_name in default_categories:
        category_data = CategoryCreate(name=category_name)
        await crud_category.create_category(db, category_data, user.id)

    return user

"""Category schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    """Base schema for category."""

    name: str = Field(
        ..., min_length=1, max_length=100, description="The category name"
    )


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""

    pass


class CategoryUpdate(CategoryBase):
    """Schema for updating a category."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=100, description="The category name"
    )


class CategoryResponse(CategoryBase):
    """Schema for category response."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryWithStats(CategoryResponse):
    """Schema for category with additional statistics."""

    document_count: int = Field(..., description="Number of documents in this category")
    dictionary_word_count: int = Field(
        ..., description="Number of custom dictionary words for this category"
    )

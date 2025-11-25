"""Custom dictionary schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomDictionaryBase(BaseModel):
    """Base schema for custom dictionary."""

    word: str = Field(
        ..., min_length=1, max_length=100, description="The word to add to dictionary"
    )
    notes: Optional[str] = Field(None, description="Optional notes about the word")
    category_id: Optional[int] = Field(
        None, description="Optional category ID for category-level dictionary (deprecated, use folder_path)"
    )
    folder_path: Optional[str] = Field(
        None, description="Optional folder path for folder-based dictionary scoping"
    )


class CustomDictionaryCreate(CustomDictionaryBase):
    """Schema for creating a custom dictionary entry."""

    @field_validator("word")
    @classmethod
    def validate_word(cls, v):
        """Validate and normalize the word."""
        return v.lower().strip()


class CustomDictionaryUpdate(BaseModel):
    """Schema for updating a custom dictionary entry."""

    notes: Optional[str] = Field(None, description="Optional notes about the word")


class CustomDictionaryResponse(CustomDictionaryBase):
    """Schema for custom dictionary response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category_id: Optional[int] = None
    folder_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CustomDictionaryWordsResponse(BaseModel):
    """Schema for getting all custom words for a user."""

    words: list[str] = Field(..., description="List of custom words")
    count: int = Field(..., description="Total number of custom words")


class CategoryDictionaryWordsResponse(BaseModel):
    """Schema for getting custom words for a specific category."""

    category_id: int = Field(..., description="Category ID")
    words: list[str] = Field(..., description="List of custom words for this category")
    count: int = Field(
        ..., description="Total number of custom words for this category"
    )


class FolderDictionaryWordsResponse(BaseModel):
    """Schema for getting custom words for a specific folder path."""

    folder_path: str = Field(..., description="Folder path")
    words: list[str] = Field(..., description="List of custom words for this folder")
    count: int = Field(
        ..., description="Total number of custom words for this folder"
    )

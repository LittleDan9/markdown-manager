"""Custom dictionary schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CustomDictionaryBase(BaseModel):
    """Base schema for custom dictionary."""

    word: str = Field(
        ..., min_length=1, max_length=100, description="The word to add to dictionary"
    )
    notes: Optional[str] = Field(None, description="Optional notes about the word")


class CustomDictionaryCreate(CustomDictionaryBase):
    """Schema for creating a custom dictionary entry."""

    pass


class CustomDictionaryUpdate(BaseModel):
    """Schema for updating a custom dictionary entry."""

    notes: Optional[str] = Field(None, description="Optional notes about the word")


class CustomDictionaryResponse(CustomDictionaryBase):
    """Schema for custom dictionary response."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        """Pydantic config."""

        from_attributes = True


class CustomDictionaryWordsResponse(BaseModel):
    """Schema for getting all custom words for a user."""

    words: list[str] = Field(..., description="List of custom words")
    count: int = Field(..., description="Total number of custom words")

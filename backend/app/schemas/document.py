"""Pydantic schemas for documents."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    """Base document schema."""

    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., description="Markdown content")
    category: str = Field(default="General", max_length=100)


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    pass


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, description="Markdown content")
    category: Optional[str] = Field(None, max_length=100)


class DocumentInDB(DocumentBase):
    """Schema for document in database."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: _isoformat_utc(v)
        }


def _isoformat_utc(dt: datetime) -> str:
    """Format datetime as ISO 8601 with Z (UTC)."""
    if dt.tzinfo:
        return dt.astimezone().replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    return dt.replace(microsecond=0).isoformat() + 'Z'


class Document(DocumentInDB):
    """Public document schema."""

    pass


class DocumentList(BaseModel):
    """Schema for document list response."""

    documents: list[Document]
    total: int
    categories: list[str]

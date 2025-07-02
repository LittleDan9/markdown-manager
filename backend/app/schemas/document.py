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


class Document(DocumentInDB):
    """Public document schema."""
    pass


class DocumentList(BaseModel):
    """Schema for document list response."""
    documents: list[Document]
    total: int
    categories: list[str]

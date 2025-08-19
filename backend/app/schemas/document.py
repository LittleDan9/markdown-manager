"""Pydantic schemas for documents."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class DocumentBase(BaseModel):
    """Base document schema."""

    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., description="Markdown content")
    category: str = Field(default="General", max_length=100)
    category_id: Optional[int] = Field(
        None, description="Category ID for dictionary scope"
    )


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    pass


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, description="Markdown content")
    category: Optional[str] = Field(None, max_length=100)
    category_id: Optional[int] = Field(
        None, description="Category ID for dictionary scope"
    )


class DocumentInDB(DocumentBase):
    """Schema for document in database."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_shared: bool = False
    share_token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format with Z suffix."""
        return _isoformat_utc(dt)


def _isoformat_utc(dt: datetime) -> str:
    """Format datetime as ISO 8601 with Z (UTC)."""
    if dt.tzinfo:
        return dt.astimezone().replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return dt.replace(microsecond=0).isoformat() + "Z"


class Document(DocumentInDB):
    """Public document schema."""

    pass


class DocumentList(BaseModel):
    """Schema for document list response."""

    documents: list[Document]
    total: int
    categories: list[str]


class DocumentConflictError(BaseModel):
    """Schema for document conflict error response."""

    detail: str
    conflict_type: str = "name_conflict"
    existing_document: Document


class ShareResponse(BaseModel):
    """Schema for share link response."""

    share_token: str
    is_shared: bool


class SharedDocument(BaseModel):
    """Schema for publicly shared document (limited fields)."""

    id: int
    name: str
    content: str
    category: str
    category_id: Optional[int] = Field(None, description="Category ID")
    updated_at: datetime
    author_name: str

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("updated_at")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format with Z suffix."""
        return _isoformat_utc(dt)

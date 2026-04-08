"""Chat conversation and message schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageSchema(BaseModel):
    """Response schema for a single chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    metadata_json: Optional[str] = None
    created_at: datetime


class ChatConversationSummary(BaseModel):
    """Summary schema for conversation list view."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    provider: Optional[str] = None
    scope: Optional[str] = None
    document_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    first_message_preview: Optional[str] = None


class ChatConversationDetail(BaseModel):
    """Full conversation with messages."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    provider: Optional[str] = None
    scope: Optional[str] = None
    document_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageSchema] = []


class CreateConversationRequest(BaseModel):
    """Request to create a new conversation."""

    provider: Optional[str] = Field(None, max_length=50)
    scope: Optional[str] = Field(None, max_length=20)
    document_id: Optional[int] = None


class UpdateConversationRequest(BaseModel):
    """Request to update a conversation (rename)."""

    title: str = Field(..., min_length=1, max_length=255)


class AddMessageRequest(BaseModel):
    """Request to add a message to a conversation."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)
    metadata_json: Optional[str] = None


class GenerateTitleRequest(BaseModel):
    """Request to generate a title for a conversation."""

    provider: Optional[str] = Field(None, max_length=50)


class GenerateTitleResponse(BaseModel):
    """Response with the generated title."""

    title: str

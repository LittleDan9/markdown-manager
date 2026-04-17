"""Pydantic schemas for user API key management."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ApiKeyCreate(BaseModel):
    """Request body for creating a new API key."""
    provider: str = Field(..., pattern=r"^(openai|xai|github|gemini)$", description="Provider identifier")
    api_key: str = Field(..., min_length=1, description="Raw API key (will be encrypted)")
    label: str | None = Field(None, max_length=128, description="Display label")
    base_url: str | None = Field(None, max_length=512, description="Custom API base URL override")
    preferred_model: str | None = Field(None, max_length=128, description="Preferred model name")
    org_name: str | None = Field(None, max_length=200, description="GitHub org name for org-attributed inference")


class ApiKeyUpdate(BaseModel):
    """Request body for updating an existing API key."""
    label: str | None = None
    base_url: str | None = None
    preferred_model: str | None = None
    org_name: str | None = None
    is_active: bool | None = None
    api_key: str | None = Field(None, min_length=1, description="New raw API key (re-encrypted)")


class ApiKeyResponse(BaseModel):
    """Response for a single API key — never includes the raw key."""
    id: int
    provider: str
    label: str | None
    base_url: str | None
    preferred_model: str | None
    org_name: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyListResponse(BaseModel):
    """Response listing all API keys for a user."""
    keys: list[ApiKeyResponse]

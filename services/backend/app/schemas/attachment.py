"""Pydantic schemas for attachments."""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _isoformat_utc(dt: datetime) -> str:
    """Format datetime as ISO 8601 with Z (UTC)."""
    if dt.tzinfo:
        return dt.astimezone().replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return dt.replace(microsecond=0).isoformat() + "Z"


class AttachmentResponse(BaseModel):
    """Schema for attachment API responses."""

    id: int
    document_id: int
    user_id: int
    original_filename: str
    mime_type: str
    file_size_bytes: int
    scan_status: str
    scan_result: Optional[str] = None
    download_url: str = Field(description="URL to download the attachment")
    view_url: str = Field(description="URL to view the attachment inline in browser")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        return _isoformat_utc(dt)


class AttachmentQuotaInfo(BaseModel):
    """Quota usage information returned with attachment lists."""

    used_bytes: int
    quota_bytes: int
    remaining_bytes: int
    percentage_used: float


class AttachmentListResponse(BaseModel):
    """Schema for paginated attachment list responses."""

    items: List[AttachmentResponse]
    total: int
    quota: Optional[AttachmentQuotaInfo] = None


class AttachmentQuotaSettings(BaseModel):
    """Schema for admin quota configuration."""

    quota_bytes: int = Field(ge=0, description="Default attachment quota in bytes")
    quota_display: str = Field(description="Human-readable quota (e.g. '500 MB')")

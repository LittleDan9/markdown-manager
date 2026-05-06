"""Remote AI provider settings — cached state from other apps for cross-app diff."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class RemoteAIProvider(BaseModel):
    """Cached AI provider config from another app, received via Redis Stream events."""
    __tablename__ = "remote_ai_providers"
    __table_args__ = (
        UniqueConstraint("user_id", "source_app", "remote_id", name="uq_remote_ai_provider"),
    )

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_app: Mapped[str] = mapped_column(String(50), nullable=False)
    remote_id: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(200), default="")
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    preferred_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    org_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    has_key: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

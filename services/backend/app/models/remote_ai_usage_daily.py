"""Remote AI usage daily — cached usage stats from other apps."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class RemoteAIUsageDaily(BaseModel):
    """Daily AI usage from a remote app, synced via Redis Stream events."""
    __tablename__ = "remote_ai_usage_daily"
    __table_args__ = (
        UniqueConstraint("user_id", "source_app", "usage_date", "provider", "model", name="uq_remote_ai_usage_daily"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source_app: Mapped[str] = mapped_column(String(50), nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

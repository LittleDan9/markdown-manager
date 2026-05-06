"""AI usage daily rollup — aggregated per user/provider/model/day."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AIUsageDaily(BaseModel):
    """Daily aggregated AI usage per user/provider/model."""
    __tablename__ = "ai_usage_daily"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", "provider", "model", name="uq_ai_usage_daily"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    last_request_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

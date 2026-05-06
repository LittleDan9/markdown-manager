"""ChatTokenUsage model — per-request AI token usage tracking."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ChatTokenUsage(BaseModel):
    """Records token usage for each AI chat/completion request."""
    __tablename__ = "chat_token_usage"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("chat_conversations.id", ondelete="SET NULL"),
        nullable=True, default=None,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    scope_type: Mapped[str] = mapped_column(String(50), default="chat")
    error_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    request_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

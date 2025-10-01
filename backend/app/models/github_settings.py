"""GitHub settings models."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .github_models import GitHubAccount


class GitHubSettings(BaseModel):
    """User's GitHub integration settings."""

    __tablename__ = "github_settings"

    # User relationship
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    user: Mapped["User"] = relationship("User", back_populates="github_settings")

    # Optional: Account-specific settings (for future use)
    github_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("github_accounts.id"), nullable=True, index=True
    )
    github_account: Mapped["GitHubAccount | None"] = relationship(
        "GitHubAccount", back_populates="settings"
    )

    # Diagram export settings
    auto_convert_diagrams: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    diagram_format: Mapped[str] = mapped_column(
        String(10), default="svg", nullable=False
    )
    fallback_to_standard: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Future settings placeholders
    auto_sync_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    default_commit_message: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    auto_push_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    def __repr__(self) -> str:
        return f"<GitHubSettings(user_id={self.user_id}, auto_convert={self.auto_convert_diagrams})>"
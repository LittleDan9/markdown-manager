from __future__ import annotations

"""User model."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .document import Document
    from .github_models import GitHubAccount


class User(BaseModel):
    """User model for authentication and profile management."""

    __tablename__ = "users"

    # Authentication fields
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Password reset fields
    reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reset_token_expires: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # MFA fields
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # Base32 encoded secret
    backup_codes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of backup codes

    # Profile fields
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Editor/UX settings
    sync_preview_scroll_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    autosave_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    editor_width_percentage: Mapped[int] = mapped_column(Integer, default=40)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationship to documents
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="owner", foreign_keys="[Document.user_id]"
    )
    # Current document tracking
    current_doc_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    current_document: Mapped[Optional["Document"]] = relationship(
        "Document",
        foreign_keys=[current_doc_id],
        lazy="noload",  # Prevent automatic loading to avoid greenlet issues
        back_populates=None,
    )

    # Custom dictionary relationship
    custom_dictionary_words = relationship("CustomDictionary", back_populates="user")

    # Categories relationship
    categories = relationship(
        "Category", back_populates="user", cascade="all, delete-orphan"
    )

    # GitHub integration relationships
    github_accounts = relationship(
        "GitHubAccount", back_populates="user", cascade="all, delete-orphan"
    )

    # Git operation logs
    git_operation_logs = relationship(
        "GitOperationLog", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        """Get the user's full name."""
        first = getattr(self, "first_name", None)
        last = getattr(self, "last_name", None)
        display = getattr(self, "display_name", None)
        email = getattr(self, "email", "")

        if first and last:
            return f"{first} {last}"
        return display or email.split("@")[0] if email else "User"

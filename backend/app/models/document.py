from __future__ import annotations

"""Document model for storing markdown documents."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User
    from app.models.github_models import GitHubRepository, GitHubSyncHistory


from sqlalchemy import UniqueConstraint


class Document(Base):  # type: ignore[misc]
    """Document model for storing user markdown documents."""

    __tablename__ = "documents"
    __allow_unmapped__ = True
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Foreign key to category (required)
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Sharing fields
    share_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # GitHub integration fields
    github_repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("github_repositories.id"), nullable=True, index=True
    )
    github_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    github_branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    local_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 hash
    github_sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_github_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    github_commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship
    owner: Mapped["User"] = relationship(
        "User", back_populates="documents", foreign_keys=[user_id]
    )
    category_ref: Mapped["Category | None"] = relationship(
        "Category", back_populates="documents"
    )
    # For current_doc_id relationship (reverse link from User)
    current_users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="current_document",
        primaryjoin="Document.id==User.current_doc_id",
        viewonly=True,
    )

    # GitHub integration relationships
    github_repository: Mapped["GitHubRepository | None"] = relationship(
        "GitHubRepository", back_populates="documents"
    )
    github_sync_history: Mapped[list["GitHubSyncHistory"]] = relationship(
        "GitHubSyncHistory", back_populates="document"
    )

    def __repr__(self) -> str:
        return (
            f"<Document(id={self.id}, name='{self.name}', "
            f"category_id={self.category_id})>"
        )

    @property
    def github_status_info(self) -> dict:
        """Get GitHub status information for UI display."""
        if not self.github_repository_id:
            return {
                "type": "local",
                "message": "Local document",
                "icon": "📄",
                "color": "secondary"
            }

        status_map = {
            "synced": {
                "type": "synced",
                "icon": "🟢",
                "message": "In sync with GitHub",
                "color": "success"
            },
            "local_changes": {
                "type": "draft",
                "icon": "🔵",
                "message": "Draft changes ready to commit",
                "color": "primary"
            },
            "remote_changes": {
                "type": "behind",
                "icon": "🟡",
                "message": "Updates available from GitHub",
                "color": "warning"
            },
            "conflict": {
                "type": "conflict",
                "icon": "🔴",
                "message": "Conflicts need resolution",
                "color": "danger"
            }
        }

        default_status = {
            "type": "unknown",
            "icon": "⚪",
            "message": "Unknown status",
            "color": "secondary"
        }

        return status_map.get(self.github_sync_status or "unknown", default_status)

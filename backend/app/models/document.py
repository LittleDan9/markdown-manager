from __future__ import annotations

"""Document model for storing markdown documents."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func, text

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
    __table_args__ = (
        # Folder-based uniqueness (keep this existing constraint)
        UniqueConstraint("user_id", "folder_path", "name", name="uq_user_folder_name"),
        
        # Conditional partial indexes for proper document type separation
        # Local documents: unique (user_id, folder_path, name) where github_repository_id IS NULL
        Index(
            "uq_local_documents",
            "user_id", "folder_path", "name",
            unique=True,
            postgresql_where=text("github_repository_id IS NULL")
        ),
        
        # GitHub documents: unique (user_id, github_repository_id, github_file_path, github_branch)
        Index(
            "uq_github_documents",
            "user_id", "github_repository_id", "github_file_path", "github_branch",
            unique=True,
            postgresql_where=text("github_repository_id IS NOT NULL")
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # NEW: Folder path for hierarchical organization
    folder_path: Mapped[str] = mapped_column(
        String(1000), nullable=False, default="/", index=True,
        comment="Hierarchical folder path (e.g., '/Work/Projects')"
    )

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
    last_opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Foreign key to category (make nullable during transition)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,  # Changed from False to True for transition
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

    @property
    def root_folder(self) -> str:
        """Get the root folder from folder_path."""
        parts = [p for p in self.folder_path.split('/') if p]
        return f"/{parts[0]}" if parts else "/"

    @property
    def is_github_document(self) -> bool:
        """Check if this is a GitHub-sourced document."""
        return self.github_repository_id is not None

    @property
    def display_path(self) -> str:
        """Get user-friendly display path."""
        if self.folder_path == '/':
            return self.name
        return f"{self.folder_path.strip('/')}/{self.name}"

    def get_folder_breadcrumbs(self) -> list[str]:
        """Get folder path as breadcrumb list."""
        if self.folder_path == '/':
            return []
        return [p for p in self.folder_path.split('/') if p]

    @classmethod
    def normalize_folder_path(cls, path: str) -> str:
        """Normalize folder path format."""
        if not path or path == '/':
            return '/'

        # Remove trailing slash, ensure leading slash
        path = '/' + path.strip('/')

        # Remove double slashes
        while '//' in path:
            path = path.replace('//', '/')

        return path

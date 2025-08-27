"""GitHub integration models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .document import Document
    from .user import User


class GitHubSyncStatus(str, Enum):
    """Status of GitHub synchronization."""

    SYNCED = "synced"
    LOCAL_CHANGES = "local_changes"
    REMOTE_CHANGES = "remote_changes"
    CONFLICT = "conflict"
    ERROR = "error"


class GitHubAccount(BaseModel):
    """GitHub account linked to a user."""

    __tablename__ = "github_accounts"

    # Basic account info
    github_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # OAuth tokens (encrypted in production)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship("User", back_populates="github_accounts")
    repositories: Mapped[list["GitHubRepository"]] = relationship(
        "GitHubRepository", back_populates="account", cascade="all, delete-orphan"
    )


class GitHubRepository(BaseModel):
    """GitHub repository enabled for sync."""

    __tablename__ = "github_repositories"
    __table_args__ = (
        UniqueConstraint("account_id", "repo_full_name", name="uq_account_repo"),
    )

    # Repository info
    github_repo_id: Mapped[int] = mapped_column(Integer, nullable=False)
    repo_full_name: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )  # owner/repo
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_owner: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")

    # Repository status
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Sync settings
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)

    # Relationships
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("github_accounts.id"), nullable=False, index=True
    )
    account: Mapped["GitHubAccount"] = relationship(
        "GitHubAccount", back_populates="repositories"
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="github_repository"
    )
    sync_history: Mapped[list["GitHubSyncHistory"]] = relationship(
        "GitHubSyncHistory", back_populates="repository", cascade="all, delete-orphan"
    )


class GitHubSyncHistory(BaseModel):
    """History of GitHub sync operations."""

    __tablename__ = "github_sync_history"

    # Operation details
    operation: Mapped[str] = mapped_column(String(50), nullable=False)  # pull, push, etc.
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # success, error, etc.
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    branch_name: Mapped[str] = mapped_column(String(255), default="main")

    # Operation metadata
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    files_changed: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    repository_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("github_repositories.id"), nullable=False, index=True
    )
    repository: Mapped["GitHubRepository"] = relationship(
        "GitHubRepository", back_populates="sync_history"
    )

    document_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("documents.id"), nullable=True, index=True
    )
    document: Mapped[Optional["Document"]] = relationship(
        "Document", back_populates="github_sync_history"
    )

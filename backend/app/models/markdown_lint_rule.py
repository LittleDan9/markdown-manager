from __future__ import annotations

"""Markdown lint rule models for storing user, category, and folder-specific rule configurations."""
from typing import TYPE_CHECKING, Dict, Any

from sqlalchemy import ForeignKey, Integer, String, Text, Boolean, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class MarkdownLintRule(BaseModel):
    """
    Model for storing markdown lint rule configurations.

    Supports three levels of rule configuration:
    1. User defaults (scope='user', scope_id=user_id, scope_value=None)
    2. Category rules (scope='category', scope_id=category_id, scope_value=None)
    3. Folder rules (scope='folder', scope_id=user_id, scope_value=folder_path)
    """

    __tablename__ = "markdown_lint_rules"
    __table_args__ = (
        # Ensure only one rule configuration per scope combination
        UniqueConstraint("user_id", "scope", "scope_id", "scope_value", name="uq_lint_rule_scope"),
    )

    # Foreign key to user (always required)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Scope configuration
    scope: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # 'user', 'category', 'folder'

    scope_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )  # category_id for category scope, user_id for folder scope

    scope_value: Mapped[str | None] = mapped_column(
        String(500), nullable=True, index=True
    )  # folder_path for folder scope

    # Rule configuration as JSON
    rules: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )

    # Global linting enabled/disabled toggle
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        """String representation of the rule."""
        return (
            f"<MarkdownLintRule(user_id={self.user_id}, scope={self.scope}, "
            f"scope_id={self.scope_id}, scope_value={self.scope_value})>"
        )

    @classmethod
    def create_user_defaults(
        cls, user_id: int, rules: Dict[str, Any], description: str | None = None, enabled: bool = True
    ) -> "MarkdownLintRule":
        """Factory method to create user default rules."""
        return cls(
            user_id=user_id,
            scope="user",
            scope_id=user_id,
            scope_value=None,
            rules=rules,
            description=description or "User default markdown lint rules",
            enabled=enabled
        )

    @classmethod
    def create_category_rules(
        cls, user_id: int, category_id: int, rules: Dict[str, Any], description: str | None = None
    ) -> "MarkdownLintRule":
        """Factory method to create category-specific rules."""
        return cls(
            user_id=user_id,
            scope="category",
            scope_id=category_id,
            scope_value=None,
            rules=rules,
            description=description or f"Category {category_id} markdown lint rules"
        )

    @classmethod
    def create_folder_rules(
        cls, user_id: int, folder_path: str, rules: Dict[str, Any], description: str | None = None
    ) -> "MarkdownLintRule":
        """Factory method to create folder-specific rules."""
        return cls(
            user_id=user_id,
            scope="folder",
            scope_id=user_id,
            scope_value=folder_path,
            rules=rules,
            description=description or f"Folder '{folder_path}' markdown lint rules"
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert rule to dictionary format."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "scope": self.scope,
            "scope_id": self.scope_id,
            "scope_value": self.scope_value,
            "rules": self.rules,
            "is_active": self.is_active,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

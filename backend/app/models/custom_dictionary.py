from __future__ import annotations

"""Custom dictionary model for spell checking."""
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .category import Category
    from .user import User


class CustomDictionary(BaseModel):
    """Custom dictionary model for user-specific or category-specific spell checking words."""

    __tablename__ = "custom_dictionaries"
    __table_args__ = (
        # Ensure user_id is always provided (dictionaries are always owned by a user)
        CheckConstraint("user_id IS NOT NULL", name="ck_custom_dictionaries_scope"),
        # Ensure unique words per category (for category-level dictionaries)
        UniqueConstraint("category_id", "word", name="uq_category_dictionary_word"),
        # NEW: Ensure unique words per folder (for folder-level dictionaries)
        UniqueConstraint("folder_path", "word", name="uq_folder_dictionary_word"),
    )

    # Foreign key to user (always required - dictionaries are owned by users)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Foreign key to category (for category-level dictionaries - KEEP during transition)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # NEW: Folder path for folder-level dictionaries
    folder_path: Mapped[str | None] = mapped_column(
        String(500),  # Support deep folder paths
        nullable=True,
        index=True,
        comment="Hierarchical folder path for dictionary scope (e.g., '/Work/Projects')"
    )

    # The custom word to add to dictionary
    word: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional notes about the word
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="custom_dictionary_words"
    )
    category: Mapped["Category | None"] = relationship(
        "Category", back_populates="custom_dictionary_words"
    )

    def __repr__(self) -> str:
        """String representation of the custom dictionary entry."""
        if self.user_id:
            return f"<CustomDictionary(user_id={self.user_id}, word={self.word})>"
        else:
            return (
                f"<CustomDictionary(category_id={self.category_id}, word={self.word})>"
            )

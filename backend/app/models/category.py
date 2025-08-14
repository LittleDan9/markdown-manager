from __future__ import annotations

"""Category model for organizing documents."""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_dictionary import CustomDictionary
    from .document import Document
    from .user import User


class Category(BaseModel):
    """Category model for organizing documents by user."""

    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_category_name"),
    )

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Category name
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="categories")
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="category_ref"
    )
    custom_dictionary_words: Mapped[list["CustomDictionary"]] = relationship(
        "CustomDictionary", back_populates="category", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """String representation of the category."""
        return f"<Category(user_id={self.user_id}, name={self.name})>"

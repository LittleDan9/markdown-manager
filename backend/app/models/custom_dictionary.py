from __future__ import annotations

"""Custom dictionary model for spell checking."""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class CustomDictionary(BaseModel):
    """Custom dictionary model for user-specific spell checking words."""

    __tablename__ = "custom_dictionaries"

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # The custom word to add to dictionary
    word: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional notes about the word
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationship to user
    user: Mapped["User"] = relationship(
        "User", back_populates="custom_dictionary_words"
    )

    def __repr__(self) -> str:
        """String representation of the custom dictionary entry."""
        return f"<CustomDictionary(user_id={self.user_id}, word={self.word})>"

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


from sqlalchemy import UniqueConstraint


class Document(Base):  # type: ignore[misc]
    """Document model for storing user markdown documents."""

    __tablename__ = "documents"
    __allow_unmapped__ = True
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(
        String(100), default="General", nullable=False, index=True
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

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Foreign key to category (optional)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Sharing fields
    share_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    is_shared: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

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

    def __repr__(self) -> str:
        return (
            f"<Document(id={self.id}, name='{self.name}', "
            f"category='{self.category}')>"
        )

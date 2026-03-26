"""Comment model for document-level and line-level annotations."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Comment(Base):
    """A comment attached to a document, optionally at a specific line."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null = document-level
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)  # reply threading
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")  # open, resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="comments")
    document = relationship("Document", backref="comments")
    replies = relationship("Comment", foreign_keys=[parent_id], lazy="selectin")

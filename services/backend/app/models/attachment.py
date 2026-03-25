"""Attachment model for storing document file attachments."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class Attachment(Base):  # type: ignore[misc]
    """Attachment model for storing file attachments linked to documents."""

    __tablename__ = "attachments"
    __table_args__ = (
        Index("ix_attachments_user_id", "user_id"),
        Index("ix_attachments_document_id", "document_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Ownership
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    # File metadata
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Original uploaded filename"
    )
    stored_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, comment="SHA-based stored filename"
    )
    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME type of the attachment"
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="File size in bytes"
    )
    content_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="SHA-256 hash of file content"
    )

    # Virus scan status
    scan_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
        comment="Virus scan status: pending, clean, infected, error"
    )
    scan_result: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Virus scan result details"
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    document: Mapped["Document"] = relationship(
        "Document", back_populates="attachments"
    )
    owner: Mapped["User"] = relationship("User", back_populates="attachments")

    def __repr__(self) -> str:
        return (
            f"<Attachment(id={self.id}, filename='{self.original_filename}', "
            f"document_id={self.document_id}, scan_status='{self.scan_status}')>"
        )

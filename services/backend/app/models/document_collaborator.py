"""DocumentCollaborator model — tracks per-document access grants."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentCollaborator(Base):
    """A user granted access to a document they don't own."""

    __tablename__ = "document_collaborators"
    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_document_collaborator"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="viewer",
        comment="Permission level: editor or viewer"
    )
    invited_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    document = relationship("Document", backref="collaborators")
    user = relationship("User", foreign_keys=[user_id], backref="collaborations")
    inviter = relationship("User", foreign_keys=[invited_by])

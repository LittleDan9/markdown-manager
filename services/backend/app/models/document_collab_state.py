"""DocumentCollabState model — persisted Yjs CRDT state per document."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DocumentCollabState(Base):
    """Stores the serialized Yjs Y.Doc for a collaboratively-edited document."""

    __tablename__ = "document_collab_state"

    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    yjs_state: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True, comment="Serialized Y.Doc state"
    )
    yjs_state_vector: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True, comment="Y.Doc state vector for incremental sync"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    document = relationship("Document", backref="collab_state", uselist=False)

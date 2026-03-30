"""DocumentEmbedding model — stores pgvector embeddings for semantic search.

Uses halfvec for 2x storage reduction and BIT column for fast binary
pre-filtering, inspired by TurboQuant/QJL quantization techniques.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import BIT, HALFVEC
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension


class DocumentEmbedding(Base):
    """Stores the vector embedding for a document, used for semantic search.

    Uses halfvec(384) for 2x storage reduction over float32 VECTOR(384),
    and a binary BIT(384) column for fast Hamming distance pre-filtering
    (QJL-inspired sign-bit quantization).
    """

    __tablename__ = "document_embeddings"
    __table_args__ = (
        Index("ix_document_embeddings_user_id", "user_id"),
        Index("ix_document_embeddings_document_id", "document_id"),
        UniqueConstraint("document_id", "chunk_index", name="uq_document_embeddings_doc_chunk"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Half-precision vector — 2x smaller than float32 VECTOR(384)
    embedding: Mapped[list[float]] = mapped_column(
        HALFVEC(EMBEDDING_DIM), nullable=False
    )
    # Binary sign-bit quantization (QJL-inspired) — for fast Hamming pre-filtering
    embedding_binary: Mapped[str | None] = mapped_column(
        BIT(EMBEDDING_DIM), nullable=True
    )
    # SHA256 hash of embedded content — skip re-embedding if unchanged
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # Structural summary (headings + first paragraph per section) used as LLM context
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Reserved for multi-chunk support in future; 0 = whole-document embedding
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedded_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="embeddings")
    user: Mapped["User"] = relationship("User")

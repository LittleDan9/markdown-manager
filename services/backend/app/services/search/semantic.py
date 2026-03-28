"""Semantic search service — index documents and search by cosine similarity."""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from pgvector.sqlalchemy import Vector  # noqa: F401 — registered by SQLAlchemy for Vector columns
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_embedding import DocumentEmbedding
from app.services.search.content_processor import extract_summary, prepare_document_content
from app.services.search.embedding_client import EmbeddingClient
from app.services.storage.filesystem import Filesystem

logger = logging.getLogger(__name__)


def _get_filesystem() -> Filesystem:
    """Lazily create Filesystem to avoid path creation errors at import time."""
    return Filesystem()


@dataclass
class SearchResult:
    document: Document
    score: float  # cosine similarity, 0.0–1.0 (higher = more similar)
    embedding: DocumentEmbedding | None = None  # carries pre-computed summary


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class SemanticSearchService:
    """Handles embedding documents and querying by cosine similarity."""

    def __init__(self, embedding_client: EmbeddingClient):
        self._client = embedding_client

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    async def index_document(
        self,
        db: AsyncSession,
        user_id: int,
        document: Document,
    ) -> bool:
        """
        Embed *document* and upsert into document_embeddings.
        Skips embedding if the content hash hasn't changed.
        Returns True if a new embedding was written, False if skipped.
        """
        if not document.file_path:
            logger.debug("Skipping embedding for document %s — no file_path", document.id)
            return False

        content = await _get_filesystem().read_document(user_id, document.file_path)
        if content is None:
            logger.warning("Cannot index doc %s — file not found on disk", document.id)
            return False

        processed = prepare_document_content(document.name, content)
        content_hash = _sha256(processed.text)

        # Check for existing embedding
        result = await db.execute(
            select(DocumentEmbedding).where(DocumentEmbedding.document_id == document.id)
        )
        existing: DocumentEmbedding | None = result.scalar_one_or_none()

        if existing and existing.content_hash == content_hash:
            logger.debug("Skipping re-embedding for doc %s — content unchanged", document.id)
            return False

        try:
            embedding = await self._client.embed_texts([processed.text])
            vector = embedding[0]
        except Exception:
            logger.exception("Failed to get embedding for doc %s", document.id)
            return False

        summary = extract_summary(document.name, content)

        if existing:
            existing.embedding = vector
            existing.content_hash = content_hash
            existing.summary = summary
        else:
            db.add(
                DocumentEmbedding(
                    document_id=document.id,
                    user_id=user_id,
                    embedding=vector,
                    content_hash=content_hash,
                    chunk_index=0,
                    summary=summary,
                )
            )

        await db.commit()
        logger.info("Indexed document %s (mermaid=%s)", document.id, processed.has_mermaid)

        return True

    async def delete_embedding(self, db: AsyncSession, document_id: int) -> None:
        """Remove the embedding for a deleted document (cascade also handles this)."""
        result = await db.execute(
            select(DocumentEmbedding).where(DocumentEmbedding.document_id == document_id)
        )
        row = result.scalar_one_or_none()
        if row:
            await db.delete(row)
            await db.commit()

    async def bulk_reindex(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> dict[str, int]:
        """
        Re-embed all documents for a user.
        Skips documents whose content hash hasn't changed.
        Returns counts: {indexed, skipped, failed}.
        """
        result = await db.execute(
            select(Document).where(
                Document.user_id == user_id,
                Document.file_path.is_not(None),
            )
        )
        documents = result.scalars().all()

        counts = {"indexed": 0, "skipped": 0, "failed": 0}
        for doc in documents:
            try:
                indexed = await self.index_document(db, user_id, doc)
                counts["indexed" if indexed else "skipped"] += 1
            except Exception:
                logger.exception("Failed to index doc %s during bulk reindex", doc.id)
                counts["failed"] += 1

        return counts

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 10,
        min_score: float = 0.0,
        category_id: int | None = None,
    ) -> list[SearchResult]:
        """
        Embed *query* and return the most semantically similar documents.
        Results are filtered to the requesting user's documents only.
        Pass min_score > 0 to exclude low-relevance documents.
        If *category_id* is provided, results are limited to that category.
        """
        try:
            query_vector = await self._client.embed_query(query)
        except Exception:
            logger.exception("Failed to embed search query")
            return []

        # pgvector cosine distance via registered column operator (0 = identical, 2 = opposite)
        # We convert to similarity: 1 - distance
        stmt = (
            select(
                Document,
                DocumentEmbedding,
                (1 - DocumentEmbedding.embedding.cosine_distance(query_vector)).label("score"),
            )
            .join(DocumentEmbedding, DocumentEmbedding.document_id == Document.id)
            .where(DocumentEmbedding.user_id == user_id)
            .order_by(text("score DESC"))
            .limit(limit)
        )
        if category_id is not None:
            stmt = stmt.where(Document.category_id == category_id)

        result = await db.execute(stmt)
        rows = result.all()

        return [
            SearchResult(document=row.Document, score=float(row.score), embedding=row.DocumentEmbedding)
            for row in rows
            if float(row.score) >= min_score
        ]

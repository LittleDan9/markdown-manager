"""Hybrid search service — semantic vectors + full-text keyword search.

Uses halfvec embeddings with binary pre-filtering (QJL-inspired) for
fast two-stage retrieval: Hamming distance on sign-bits → cosine rerank.
Combines with PostgreSQL tsvector full-text search via Reciprocal Rank Fusion.
Redis caching avoids repeated embedding + search for similar queries.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from pgvector.sqlalchemy import HALFVEC  # noqa: F401 — registered for HALFVEC columns
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_embedding import EMBEDDING_DIM

from app.models.document import Document
from app.models.document_embedding import DocumentEmbedding
from app.services.search.content_processor import (
    chunk_document_content,
    extract_summary,
    prepare_document_content,
)
from app.services.search.embedding_client import EmbeddingClient
from app.services.storage.filesystem import Filesystem

logger = logging.getLogger(__name__)

# Redis cache TTL for search results (seconds)
_SEARCH_CACHE_TTL = 120
_SEARCH_CACHE_PREFIX = "search:v1:"


def _get_filesystem() -> Filesystem:
    """Lazily create Filesystem to avoid path creation errors at import time."""
    return Filesystem()


@dataclass
class SearchResult:
    document: Document
    score: float  # cosine similarity, 0.0–1.0 (higher = more similar)
    embedding: DocumentEmbedding | None = None  # carries pre-computed summary
    explanation: str | None = None  # LLM-generated relevance explanation (deep search only)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _to_binary(vector: list[float]) -> str:
    """Convert a float vector to binary sign-bit string (QJL-inspired).

    Each dimension becomes '1' if >= 0, '0' if < 0.
    This preserves angular relationships for fast Hamming pre-filtering.
    """
    return "".join("1" if v >= 0 else "0" for v in vector)


class SemanticSearchService:
    """Handles embedding documents and querying by cosine similarity.

    Optionally accepts a Redis client for search result caching.
    """

    def __init__(self, embedding_client: EmbeddingClient, redis_client=None):
        self._client = embedding_client
        self._redis = redis_client

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
        Splits long documents into overlapping chunks for multi-vector retrieval.
        Skips embedding if the content hash hasn't changed.
        Returns True if new embeddings were written, False if skipped.
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

        # Check for existing embeddings (may have multiple chunks)
        result = await db.execute(
            select(DocumentEmbedding).where(DocumentEmbedding.document_id == document.id)
            .order_by(DocumentEmbedding.chunk_index)
        )
        existing_rows: list[DocumentEmbedding] = list(result.scalars().all())

        if existing_rows and existing_rows[0].content_hash == content_hash:
            logger.debug("Skipping re-embedding for doc %s — content unchanged", document.id)
            return False

        # Chunk the document
        chunks = chunk_document_content(document.name, content)

        # Batch-embed all chunks at once
        try:
            chunk_texts = [c.text for c in chunks]
            embeddings = await self._client.embed_texts(chunk_texts)
        except Exception:
            logger.exception("Failed to get embeddings for doc %s", document.id)
            return False

        summary = extract_summary(document.name, content)

        # Delete old chunks if count changed
        if len(existing_rows) != len(chunks):
            for old in existing_rows:
                await db.delete(old)
            await db.flush()
            existing_rows = []

        # Upsert each chunk (skip embedding_binary — asyncpg can't bind str to bit)
        chunk_ids: list[int] = []
        binary_vecs: list[str] = []
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            binary_vecs.append(_to_binary(vector))
            if i < len(existing_rows):
                existing_rows[i].embedding = vector
                existing_rows[i].content_hash = content_hash
                existing_rows[i].summary = summary if i == 0 else None
                existing_rows[i].chunk_index = i
                chunk_ids.append(existing_rows[i].id)
            else:
                row = DocumentEmbedding(
                    document_id=document.id,
                    user_id=user_id,
                    embedding=vector,
                    content_hash=content_hash,
                    chunk_index=i,
                    summary=summary if i == 0 else None,
                )
                db.add(row)

        await db.flush()  # assigns IDs to new rows

        # Collect IDs for newly added rows
        if len(chunk_ids) < len(chunks):
            result_rows = await db.execute(
                select(DocumentEmbedding.id)
                .where(DocumentEmbedding.document_id == document.id)
                .order_by(DocumentEmbedding.chunk_index)
            )
            chunk_ids = [r[0] for r in result_rows.all()]

        # Update binary embeddings via raw SQL (asyncpg can't bind str→bit via ORM)
        for row_id, bvec in zip(chunk_ids, binary_vecs):
            await db.execute(
                text(f"UPDATE document_embeddings SET embedding_binary = '{bvec}'::bit({EMBEDDING_DIM}) WHERE id = :rid"),
                {"rid": row_id},
            )

        await db.commit()
        await self._invalidate_user_cache(user_id)
        logger.info(
            "Indexed document %s (%d chunks, mermaid=%s)",
            document.id, len(chunks), processed.has_mermaid,
        )

        return True

    async def delete_embedding(self, db: AsyncSession, document_id: int) -> None:
        """Remove all embedding chunks for a deleted document (cascade also handles this)."""
        result = await db.execute(
            select(DocumentEmbedding).where(DocumentEmbedding.document_id == document_id)
        )
        rows = result.scalars().all()
        for row in rows:
            await db.delete(row)
        if rows:
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
                await db.rollback()
                counts["failed"] += 1

        return counts

    async def backfill_content_text(self, db: AsyncSession, user_id: int) -> dict[str, int]:
        """Populate content_text column for all user documents from disk."""
        from app.services.search.content_processor import strip_markdown_for_search

        result = await db.execute(
            select(Document).where(
                Document.user_id == user_id,
                Document.file_path.is_not(None),
            )
        )
        documents = result.scalars().all()
        counts = {"updated": 0, "skipped": 0, "failed": 0}

        for doc in documents:
            try:
                content = await _get_filesystem().read_document(user_id, doc.file_path)
                if content is None:
                    counts["skipped"] += 1
                    continue
                doc.content_text = strip_markdown_for_search(content)
                counts["updated"] += 1
            except Exception:
                logger.warning("Failed to backfill content_text for doc %s", doc.id)
                counts["failed"] += 1

        await db.commit()
        return counts

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def _cache_key(self, user_id: int, query: str, limit: int, min_score: float, category_id: int | None) -> str:
        """Build a Redis cache key from search parameters."""
        raw = f"{user_id}:{query}:{limit}:{min_score}:{category_id}"
        return _SEARCH_CACHE_PREFIX + hashlib.md5(raw.encode()).hexdigest()

    async def _invalidate_user_cache(self, user_id: int) -> None:
        """Invalidate all cached searches for a user after re-indexing."""
        if not self._redis:
            return
        try:
            # Scan and delete keys matching the user's search cache
            # Using pattern scan — safe because search cache keys are short-lived
            async for key in self._redis.scan_iter(match=f"{_SEARCH_CACHE_PREFIX}*", count=100):
                await self._redis.delete(key)
        except Exception:
            logger.debug("Failed to invalidate search cache", exc_info=True)

    # RRF constant — controls how much rank position affects fusion score
    _RRF_K = 60

    async def search(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 10,
        min_score: float = 0.25,
        category_id: int | None = None,
    ) -> list[SearchResult]:
        """
        Hybrid search: semantic vectors + full-text keyword search.

        1. Semantic: binary pre-filter → cosine rerank (vector similarity)
        2. Keyword: PostgreSQL tsvector full-text search (exact term matching)
        3. Fusion: Reciprocal Rank Fusion combines both result sets

        Falls back to keyword-only if embedding service is unavailable.
        Results cached in Redis for 120s to avoid repeated DB/embedding hits.
        """
        # Check Redis cache
        if self._redis:
            import json as _json
            cache_key = self._cache_key(user_id, query, limit, min_score, category_id)
            try:
                cached = await self._redis.get(cache_key)
                if cached:
                    data = _json.loads(cached)
                    results = []
                    for d in data:
                        doc = await db.get(Document, d["id"])
                        if doc:
                            results.append(SearchResult(document=doc, score=d["score"]))
                    if results:
                        return results
            except Exception:
                pass
        else:
            cache_key = None

        semantic_results = await self._semantic_search(
            db, user_id, query, limit=limit * 2, category_id=category_id
        )
        keyword_results = await self._keyword_search(
            db, user_id, query, limit=limit * 2, category_id=category_id
        )

        # Fuse results using RRF
        fused = self._reciprocal_rank_fusion(semantic_results, keyword_results)

        # Filter by min_score and return top-k
        filtered = [r for r in fused if r.score >= min_score]
        results = filtered[:limit]

        # Write to Redis cache
        if self._redis and cache_key and results:
            import json as _json
            try:
                cache_data = [{"id": r.document.id, "score": r.score} for r in results]
                await self._redis.setex(cache_key, _SEARCH_CACHE_TTL, _json.dumps(cache_data))
            except Exception:
                pass

        return results

    async def _semantic_search(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 20,
        category_id: int | None = None,
    ) -> list[SearchResult]:
        """Vector similarity search via two-stage binary pre-filter + cosine rerank."""
        try:
            query_vector = await self._client.embed_query(query)
        except Exception:
            logger.warning("Embedding service unavailable — falling back to keyword-only")
            return []

        query_binary = _to_binary(query_vector)
        _PREFILTER_LIMIT = min(50, limit * 5)

        stmt = (
            select(
                Document,
                DocumentEmbedding,
                (1 - DocumentEmbedding.embedding.cosine_distance(query_vector)).label("score"),
            )
            .join(DocumentEmbedding, DocumentEmbedding.document_id == Document.id)
            .where(DocumentEmbedding.user_id == user_id)
        )
        if category_id is not None:
            stmt = stmt.where(Document.category_id == category_id)

        try:
            stmt = stmt.order_by(
                text(f"document_embeddings.embedding_binary <~> '{query_binary}'::bit({EMBEDDING_DIM})")
            ).limit(_PREFILTER_LIMIT)
            result = await db.execute(stmt)
            rows = result.all()
        except Exception:
            logger.warning("Binary pre-filter failed, falling back to cosine ordering")
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

        scored = [
            SearchResult(document=row.Document, score=float(row.score), embedding=row.DocumentEmbedding)
            for row in rows
        ]
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:limit]

    async def _keyword_search(
        self,
        db: AsyncSession,
        user_id: int,
        query: str,
        limit: int = 20,
        category_id: int | None = None,
    ) -> list[SearchResult]:
        """Full-text keyword search via PostgreSQL tsvector."""
        try:
            ts_query = func.plainto_tsquery("english", query)
            stmt = (
                select(
                    Document,
                    func.ts_rank(Document.search_vector, ts_query).label("rank"),
                )
                .where(Document.user_id == user_id)
                .where(Document.search_vector.op("@@")(ts_query))
            )
            if category_id is not None:
                stmt = stmt.where(Document.category_id == category_id)
            stmt = stmt.order_by(text("rank DESC")).limit(limit)
            result = await db.execute(stmt)
            rows = result.all()
            return [
                SearchResult(document=row.Document, score=float(row.rank), embedding=None)
                for row in rows
            ]
        except Exception:
            logger.warning("Keyword search failed", exc_info=True)
            return []

    def _reciprocal_rank_fusion(
        self,
        semantic_results: list[SearchResult],
        keyword_results: list[SearchResult],
    ) -> list[SearchResult]:
        """Combine semantic and keyword results using RRF."""
        k = self._RRF_K
        doc_scores: dict[int, float] = {}
        doc_map: dict[int, SearchResult] = {}

        for rank, r in enumerate(semantic_results):
            doc_id = r.document.id
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
            if doc_id not in doc_map or (r.embedding is not None):
                doc_map[doc_id] = r

        for rank, r in enumerate(keyword_results):
            doc_id = r.document.id
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
            if doc_id not in doc_map:
                doc_map[doc_id] = r

        # Normalize RRF scores to 0-1 range
        max_score = max(doc_scores.values()) if doc_scores else 1.0
        fused = []
        for doc_id, rrf_score in doc_scores.items():
            result = doc_map[doc_id]
            fused.append(SearchResult(
                document=result.document,
                score=rrf_score / max_score,
                embedding=result.embedding,
            ))
        fused.sort(key=lambda r: r.score, reverse=True)
        return fused

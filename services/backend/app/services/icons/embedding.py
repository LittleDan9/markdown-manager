"""Icon embedding service — index icons and search by cosine similarity.

Uses halfvec embeddings with binary pre-filtering for fast two-stage
retrieval: Hamming distance on sign-bits → cosine rerank.
Mirrors the document embedding service pattern.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

from pgvector.sqlalchemy import HALFVEC  # noqa: F401
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconEmbedding, IconMetadata, IconPack, ICON_EMBEDDING_DIM
from app.services.search.embedding_client import EmbeddingClient

logger = logging.getLogger(__name__)


def _to_binary(vector: list[float]) -> str:
    """Convert float vector to binary string (sign-bit quantization)."""
    return "".join("1" if v >= 0 else "0" for v in vector)


def _build_embed_text(icon: IconMetadata) -> str:
    """Concatenate icon text fields for embedding."""
    parts = [icon.key]
    if icon.display_name:
        parts.append(icon.display_name)
    if icon.search_terms:
        parts.append(icon.search_terms)
    if icon.tags:
        parts.append(icon.tags)
    if icon.aliases:
        parts.append(icon.aliases)
    if icon.description:
        parts.append(icon.description)
    return " ".join(parts)


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


@dataclass
class IconSearchResult:
    """A single icon search result with relevance score."""
    icon: IconMetadata
    score: float


class IconEmbeddingService:
    """Service for indexing and searching icons via embeddings."""

    def __init__(self, embedding_client: EmbeddingClient):
        self._client = embedding_client

    async def index_icon(self, db: AsyncSession, icon: IconMetadata) -> bool:
        """Index a single icon. Returns True if embedding was (re)created, False if skipped."""
        embed_text = _build_embed_text(icon)
        new_hash = _content_hash(embed_text)

        # Check existing embedding
        existing = await db.execute(
            select(IconEmbedding).where(IconEmbedding.icon_id == icon.id)
        )
        existing_row = existing.scalar_one_or_none()

        if existing_row and existing_row.content_hash == new_hash:
            return False  # unchanged

        # Embed
        vectors = await self._client.embed_texts([embed_text])
        if not vectors or not vectors[0]:
            logger.warning("Empty embedding for icon %s", icon.id)
            return False

        vector = vectors[0]
        bvec = _to_binary(vector)

        if existing_row:
            existing_row.embedding = vector
            existing_row.content_hash = new_hash
            existing_row.embedded_text = embed_text
            row_id = existing_row.id
        else:
            new_row = IconEmbedding(
                icon_id=icon.id,
                embedding=vector,
                content_hash=new_hash,
                embedded_text=embed_text,
            )
            db.add(new_row)
            await db.flush()
            row_id = new_row.id

        # Set binary via raw SQL (asyncpg can't bind str to bit type)
        await db.execute(
            text(f"UPDATE icon_embeddings SET embedding_binary = '{bvec}'::bit({ICON_EMBEDDING_DIM}) WHERE id = :rid"),
            {"rid": row_id},
        )
        await db.commit()
        return True

    async def bulk_reindex(self, db: AsyncSession, batch_size: int = 50) -> dict:
        """Reindex all icons. Returns {indexed, skipped, failed} counts."""
        result = await db.execute(
            select(IconMetadata).options(selectinload(IconMetadata.pack))
        )
        icons = result.scalars().all()

        indexed = skipped = failed = 0
        batch_icons = []
        batch_texts = []
        batch_hashes = []

        # Load existing hashes for skip detection
        existing_result = await db.execute(
            select(IconEmbedding.icon_id, IconEmbedding.content_hash)
        )
        existing_hashes = {row.icon_id: row.content_hash for row in existing_result}

        for icon in icons:
            embed_text = _build_embed_text(icon)
            new_hash = _content_hash(embed_text)

            if existing_hashes.get(icon.id) == new_hash:
                skipped += 1
                continue

            batch_icons.append(icon)
            batch_texts.append(embed_text)
            batch_hashes.append(new_hash)

            if len(batch_texts) >= batch_size:
                count = await self._embed_batch(db, batch_icons, batch_texts, batch_hashes, existing_hashes)
                indexed += count
                failed += len(batch_texts) - count
                batch_icons, batch_texts, batch_hashes = [], [], []

        # Process remaining
        if batch_texts:
            count = await self._embed_batch(db, batch_icons, batch_texts, batch_hashes, existing_hashes)
            indexed += count
            failed += len(batch_texts) - count

        return {"indexed": indexed, "skipped": skipped, "failed": failed, "total": len(icons)}

    async def _embed_batch(
        self, db: AsyncSession, icons: list, texts: list, hashes: list, existing_hashes: dict
    ) -> int:
        """Embed and store a batch. Returns number successfully indexed."""
        try:
            vectors = await self._client.embed_texts(texts)
        except Exception:
            logger.exception("Batch embedding failed for %d icons", len(texts))
            return 0

        count = 0
        for icon, embed_text, new_hash, vector in zip(icons, texts, hashes, vectors):
            if not vector:
                continue
            bvec = _to_binary(vector)

            if icon.id in existing_hashes:
                # Update existing
                await db.execute(
                    text(
                        "UPDATE icon_embeddings SET embedding = :vec, "
                        f"embedding_binary = '{bvec}'::bit({ICON_EMBEDDING_DIM}), "
                        "content_hash = :hash, embedded_text = :txt, embedded_at = now() "
                        "WHERE icon_id = :iid"
                    ),
                    {"vec": str(vector), "hash": new_hash, "txt": embed_text, "iid": icon.id},
                )
            else:
                new_row = IconEmbedding(
                    icon_id=icon.id,
                    embedding=vector,
                    content_hash=new_hash,
                    embedded_text=embed_text,
                )
                db.add(new_row)
                await db.flush()
                await db.execute(
                    text(
                        "UPDATE icon_embeddings SET embedding_binary = "
                        f"'{bvec}'::bit({ICON_EMBEDDING_DIM}) WHERE id = :rid"
                    ),
                    {"rid": new_row.id},
                )
                existing_hashes[icon.id] = new_hash

            count += 1

        await db.commit()
        return count

    async def search(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20,
        min_score: float = 0.0,
        packs: Optional[list[str]] = None,
    ) -> list[IconSearchResult]:
        """Two-stage hybrid search: binary Hamming prefilter → cosine rerank."""
        # Embed query
        query_vector = await self._client.embed_query(query)
        if not query_vector:
            return []

        query_binary = _to_binary(query_vector)
        prefilter_limit = min(100, limit * 5)

        # Stage 1: Hamming prefilter + cosine score
        stmt = (
            select(
                IconMetadata,
                IconEmbedding,
                (1 - IconEmbedding.embedding.cosine_distance(query_vector)).label("score"),
            )
            .join(IconEmbedding, IconEmbedding.icon_id == IconMetadata.id)
            .join(IconPack, IconPack.id == IconMetadata.pack_id)
            .options(selectinload(IconMetadata.pack))
        )

        if packs:
            stmt = stmt.where(IconPack.name.in_(packs))

        stmt = stmt.order_by(
            text(f"icon_embeddings.embedding_binary <~> '{query_binary}'::bit({ICON_EMBEDDING_DIM})")
        ).limit(prefilter_limit)

        try:
            result = await db.execute(stmt)
            rows = result.all()
        except Exception:
            logger.exception("Binary prefilter failed, falling back to cosine-only")
            stmt = (
                select(
                    IconMetadata,
                    IconEmbedding,
                    (1 - IconEmbedding.embedding.cosine_distance(query_vector)).label("score"),
                )
                .join(IconEmbedding, IconEmbedding.icon_id == IconMetadata.id)
                .join(IconPack, IconPack.id == IconMetadata.pack_id)
                .options(selectinload(IconMetadata.pack))
            )
            if packs:
                stmt = stmt.where(IconPack.name.in_(packs))
            stmt = stmt.order_by(text("score DESC")).limit(limit)
            result = await db.execute(stmt)
            rows = result.all()

        # Stage 2: Cosine rerank
        scored = [
            IconSearchResult(icon=row.IconMetadata, score=float(row.score))
            for row in rows
            if float(row.score) >= min_score
        ]
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:limit]

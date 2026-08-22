"""Helpers for keeping search indexes in sync after document content changes."""
from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document

logger = logging.getLogger(__name__)


async def update_search_index(db: AsyncSession, user_id: int, document: Document, content: str | None = None) -> None:
    """Populate content_text and trigger embedding after a document content change.

    Reads content from disk if not provided. Best-effort — failures are logged but not raised.
    """
    try:
        if content is None:
            from app.services.storage.filesystem import Filesystem
            fs = Filesystem()
            content = await fs.read_document(user_id, document.file_path)
            if content is None:
                return

        from app.services.search.content_processor import strip_markdown_for_search
        document.content_text = strip_markdown_for_search(content)
        await db.commit()
        await db.refresh(document)
    except Exception:
        logger.warning("Failed to update content_text for doc %s", document.id, exc_info=True)

    try:
        from app.services.search.embedding_client import EmbeddingClient
        from app.services.search.semantic import SemanticSearchService
        from app.configs.settings import get_settings
        settings = get_settings()
        client = EmbeddingClient(base_url=settings.embedding_service_url)
        service = SemanticSearchService(client)
        await service.index_document(db, user_id, document)
    except Exception:
        logger.warning("Failed to re-embed document %s", document.id, exc_info=True)

"""RAG Q&A service — retrieves relevant document context, streams answer via Ollama."""
from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.document import Document
from app.services.search.semantic import SemanticSearchService
from app.services.storage.filesystem import Filesystem

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://ollama:11434"
DEFAULT_MODEL = "mistral"


def _get_filesystem() -> Filesystem:
    """Lazily create Filesystem to avoid path creation errors at import time."""
    return Filesystem()

_SYSTEM_PROMPT = """You are a helpful assistant with access to the user's personal document library.
Answer questions using ONLY the document context provided below.
If the answer is not contained in the provided context, say "I don't have enough information in your documents to answer that."
When referencing information, mention the document name it came from.
Be concise and direct."""


class QAService:
    """Retrieves relevant document context and streams an answer via Ollama."""

    def __init__(
        self,
        search_service: SemanticSearchService,
        ollama_url: str = DEFAULT_OLLAMA_URL,
        model: str = DEFAULT_MODEL,
    ):
        self._search = search_service
        self._ollama_url = ollama_url.rstrip("/")
        self._model = model

    async def answer_stream(
        self,
        db: AsyncSession,
        user_id: int,
        question: str,
        document_id: int | None = None,
    ) -> AsyncIterator[str]:
        """
        Yield answer tokens as they stream from Ollama.

        If *document_id* is provided, context is limited to that document ("Current Doc" mode).
        Otherwise, the top-5 semantically relevant documents are used ("All Docs" mode).
        """
        context_chunks = await self._build_context(db, user_id, question, document_id)

        if not context_chunks:
            yield "I couldn't find any relevant documents in your library to answer that question."
            return

        prompt = self._build_prompt(question, context_chunks)

        async for token in self._stream_ollama(prompt):
            yield token

    async def health_check(self) -> bool:
        """Return True if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._ollama_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _build_context(
        self,
        db: AsyncSession,
        user_id: int,
        question: str,
        document_id: int | None,
    ) -> list[dict]:
        """Return list of {name, content} dicts for context injection."""
        if document_id is not None:
            return await self._context_for_document(db, user_id, document_id)

        # All-docs mode: retrieve top-5 similar documents
        results = await self._search.search(db, user_id, question, limit=5)
        chunks = []
        for result in results:
            doc = result.document
            if not doc.file_path:
                continue
            content = await _get_filesystem().read_document(user_id, doc.file_path)
            if content:
                chunks.append({"name": doc.name, "content": content[:3000]})  # cap per doc
        return chunks

    async def _context_for_document(
        self, db: AsyncSession, user_id: int, document_id: int
    ) -> list[dict]:
        """Read a single document's content for context, enforcing user ownership."""
        result = await db.execute(
            select(Document).where(
                Document.id == document_id,
                Document.user_id == user_id,
            )
        )
        doc: Document | None = result.scalar_one_or_none()
        if not doc or not doc.file_path:
            return []
        content = await _get_filesystem().read_document(user_id, doc.file_path)
        if not content:
            return []
        return [{"name": doc.name, "content": content}]

    def _build_prompt(self, question: str, context_chunks: list[dict]) -> str:
        context_text = "\n\n---\n\n".join(
            f"Document: {chunk['name']}\n\n{chunk['content']}"
            for chunk in context_chunks
        )
        return (
            f"{_SYSTEM_PROMPT}\n\n"
            f"=== DOCUMENT CONTEXT ===\n{context_text}\n\n"
            f"=== QUESTION ===\n{question}"
        )

    async def _stream_ollama(self, prompt: str) -> AsyncIterator[str]:
        """Stream response tokens from Ollama's generate endpoint."""
        import json

        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self._ollama_url}/api/generate",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        if token := data.get("response", ""):
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

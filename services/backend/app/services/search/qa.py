"""RAG Q&A service — retrieves relevant document context, streams answer via Ollama."""
from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.services.search.semantic import SemanticSearchService
from app.services.storage.filesystem import Filesystem

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://ollama:11434"
DEFAULT_MODEL = "mistral"


def _get_filesystem() -> Filesystem:
    """Lazily create Filesystem to avoid path creation errors at import time."""
    return Filesystem()


# System prompt for single-document mode (Current Doc / Deep Think)
_SYSTEM_PROMPT_SINGLE = """You are a helpful assistant focused on one specific document.
Answer questions using the document content provided below.
If the answer is not in the document, say so clearly.
When quoting or paraphrasing, reference the document by name.
Be concise and direct."""

# System prompt for all-docs mode — LLM always receives both a catalogue and semantic results
_SYSTEM_PROMPT_ALL = """You are a helpful assistant with access to the user's personal document library.
You are given two things:
1. DOCUMENT CATALOGUE — a full list of all documents in the library with folder, date, and a brief summary.
2. RELEVANT EXCERPTS — detailed content from the documents most relevant to the question
   (may be empty if the question is general).

Use the catalogue to answer questions about what documents exist, when they were created, or what topics the library covers.
Use the relevant excerpts to answer specific questions about document content.
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
        deep_think: bool = False,
    ) -> AsyncIterator[str]:
        """
        Yield answer tokens as they stream from Ollama.

        If *document_id* is provided, context is limited to that document ("Current Doc" mode).
        If *deep_think* is True (only valid with document_id), the full document text is sent
        instead of the pre-computed summary.
        If *document_id* is None, All Docs mode is used: a document catalogue is always
        included, plus semantic search excerpts for the top matching docs.
        """
        all_docs_mode = document_id is None
        context_chunks, catalogue = await self._build_context(
            db, user_id, question, document_id, deep_think=deep_think
        )

        if not catalogue and not context_chunks:
            yield "Your document library appears to be empty. Add some documents first."
            return

        prompt = self._build_prompt(question, context_chunks, catalogue, all_docs_mode)

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
        deep_think: bool = False,
    ) -> tuple[list[dict], str]:
        """Return (context_chunks, catalogue_text).

        - catalogue_text: always populated for All Docs mode; empty for single-doc mode.
        - context_chunks: detailed content dicts [{name, content}] for the semantic matches.
        """
        if document_id is not None:
            chunks = await self._context_for_document(
                db, user_id, document_id, deep_think=deep_think
            )
            return chunks, ""

        # ------------------------------------------------------------------
        # All Docs mode
        # ------------------------------------------------------------------
        # 1. Build a compact catalogue of every document in the library
        catalogue = await self._build_catalogue(db, user_id)

        # 2. Semantic search — top-3 regardless of score (model can judge relevance)
        results = await self._search.search(db, user_id, question, limit=3)
        chunks = []
        for result in results:
            doc = result.document
            if not doc.file_path:
                continue
            embedding = result.embedding
            if embedding and embedding.summary:
                chunks.append({"name": doc.name, "content": embedding.summary})
            else:
                content = await _get_filesystem().read_document(user_id, doc.file_path)
                if content:
                    chunks.append({"name": doc.name, "content": content[:500]})
        return chunks, catalogue

    async def _build_catalogue(self, db: AsyncSession, user_id: int) -> str:
        """Build a compact listing of all user documents for the LLM catalogue section."""
        from app.models.document_embedding import DocumentEmbedding as _Emb

        # Order by most recently opened first so the cap keeps the most relevant docs.
        # Hard cap at 25 to keep prompt tokens manageable on CPU inference.
        _CATALOGUE_LIMIT = 25
        rows = await db.execute(
            select(Document, _Emb.summary)
            .outerjoin(_Emb, _Emb.document_id == Document.id)
            .where(Document.user_id == user_id)
            .order_by(Document.last_opened_at.desc().nullslast(), Document.created_at.desc())
            .limit(_CATALOGUE_LIMIT + 1)  # fetch one extra to detect truncation
        )
        docs = rows.all()
        truncated = len(docs) > _CATALOGUE_LIMIT
        if truncated:
            docs = docs[:_CATALOGUE_LIMIT]

        if not docs:
            return ""

        total_note = f" (showing {len(docs)} most recently opened)" if truncated else ""
        lines = [f"Library contains {len(docs)} document(s){total_note}:"]
        for row in docs:
            doc = row.Document
            folder = (doc.folder_path or "/").lstrip("/") or "root"
            created = doc.created_at.strftime("%Y-%m-%d") if doc.created_at else "unknown"
            last_open = (
                doc.last_opened_at.strftime("%Y-%m-%d") if doc.last_opened_at else "never"
            )
            # Compact single-line entry keeps the catalogue token-efficient
            summary_hint = ""
            if row.summary:
                first_line = row.summary.splitlines()[0].lstrip("# ").strip()
                if first_line:
                    summary_hint = f" — {first_line[:70]}"
            lines.append(
                f"  - {folder}/{doc.name} (created {created}, last opened {last_open}){summary_hint}"
            )
        return "\n".join(lines)

    async def _context_for_document(
        self,
        db: AsyncSession,
        user_id: int,
        document_id: int,
        deep_think: bool = False,
    ) -> list[dict]:
        """Read a single document's content for context, enforcing user ownership.

        In normal mode, uses the pre-computed summary for a fast, token-efficient prompt.
        In deep_think mode, sends the full document text so the model can reason over
        every detail — slower prefill but better for precise questions.
        """
        from sqlalchemy import select as _select
        from app.models.document_embedding import DocumentEmbedding

        result = await db.execute(
            _select(Document, DocumentEmbedding)
            .outerjoin(DocumentEmbedding, DocumentEmbedding.document_id == Document.id)
            .where(
                Document.id == document_id,
                Document.user_id == user_id,
            )
        )
        row = result.first()
        if not row:
            return []
        doc, embedding = row.Document, row.DocumentEmbedding
        if not doc.file_path:
            return []

        if deep_think:
            # Full document text — let Ollama see everything
            content = await _get_filesystem().read_document(user_id, doc.file_path)
            if not content:
                return []
            return [{"name": doc.name, "content": content}]

        # Normal mode: use stored summary (fast)
        if embedding and embedding.summary:
            return [{"name": doc.name, "content": embedding.summary}]

        # Fallback: file read with cap (embedding not yet indexed)
        content = await _get_filesystem().read_document(user_id, doc.file_path)
        if not content:
            return []
        return [{"name": doc.name, "content": content[:500]}]

    def _build_prompt(
        self,
        question: str,
        context_chunks: list[dict],
        catalogue: str,
        all_docs_mode: bool,
    ) -> str:
        if all_docs_mode:
            cat_section = f"=== DOCUMENT CATALOGUE ===\n{catalogue}\n" if catalogue else ""
            if context_chunks:
                excerpts = "\n\n---\n\n".join(
                    f"Document: {chunk['name']}\n\n{chunk['content']}"
                    for chunk in context_chunks
                )
                content_section = f"\n=== RELEVANT EXCERPTS ===\n{excerpts}\n"
            else:
                content_section = "\n=== RELEVANT EXCERPTS ===\n(No specific excerpts matched — use the catalogue above.)\n"
            return (
                f"{_SYSTEM_PROMPT_ALL}\n\n"
                f"{cat_section}"
                f"{content_section}\n"
                f"=== QUESTION ===\n{question}"
            )

        # Single-document mode
        context_text = "\n\n---\n\n".join(
            f"Document: {chunk['name']}\n\n{chunk['content']}"
            for chunk in context_chunks
        )
        return (
            f"{_SYSTEM_PROMPT_SINGLE}\n\n"
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
            # 4096 context: sufficient for our prompts (~1500 tokens) and halves
            # the KV-cache size from 1024 MiB to 512 MiB, improving prefill speed.
            "options": {"num_ctx": 4096},
        }

        # No read timeout — CPU prefill can take minutes for large prompts.
        # Connect timeout guards against Ollama being unreachable.
        async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0)) as client:
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

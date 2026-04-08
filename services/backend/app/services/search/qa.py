"""RAG Q&A service — retrieves relevant document context, streams answer via LLM provider."""
from __future__ import annotations

import logging
import time
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.services.search.providers.base import LLMProvider
from app.services.search.providers.ollama import OllamaProvider
from app.services.search.semantic import SemanticSearchService
from app.services.storage.filesystem import Filesystem

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://ollama:11434"
DEFAULT_MODEL = "qwen2.5:1.5b"

# Cap deep-think document content — q8_0 KV cache quantization allows larger context
_DEEP_THINK_MAX_CHARS = 16000

# TTL-based in-memory catalogue cache keyed by user_id.
# Avoids re-querying the DB on every chat message when docs rarely change.
_CATALOGUE_TTL = 60  # seconds
# Cache key is (user_id, category_id) — category_id=None for unfiltered queries.
_catalogue_cache: dict[tuple[int, int | None], tuple[float, str]] = {}


def _get_filesystem() -> Filesystem:
    """Lazily create Filesystem to avoid path creation errors at import time."""
    return Filesystem()


# System prompt for single-document mode (Current Doc / Deep Think)
_SYSTEM_PROMPT_SINGLE = (
    "Answer questions about the document below. "
    "Prioritise information from the document, but you may also use your general knowledge "
    "to supplement or provide additional context. When using general knowledge, indicate that "
    "clearly. Reference the document by name. Be concise."
)

# Strict variant — restricts the LLM to document content only
_SYSTEM_PROMPT_SINGLE_STRICT = (
    "Answer questions about the document below. "
    "If the answer isn't in the document, say so. "
    "Do not use outside knowledge. "
    "Reference the document by name. Be concise."
)

# System prompt for all-docs mode
_SYSTEM_PROMPT_ALL = """Answer questions about the user's document library.
You have: 1) CATALOGUE — list of recent documents, 2) EXCERPTS — content from the most relevant documents.
Use the catalogue for questions about what exists. Use excerpts for content questions.
You may also draw on your general knowledge to supplement when the documents don't fully cover the topic — clearly indicate when you do.
Always mention the exact document name when citing information so the user can find it.
Be concise."""

# Strict variant — restricts the LLM to library content only
_SYSTEM_PROMPT_ALL_STRICT = """Answer questions about the user's document library.
You have: 1) CATALOGUE — list of recent documents, 2) EXCERPTS — content from the most relevant documents.
Use the catalogue for questions about what exists. Use excerpts for content questions.
Do not use outside knowledge — only answer from the provided documents.
Always mention the exact document name when citing information so the user can find it.
Be concise."""


class QAService:
    """Retrieves relevant document context and streams an answer via an LLM provider."""

    def __init__(
        self,
        search_service: SemanticSearchService,
        provider: LLMProvider | None = None,
        *,
        # Legacy kwargs kept for backward-compatibility with existing call sites
        ollama_url: str = DEFAULT_OLLAMA_URL,
        model: str = DEFAULT_MODEL,
    ):
        self._search = search_service
        if provider is not None:
            self._provider = provider
        else:
            # Fallback: build a default OllamaProvider from legacy params
            self._provider = OllamaProvider(url=ollama_url, model=model)

    async def answer_stream(
        self,
        db: AsyncSession,
        user_id: int,
        question: str,
        document_id: int | None = None,
        category_id: int | None = None,
        deep_think: bool = False,
        history: list | None = None,
        selection_context: str | None = None,
        strict_context: bool = False,
    ) -> AsyncIterator[str | dict]:
        """
        Yield answer tokens as they stream from the configured LLM provider.

        If *document_id* is provided, context is limited to that document ("Current Doc" mode).
        If *deep_think* is True (only valid with document_id), the full document text is sent
        instead of the pre-computed summary.
        If *document_id* is None, All Docs mode is used: a document catalogue is always
        included, plus semantic search excerpts for the top matching docs.
        If *category_id* is provided (All Docs mode only), results are limited to that category.
        *history* contains prior conversation turns for multi-turn context.
        *selection_context* is optional editor-selected text to include in the prompt.

        The final yielded value is a dict with timing metrics (not a token string).
        """
        t_start = time.monotonic()

        all_docs_mode = document_id is None
        context_chunks, catalogue = await self._build_context(
            db, user_id, question, document_id, deep_think=deep_think,
            category_id=category_id,
        )
        t_context = time.monotonic()

        if not catalogue and not context_chunks:
            yield "Your document library appears to be empty. Add some documents first."
            return

        system_prompt, user_prompt = self._build_prompt(
            question, context_chunks, catalogue, all_docs_mode,
            selection_context=selection_context,
            strict_context=strict_context,
        )
        history_msgs = self._history_as_messages(
            history,
            max_turns=self._provider.max_history_turns,
            max_chars=self._provider.max_history_chars,
        )
        prompt_chars = len(system_prompt) + len(user_prompt)
        history_chars = sum(len(m.get("content", "")) for m in history_msgs) if history_msgs else 0
        logger.info(
            "Chat prompt built: chars=%d history_chars=%d history_turns=%d chunks=%d catalogue_lines=%d provider=%s",
            prompt_chars, history_chars,
            len(history_msgs) if history_msgs else 0,
            len(context_chunks),
            catalogue.count("\n") + 1 if catalogue else 0,
            self._provider.provider_name,
        )

        t_first_token = None
        token_count = 0
        async for token in self._provider.stream(
            user_prompt,
            system_prompt=system_prompt,
            history=history_msgs or None,
        ):
            if t_first_token is None:
                t_first_token = time.monotonic()
            token_count += 1
            yield token

        t_done = time.monotonic()
        metrics = {
            "__metrics__": True,
            "context_ms": round((t_context - t_start) * 1000),
            "first_token_ms": round(((t_first_token or t_done) - t_start) * 1000),
            "generation_ms": round((t_done - (t_first_token or t_done)) * 1000),
            "total_ms": round((t_done - t_start) * 1000),
            "tokens": token_count,
            "model": self._provider.model_name,
            "provider": self._provider.provider_name,
        }
        logger.info(
            "Chat Q&A completed: provider=%s model=%s context=%dms first_token=%dms generation=%dms total=%dms tokens=%d",
            self._provider.provider_name, metrics["model"],
            metrics["context_ms"], metrics["first_token_ms"],
            metrics["generation_ms"], metrics["total_ms"], metrics["tokens"],
        )
        yield metrics

    async def health_check(self) -> bool:
        """Return True if the LLM provider is reachable."""
        return await self._provider.health_check()

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
        category_id: int | None = None,
    ) -> tuple[list[dict], str]:
        """Return (context_chunks, catalogue_text).

        - catalogue_text: always populated for All Docs mode; empty for single-doc mode.
        - context_chunks: detailed content dicts [{name, content}] for the semantic matches.
        - category_id: optional filter for All Docs mode to limit to a single category.
        """
        if document_id is not None:
            chunks = await self._context_for_document(
                db, user_id, document_id, deep_think=deep_think
            )
            return chunks, ""

        # ------------------------------------------------------------------
        # All Docs mode
        # ------------------------------------------------------------------
        # 1. Build a compact catalogue of documents (optionally filtered by category)
        catalogue = await self._build_catalogue(db, user_id, category_id=category_id)

        # 2. Semantic search — top-5 (KV cache quantization allows larger context)
        results = await self._search.search(db, user_id, question, limit=5, category_id=category_id)
        chunks = []
        _EXCERPT_MAX_CHARS = 600  # Larger excerpts enabled by q8_0 KV cache + 4k context
        for result in results:
            doc = result.document
            if not doc.file_path:
                continue
            embedding = result.embedding
            if embedding and embedding.summary:
                chunks.append({"name": doc.name, "content": embedding.summary[:_EXCERPT_MAX_CHARS]})
            else:
                content = await _get_filesystem().read_document(user_id, doc.file_path)
                if content:
                    chunks.append({"name": doc.name, "content": content[:_EXCERPT_MAX_CHARS]})
        return chunks, catalogue

    async def _build_catalogue(
        self, db: AsyncSession, user_id: int, category_id: int | None = None,
    ) -> str:
        """Build a compact listing of user documents for the LLM catalogue section.

        Cached in-memory with a short TTL so consecutive queries skip the DB
        round-trip AND produce an identical prompt prefix, enabling Ollama's
        automatic KV cache reuse (the 2nd+ query skips prefill for the
        matching prefix).

        If *category_id* is provided, only documents in that category are listed.
        """
        now = time.monotonic()
        cache_key = (user_id, category_id)
        cached = _catalogue_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        # Cap at 10 most-recently-opened docs to keep prompt small.
        _CATALOGUE_LIMIT = 10
        stmt = (
            select(Document)
            .where(Document.user_id == user_id)
            .order_by(Document.last_opened_at.desc().nullslast(), Document.created_at.desc())
            .limit(_CATALOGUE_LIMIT + 1)
        )
        if category_id is not None:
            stmt = stmt.where(Document.category_id == category_id)
        rows = await db.execute(stmt)
        docs = rows.all()
        truncated = len(docs) > _CATALOGUE_LIMIT
        if truncated:
            docs = docs[:_CATALOGUE_LIMIT]

        if not docs:
            return ""

        # Count total docs for context
        from sqlalchemy import func as _func

        count_stmt = select(_func.count()).select_from(Document).where(Document.user_id == user_id)
        if category_id is not None:
            count_stmt = count_stmt.where(Document.category_id == category_id)
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        label = "Category" if category_id is not None else "Library"
        lines = [f"{label}: {total_count} documents (showing {len(docs)} most recent):"]
        for row in docs:
            doc = row[0]
            folder = (doc.folder_path or "/").lstrip("/") or "root"
            lines.append(f"  - {folder}/{doc.name}")
        text = "\n".join(lines)
        _catalogue_cache[cache_key] = (now + _CATALOGUE_TTL, text)
        return text

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
            .order_by(DocumentEmbedding.chunk_index.asc().nullslast())
        )
        row = result.first()
        if not row:
            return []
        doc, embedding = row.Document, row.DocumentEmbedding
        if not doc.file_path:
            return []

        if deep_think:
            # Full document text — let Ollama see everything (capped to bound prefill)
            content = await _get_filesystem().read_document(user_id, doc.file_path)
            if not content:
                return []
            return [{"name": doc.name, "content": content[:_DEEP_THINK_MAX_CHARS]}]

        # Normal mode: use stored summary (fast)
        if embedding and embedding.summary:
            return [{"name": doc.name, "content": embedding.summary}]

        # Fallback: file read with cap (embedding not yet indexed)
        content = await _get_filesystem().read_document(user_id, doc.file_path)
        if not content:
            return []
        return [{"name": doc.name, "content": content[:500]}]

    @staticmethod
    def _history_as_messages(
        history: list | None,
        max_turns: int = 20,
        max_chars: int = 8000,
    ) -> list[dict]:
        """Convert raw history into a list of ``{role, content}`` dicts.

        Walks backwards from the most recent messages so the latest turns
        survive when the budget is exhausted.  Each message content is capped
        at 2000 chars as a safety valve.
        """
        if not history:
            return []
        msgs: list[dict] = []
        budget = max_chars
        for msg in reversed(history[-max_turns:]):
            role = msg.role if hasattr(msg, "role") else msg.get("role", "")
            content = msg.content if hasattr(msg, "content") else msg.get("content", "")
            content = content[:2000]
            if len(content) > budget:
                break
            msgs.append({"role": role, "content": content})
            budget -= len(content)
        if not msgs:
            return []
        msgs.reverse()
        return msgs

    def _build_prompt(
        self,
        question: str,
        context_chunks: list[dict],
        catalogue: str,
        all_docs_mode: bool,
        selection_context: str | None = None,
        strict_context: bool = False,
    ) -> tuple[str, str]:
        """Build the system prompt and user prompt for the LLM.

        Returns ``(system_prompt, user_prompt)``.  Conversation history is
        **not** included here — it is passed separately as structured messages
        to the provider's ``stream()`` method.
        """
        selection_section = (
            f"=== SELECTED TEXT ===\n{selection_context}\n\n"
            if selection_context
            else ""
        )

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
            user_prompt = (
                f"{cat_section}"
                f"{content_section}\n"
                f"{selection_section}"
                f"=== QUESTION ===\n{question}"
            )
            sys = _SYSTEM_PROMPT_ALL_STRICT if strict_context else _SYSTEM_PROMPT_ALL
            return sys, user_prompt

        # Single-document mode
        context_text = "\n\n---\n\n".join(
            f"Document: {chunk['name']}\n\n{chunk['content']}"
            for chunk in context_chunks
        )
        user_prompt = (
            f"=== DOCUMENT CONTEXT ===\n{context_text}\n\n"
            f"{selection_section}"
            f"=== QUESTION ===\n{question}"
        )
        sys = _SYSTEM_PROMPT_SINGLE_STRICT if strict_context else _SYSTEM_PROMPT_SINGLE
        return sys, user_prompt

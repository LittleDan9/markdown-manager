"""Tests for QAService — context building, prompt assembly, streaming, health check."""
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.document import Document
from app.models.document_embedding import DocumentEmbedding
from app.services.search.qa import QAService, _catalogue_cache
from app.services.search.semantic import SearchResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_document(doc_id=1, user_id=1, name="doc.md", file_path="local/doc.md"):
    doc = MagicMock(spec=Document)
    doc.id = doc_id
    doc.user_id = user_id
    doc.name = name
    doc.file_path = file_path
    doc.folder_path = "/"
    doc.category_id = None
    doc.last_opened_at = None
    doc.created_at = None
    return doc


def _make_search_result(doc_id=1, score=0.85, summary="A test summary"):
    doc = _make_document(doc_id=doc_id)
    emb = MagicMock(spec=DocumentEmbedding)
    emb.summary = summary
    return SearchResult(document=doc, score=score, embedding=emb)


def _make_service(search_mock=None, ollama_url="http://test:11434", model="test-model"):
    search = search_mock or AsyncMock()
    return QAService(search_service=search, ollama_url=ollama_url, model=model)


# ---------------------------------------------------------------------------
# History as messages
# ---------------------------------------------------------------------------

class TestHistoryAsMessages:

    def test_none_history(self):
        service = _make_service()
        assert service._history_as_messages(None) == []

    def test_empty_history(self):
        service = _make_service()
        assert service._history_as_messages([]) == []

    def test_formats_dict_messages(self):
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
        ]
        service = _make_service()
        result = service._history_as_messages(history)
        assert len(result) == 2
        assert result[0] == {"role": "user", "content": "Hello"}
        assert result[1] == {"role": "assistant", "content": "Hi there"}

    def test_truncates_long_messages(self):
        history = [{"role": "user", "content": "x" * 3000}]
        service = _make_service()
        result = service._history_as_messages(history, max_chars=8000)
        # Individual message capped at 2000 chars
        assert len(result[0]["content"]) == 2000

    def test_drops_old_turns_over_budget(self):
        history = [
            {"role": "user", "content": "old message " * 200},
            {"role": "assistant", "content": "old response " * 200},
            {"role": "user", "content": "recent question"},
        ]
        service = _make_service()
        result = service._history_as_messages(history, max_chars=200)
        # Most recent should survive; oldest may be dropped
        assert any("recent question" in m["content"] for m in result)


# ---------------------------------------------------------------------------
# Build prompt
# ---------------------------------------------------------------------------

class TestBuildPrompt:

    def test_single_document_mode(self):
        service = _make_service()
        system_prompt, user_prompt = service._build_prompt(
            question="What is this?",
            context_chunks=[{"name": "readme.md", "content": "A readme file."}],
            catalogue="",
            all_docs_mode=False,
        )
        assert "What is this?" in user_prompt
        assert "readme.md" in user_prompt
        assert "DOCUMENT CONTEXT" in user_prompt
        assert "CATALOGUE" not in user_prompt
        assert system_prompt  # system prompt should be non-empty

    def test_all_docs_mode_with_catalogue(self):
        service = _make_service()
        system_prompt, user_prompt = service._build_prompt(
            question="List my docs",
            context_chunks=[{"name": "a.md", "content": "content a"}],
            catalogue="Library: 5 documents\n  - root/a.md",
            all_docs_mode=True,
        )
        assert "DOCUMENT CATALOGUE" in user_prompt
        assert "RELEVANT EXCERPTS" in user_prompt
        assert "List my docs" in user_prompt

    def test_all_docs_no_excerpts(self):
        service = _make_service()
        system_prompt, user_prompt = service._build_prompt(
            question="What do I have?",
            context_chunks=[],
            catalogue="Library: 2 documents",
            all_docs_mode=True,
        )
        assert "No specific excerpts matched" in user_prompt

    def test_history_not_in_prompt(self):
        """History is no longer embedded in the prompt — it's sent as messages."""
        service = _make_service()
        system_prompt, user_prompt = service._build_prompt(
            question="Follow-up",
            context_chunks=[{"name": "d.md", "content": "data"}],
            catalogue="",
            all_docs_mode=False,
        )
        assert "CONVERSATION HISTORY" not in user_prompt


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class TestHealthCheck:

    @patch("app.services.search.qa.httpx.AsyncClient")
    async def test_health_ok(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        service = _make_service()
        assert await service.health_check() is True

    @patch("app.services.search.qa.httpx.AsyncClient")
    async def test_health_unreachable(self, mock_client_cls):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        service = _make_service()
        assert await service.health_check() is False


# ---------------------------------------------------------------------------
# Build context — single document mode
# ---------------------------------------------------------------------------

class TestBuildContextSingleDoc:

    @patch("app.services.search.qa._get_filesystem")
    async def test_uses_summary_when_available(self, mock_fs):
        doc = _make_document()
        emb = MagicMock(spec=DocumentEmbedding)
        emb.summary = "Doc summary here"

        row_mock = MagicMock()
        row_mock.Document = doc
        row_mock.DocumentEmbedding = emb

        result_mock = MagicMock()
        result_mock.first.return_value = row_mock

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        search = AsyncMock()
        service = _make_service(search)
        chunks, catalogue = await service._build_context(db, 1, "what?", document_id=1)

        assert len(chunks) == 1
        assert "Doc summary here" in chunks[0]["content"]
        assert catalogue == ""
        mock_fs.assert_not_called()

    @patch("app.services.search.qa._get_filesystem")
    async def test_deep_think_reads_full_content(self, mock_fs):
        mock_fs.return_value.read_document = AsyncMock(return_value="Full document content here")

        doc = _make_document()
        emb = MagicMock(spec=DocumentEmbedding)
        emb.summary = "Short summary"

        row_mock = MagicMock()
        row_mock.Document = doc
        row_mock.DocumentEmbedding = emb

        result_mock = MagicMock()
        result_mock.first.return_value = row_mock

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        service = _make_service()
        chunks, _ = await service._build_context(db, 1, "details?", document_id=1, deep_think=True)

        assert len(chunks) == 1
        assert "Full document content here" in chunks[0]["content"]

    async def test_missing_document_returns_empty(self):
        result_mock = MagicMock()
        result_mock.first.return_value = None

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        service = _make_service()
        chunks, _ = await service._build_context(db, 1, "anything", document_id=999)

        assert chunks == []


# ---------------------------------------------------------------------------
# Build context — all docs mode
# ---------------------------------------------------------------------------

class TestBuildContextAllDocs:

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        _catalogue_cache.clear()
        yield
        _catalogue_cache.clear()

    async def test_uses_semantic_search_results(self):
        search = AsyncMock()
        search.search = AsyncMock(return_value=[
            _make_search_result(doc_id=1, summary="Summary 1"),
            _make_search_result(doc_id=2, summary="Summary 2"),
        ])

        # Mock catalogue DB query
        doc1 = _make_document(doc_id=1, name="a.md")
        doc2 = _make_document(doc_id=2, name="b.md")

        # We need to handle multiple db.execute calls
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Document listing
                row1 = MagicMock()
                row1.__getitem__ = lambda self, k: doc1
                row2 = MagicMock()
                row2.__getitem__ = lambda self, k: doc2
                result.all.return_value = [row1, row2]
            elif call_count == 2:
                # Count query
                result.scalar.return_value = 2
            return result

        db = AsyncMock()
        db.execute = mock_execute
        db.scalar = AsyncMock(return_value=2)

        service = _make_service(search)
        chunks, catalogue = await service._build_context(db, 1, "tell me about docs", document_id=None)

        assert len(chunks) == 2
        assert chunks[0]["content"].startswith("Summary 1")
        search.search.assert_awaited_once()

    async def test_empty_library(self):
        search = AsyncMock()
        search.search = AsyncMock(return_value=[])

        result_mock = MagicMock()
        result_mock.all.return_value = []

        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 0

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[result_mock, scalar_mock])

        service = _make_service(search)
        chunks, catalogue = await service._build_context(db, 1, "anything", document_id=None)

        assert chunks == []
        assert catalogue == ""


# ---------------------------------------------------------------------------
# Answer stream
# ---------------------------------------------------------------------------

class TestAnswerStream:

    async def test_empty_library_yields_message(self):
        search = AsyncMock()
        search.search = AsyncMock(return_value=[])

        result_mock = MagicMock()
        result_mock.all.return_value = []

        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 0

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[result_mock, scalar_mock])
        db.scalar = AsyncMock(return_value=None)

        service = _make_service(search)
        tokens = []
        async for token in service.answer_stream(db, 1, "hello"):
            tokens.append(token)

        assert any("empty" in str(t).lower() for t in tokens)

    @patch("app.services.search.qa.QAService._stream_ollama")
    async def test_streams_tokens_with_metrics(self, mock_stream):
        """Verify answer_stream yields string tokens and a final metrics dict."""
        async def fake_stream(prompt):
            yield "Hello"
            yield " world"

        mock_stream.side_effect = fake_stream

        search = AsyncMock()
        search.search = AsyncMock(return_value=[_make_search_result()])

        # Mock catalogue queries
        doc = _make_document()
        row = MagicMock()
        row.__getitem__ = lambda self, k: doc

        listing_result = MagicMock()
        listing_result.all.return_value = [row]

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[listing_result, count_result])
        db.scalar = AsyncMock(return_value=None)

        _catalogue_cache.clear()
        service = _make_service(search)

        tokens = []
        async for token in service.answer_stream(db, 1, "what is this?"):
            tokens.append(token)

        # Should have string tokens + final metrics dict
        string_tokens = [t for t in tokens if isinstance(t, str)]
        metrics_tokens = [t for t in tokens if isinstance(t, dict)]

        assert len(string_tokens) >= 2
        assert "Hello" in string_tokens
        assert len(metrics_tokens) == 1
        assert metrics_tokens[0]["__metrics__"] is True
        assert "total_ms" in metrics_tokens[0]
        assert metrics_tokens[0]["tokens"] == 2


# ---------------------------------------------------------------------------
# Catalogue caching
# ---------------------------------------------------------------------------

class TestCatalogueCaching:

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        _catalogue_cache.clear()
        yield
        _catalogue_cache.clear()

    async def test_cache_hit_skips_db(self):
        _catalogue_cache[(1, None)] = (time.monotonic() + 60, "cached catalogue")

        service = _make_service()
        db = AsyncMock()

        result = await service._build_catalogue(db, 1)

        assert result == "cached catalogue"
        db.execute.assert_not_awaited()

    async def test_expired_cache_queries_db(self):
        _catalogue_cache[(1, None)] = (time.monotonic() - 10, "stale")

        doc = _make_document(name="fresh.md")
        row = MagicMock()
        row.__getitem__ = lambda self, k: doc

        listing_result = MagicMock()
        listing_result.all.return_value = [row]

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[listing_result, count_result])

        service = _make_service()
        result = await service._build_catalogue(db, 1)

        assert "fresh.md" in result
        assert result != "stale"

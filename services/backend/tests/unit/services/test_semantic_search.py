"""Tests for SemanticSearchService — indexing, search, deletion, caching."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.document import Document
from app.models.document_embedding import DocumentEmbedding
from app.services.search.semantic import (
    SearchResult,
    SemanticSearchService,
    _to_binary,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_vector(dim: int = 384, positive: bool = True) -> list[float]:
    """Return a deterministic fake embedding vector."""
    sign = 1.0 if positive else -1.0
    return [sign * (i % 10) / 10.0 for i in range(dim)]


def _make_document(doc_id: int = 1, user_id: int = 1, name: str = "doc.md") -> MagicMock:
    doc = MagicMock(spec=Document)
    doc.id = doc_id
    doc.user_id = user_id
    doc.name = name
    doc.file_path = f"local/{name}"
    doc.folder_path = "/"
    doc.category_id = None
    return doc


# ---------------------------------------------------------------------------
# _to_binary helper
# ---------------------------------------------------------------------------

class TestToBinary:

    def test_positive_values(self):
        vec = [1.0, 0.5, 0.0, -0.1, -1.0]
        result = _to_binary(vec)
        assert result == "11100"

    def test_all_positive(self):
        vec = [0.1] * 10
        assert _to_binary(vec) == "1" * 10

    def test_all_negative(self):
        vec = [-0.1] * 10
        assert _to_binary(vec) == "0" * 10

    def test_length_matches_dim(self):
        vec = _fake_vector(384)
        assert len(_to_binary(vec)) == 384

    def test_zero_is_positive(self):
        """Zero should map to '1' (>= 0)."""
        assert _to_binary([0.0]) == "1"


# ---------------------------------------------------------------------------
# SemanticSearchService.index_document
# ---------------------------------------------------------------------------

class TestIndexDocument:

    @pytest.fixture
    def mock_client(self):
        client = AsyncMock()
        client.embed_texts = AsyncMock(return_value=[_fake_vector()])
        return client

    @pytest.fixture
    def service(self, mock_client):
        return SemanticSearchService(mock_client)

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        # Default: no existing embeddings
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=result_mock)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.add = MagicMock()
        return db

    @patch("app.services.search.semantic._get_filesystem")
    async def test_index_new_document(self, mock_fs, service, mock_db, mock_client):
        mock_fs.return_value.read_document = AsyncMock(return_value="# Hello\nSome content.")
        doc = _make_document()

        result = await service.index_document(mock_db, 1, doc)

        assert result is True
        mock_client.embed_texts.assert_awaited_once()
        mock_db.commit.assert_awaited_once()

    @patch("app.services.search.semantic._get_filesystem")
    async def test_skip_if_no_file_path(self, mock_fs, service, mock_db):
        doc = _make_document()
        doc.file_path = None

        result = await service.index_document(mock_db, 1, doc)

        assert result is False
        mock_fs.assert_not_called()

    @patch("app.services.search.semantic._get_filesystem")
    async def test_skip_if_file_not_found(self, mock_fs, service, mock_db):
        mock_fs.return_value.read_document = AsyncMock(return_value=None)
        doc = _make_document()

        result = await service.index_document(mock_db, 1, doc)

        assert result is False

    @patch("app.services.search.semantic._get_filesystem")
    async def test_skip_if_content_hash_unchanged(self, mock_fs, service, mock_db):
        """When content hash hasn't changed, should skip re-embedding."""
        import hashlib
        from app.services.search.content_processor import prepare_document_content

        content = "# Doc\nUnchanged content."
        mock_fs.return_value.read_document = AsyncMock(return_value=content)

        processed = prepare_document_content("doc.md", content)
        expected_hash = hashlib.sha256(processed.text.encode("utf-8")).hexdigest()

        existing = MagicMock()
        existing.content_hash = expected_hash
        existing.chunk_index = 0

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [existing]
        mock_db.execute = AsyncMock(return_value=result_mock)

        doc = _make_document()
        result = await service.index_document(mock_db, 1, doc)

        assert result is False

    @patch("app.services.search.semantic._get_filesystem")
    async def test_returns_false_on_embed_failure(self, mock_fs, service, mock_db, mock_client):
        mock_fs.return_value.read_document = AsyncMock(return_value="Some content")
        mock_client.embed_texts.side_effect = Exception("Embedding service down")

        doc = _make_document()
        result = await service.index_document(mock_db, 1, doc)

        assert result is False


# ---------------------------------------------------------------------------
# SemanticSearchService.delete_embedding
# ---------------------------------------------------------------------------

class TestDeleteEmbedding:

    @pytest.fixture
    def service(self):
        return SemanticSearchService(AsyncMock())

    async def test_delete_existing(self):
        service = SemanticSearchService(AsyncMock())
        row1 = MagicMock()
        row2 = MagicMock()

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [row1, row2]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        await service.delete_embedding(db, document_id=42)

        assert db.delete.await_count == 2
        db.commit.assert_awaited_once()

    async def test_delete_no_rows(self):
        service = SemanticSearchService(AsyncMock())
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        await service.delete_embedding(db, document_id=99)

        db.delete.assert_not_awaited()
        db.commit.assert_not_awaited()


# ---------------------------------------------------------------------------
# SemanticSearchService.search (mocked DB — exercises fallback branch)
# ---------------------------------------------------------------------------

class TestSearch:

    @pytest.fixture
    def mock_client(self):
        client = AsyncMock()
        client.embed_query = AsyncMock(return_value=_fake_vector())
        return client

    @pytest.fixture
    def service(self, mock_client):
        return SemanticSearchService(mock_client)

    async def test_returns_empty_on_embed_failure(self, mock_client):
        mock_client.embed_query.side_effect = Exception("Service down")
        service = SemanticSearchService(mock_client)
        db = AsyncMock()

        results = await service.search(db, user_id=1, query="test")

        assert results == []

    async def test_search_returns_search_results(self, service):
        """Verify search executes and returns SearchResult objects (fallback branch)."""
        doc = _make_document()
        embedding = MagicMock(spec=DocumentEmbedding)
        embedding.summary = "Some summary"

        row = MagicMock()
        row.Document = doc
        row.DocumentEmbedding = embedding
        row.score = 0.85

        result_mock = MagicMock()
        result_mock.all.return_value = [row]

        db = AsyncMock()
        # First execute (binary pre-filter) fails → fallback; second succeeds
        db.execute = AsyncMock(side_effect=[Exception("bit type unsupported"), result_mock])

        results = await service.search(db, user_id=1, query="hello", limit=5)

        assert len(results) == 1
        assert isinstance(results[0], SearchResult)
        assert results[0].score == 0.85
        assert results[0].document.name == "doc.md"

    async def test_search_filters_by_min_score(self, service):
        doc = _make_document()
        row_high = MagicMock()
        row_high.Document = doc
        row_high.DocumentEmbedding = None
        row_high.score = 0.9

        row_low = MagicMock()
        row_low.Document = doc
        row_low.DocumentEmbedding = None
        row_low.score = 0.1

        result_mock = MagicMock()
        result_mock.all.return_value = [row_high, row_low]

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[Exception("fallback"), result_mock])

        results = await service.search(db, user_id=1, query="test", min_score=0.5)

        assert len(results) == 1
        assert results[0].score == 0.9

    async def test_search_respects_limit(self, service):
        rows = []
        for i in range(10):
            row = MagicMock()
            row.Document = _make_document(doc_id=i)
            row.DocumentEmbedding = None
            row.score = 0.9 - i * 0.05
            rows.append(row)

        result_mock = MagicMock()
        result_mock.all.return_value = rows

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[Exception("fallback"), result_mock])

        results = await service.search(db, user_id=1, query="test", limit=3)

        assert len(results) == 3
        # Should be sorted by score descending
        assert results[0].score >= results[1].score >= results[2].score


# ---------------------------------------------------------------------------
# SemanticSearchService.bulk_reindex
# ---------------------------------------------------------------------------

class TestBulkReindex:

    @patch("app.services.search.semantic._get_filesystem")
    async def test_bulk_reindex_counts(self, mock_fs):
        mock_fs.return_value.read_document = AsyncMock(return_value="content")

        client = AsyncMock()
        client.embed_texts = AsyncMock(return_value=[_fake_vector()])
        service = SemanticSearchService(client)

        doc1 = _make_document(doc_id=1, name="a.md")
        doc2 = _make_document(doc_id=2, name="b.md")

        # Simulate: first doc indexes, second doc fails embedding
        call_count = 0

        async def mock_index(db, user_id, doc):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return True
            raise Exception("fail")

        service.index_document = mock_index

        # DB returns 2 documents
        scalars_mock = MagicMock()
        scalars_mock.all.return_value = [doc1, doc2]
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock

        db = AsyncMock()
        db.execute = AsyncMock(return_value=result_mock)

        counts = await service.bulk_reindex(db, user_id=1)

        assert counts["indexed"] == 1
        assert counts["failed"] == 1


# ---------------------------------------------------------------------------
# Redis cache invalidation
# ---------------------------------------------------------------------------

class TestCacheInvalidation:

    async def test_invalidate_calls_redis(self):
        redis = AsyncMock()
        redis.scan_iter = MagicMock(return_value=AsyncIterHelper(["key1", "key2"]))
        service = SemanticSearchService(AsyncMock(), redis_client=redis)

        await service._invalidate_user_cache(user_id=1)

        assert redis.delete.await_count == 2

    async def test_no_redis_no_error(self):
        service = SemanticSearchService(AsyncMock(), redis_client=None)
        # Should not raise
        await service._invalidate_user_cache(user_id=1)


class AsyncIterHelper:
    """Helper to make a list behave as an async iterator for scan_iter."""
    def __init__(self, items):
        self._items = items
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item

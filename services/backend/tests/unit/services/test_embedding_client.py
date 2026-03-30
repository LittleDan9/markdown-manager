"""Tests for EmbeddingClient — HTTP interactions with the embedding service."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.search.embedding_client import EmbeddingClient


class TestEmbedTexts:

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_returns_embeddings(self, mock_client_cls):
        fake_embeddings = [[0.1] * 384, [0.2] * 384]
        mock_response = MagicMock()
        mock_response.json.return_value = {"embeddings": fake_embeddings}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient(base_url="http://test:8005")
        result = await client.embed_texts(["text1", "text2"])

        assert result == fake_embeddings
        mock_client.post.assert_awaited_once()
        call_args = mock_client.post.call_args
        assert call_args[1]["json"] == {"texts": ["text1", "text2"]}

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_raises_on_http_error(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=MagicMock(status_code=500)
        )

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient()
        with pytest.raises(httpx.HTTPStatusError):
            await client.embed_texts(["text"])


class TestEmbedQuery:

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_returns_single_vector(self, mock_client_cls):
        fake_embedding = [0.3] * 384
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": fake_embedding}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient()
        result = await client.embed_query("search query")

        assert result == fake_embedding
        call_args = mock_client.post.call_args
        assert call_args[1]["json"] == {"query": "search query"}


class TestHealthCheck:

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_healthy(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient()
        assert await client.health_check() is True

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_unhealthy_status(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.status_code = 503

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient()
        assert await client.health_check() is False

    @patch("app.services.search.embedding_client.httpx.AsyncClient")
    async def test_connection_error(self, mock_client_cls):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        client = EmbeddingClient()
        assert await client.health_check() is False

"""Tests for the /chat router — ask endpoint and health check."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.user import User
from app.models.document import Document


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(user_id=1):
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = "test@example.com"
    user.is_active = True
    return user


# ---------------------------------------------------------------------------
# POST /chat/ask
# ---------------------------------------------------------------------------

class TestChatAsk:

    @pytest.fixture
    def mock_qa_service(self):
        qa = AsyncMock()

        async def fake_stream(*args, **kwargs):
            yield "Hello"
            yield " world"
            yield {"__metrics__": True, "total_ms": 100, "tokens": 2,
                   "context_ms": 10, "first_token_ms": 50, "generation_ms": 50,
                   "model": "test-model"}

        qa.answer_stream = MagicMock(side_effect=fake_stream)
        return qa

    @patch("app.routers.chat._get_qa_service")
    async def test_ask_streams_sse(self, mock_get_qa, mock_qa_service, client, async_db_session):
        mock_get_qa.return_value = mock_qa_service

        # Create user and override auth
        user = _make_user()

        from app.core.auth import get_current_user
        from app.database import get_db

        app = client._transport.app
        app.dependency_overrides[get_current_user] = lambda: user

        # Override SiteSetting queries to return None
        original_scalar = async_db_session.scalar

        async def mock_scalar(stmt):
            # Return None for SiteSetting queries
            return None

        async_db_session.scalar = mock_scalar

        response = await client.post(
            "/chat/ask",
            json={"question": "What is this?"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        # Parse SSE lines
        lines = response.text.strip().split("\n")
        data_lines = [l for l in lines if l.startswith("data: ")]
        assert len(data_lines) >= 3  # At least: token, token, metrics or DONE

        # First data should be a JSON-encoded string token
        first_data = json.loads(data_lines[0].removeprefix("data: "))
        assert first_data == "Hello"

        # Last line should be [DONE]
        last_data = json.loads(data_lines[-1].removeprefix("data: "))
        assert last_data == "[DONE]"

        # Clean up override
        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.chat._get_qa_service")
    async def test_ask_empty_question_returns_400(self, mock_get_qa, client, async_db_session):
        user = _make_user()
        from app.core.auth import get_current_user

        app = client._transport.app
        app.dependency_overrides[get_current_user] = lambda: user

        response = await client.post(
            "/chat/ask",
            json={"question": "   "},
        )

        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.chat._get_qa_service")
    async def test_ask_deep_think_disabled_without_document_id(self, mock_get_qa, client, async_db_session):
        """deep_think should be silently disabled when document_id is None."""

        async def capturing_stream(*args, **kwargs):
            yield "ok"
            yield {"__metrics__": True, "total_ms": 1, "tokens": 1,
                   "context_ms": 1, "first_token_ms": 1, "generation_ms": 1,
                   "model": "test"}

        qa = AsyncMock()
        qa.answer_stream = MagicMock(side_effect=capturing_stream)
        mock_get_qa.return_value = qa

        user = _make_user()
        from app.core.auth import get_current_user

        app = client._transport.app
        app.dependency_overrides[get_current_user] = lambda: user

        async_db_session.scalar = AsyncMock(return_value=None)

        response = await client.post(
            "/chat/ask",
            json={"question": "test", "deep_think": True, "document_id": None},
        )

        assert response.status_code == 200

        # Verify deep_think was passed as False
        call_kwargs = qa.answer_stream.call_args
        assert call_kwargs.kwargs.get("deep_think") is False or call_kwargs[1].get("deep_think") is False

        app.dependency_overrides.pop(get_current_user, None)

    @patch("app.routers.chat._get_qa_service")
    async def test_ask_with_history(self, mock_get_qa, client, async_db_session):
        async def echo_stream(*args, **kwargs):
            yield "response"
            yield {"__metrics__": True, "total_ms": 1, "tokens": 1,
                   "context_ms": 1, "first_token_ms": 1, "generation_ms": 1,
                   "model": "test"}

        qa = AsyncMock()
        qa.answer_stream = MagicMock(side_effect=echo_stream)
        mock_get_qa.return_value = qa

        user = _make_user()
        from app.core.auth import get_current_user

        app = client._transport.app
        app.dependency_overrides[get_current_user] = lambda: user
        async_db_session.scalar = AsyncMock(return_value=None)

        response = await client.post(
            "/chat/ask",
            json={
                "question": "Follow up",
                "history": [
                    {"role": "user", "content": "First question"},
                    {"role": "assistant", "content": "First answer"},
                ],
            },
        )

        assert response.status_code == 200

        call_kwargs = qa.answer_stream.call_args
        history_arg = call_kwargs.kwargs.get("history") or call_kwargs[1].get("history")
        assert len(history_arg) == 2

        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# GET /chat/health
# ---------------------------------------------------------------------------

class TestChatHealth:

    @patch("app.routers.chat.EmbeddingClient")
    @patch("app.routers.chat._get_qa_service")
    async def test_health_all_ok(self, mock_get_qa, mock_embed_cls, client):
        mock_embed = AsyncMock()
        mock_embed.health_check = AsyncMock(return_value=True)
        mock_embed_cls.return_value = mock_embed

        mock_qa = AsyncMock()
        mock_qa.health_check = AsyncMock(return_value=True)
        mock_get_qa.return_value = mock_qa

        response = await client.get("/chat/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["embedding_service"] == "ok"
        assert data["ollama"] == "ok"

    @patch("app.routers.chat.EmbeddingClient")
    @patch("app.routers.chat._get_qa_service")
    async def test_health_degraded(self, mock_get_qa, mock_embed_cls, client):
        mock_embed = AsyncMock()
        mock_embed.health_check = AsyncMock(return_value=True)
        mock_embed_cls.return_value = mock_embed

        mock_qa = AsyncMock()
        mock_qa.health_check = AsyncMock(return_value=False)
        mock_get_qa.return_value = mock_qa

        response = await client.get("/chat/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["ollama"] == "unavailable"

    @patch("app.routers.chat.EmbeddingClient")
    @patch("app.routers.chat._get_qa_service")
    async def test_health_both_down(self, mock_get_qa, mock_embed_cls, client):
        mock_embed = AsyncMock()
        mock_embed.health_check = AsyncMock(return_value=False)
        mock_embed_cls.return_value = mock_embed

        mock_qa = AsyncMock()
        mock_qa.health_check = AsyncMock(return_value=False)
        mock_get_qa.return_value = mock_qa

        response = await client.get("/chat/health")

        data = response.json()
        assert data["status"] == "degraded"
        assert data["embedding_service"] == "unavailable"
        assert data["ollama"] == "unavailable"

"""Tests for outbox service."""
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.outbox_service import OutboxEvent, OutboxService


class TestOutboxEvent:
    """Tests for the OutboxEvent Pydantic model."""

    def test_create_event(self):
        event = OutboxEvent(
            event_id="abc-123",
            event_type="UserCreated",
            aggregate_type="user",
            aggregate_id="user-1",
            payload={"email": "test@example.com"},
        )
        assert event.event_id == "abc-123"
        assert event.event_type == "UserCreated"
        assert event.tenant_id == "00000000-0000-0000-0000-000000000000"

    def test_create_event_with_tenant(self):
        event = OutboxEvent(
            event_id="abc-123",
            event_type="UserCreated",
            aggregate_type="user",
            aggregate_id="user-1",
            payload={},
            tenant_id="tenant-1",
            correlation_id="corr-1",
        )
        assert event.tenant_id == "tenant-1"
        assert event.correlation_id == "corr-1"


class TestOutboxServiceAddEvent:
    """Tests for adding events to the outbox."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return OutboxService(mock_db)

    async def test_add_event_returns_event_id(self, service, mock_db):
        event_id = await service.add_event(
            event_type="UserCreated",
            aggregate_id="user-1",
            payload={"email": "test@example.com"},
        )
        assert event_id  # non-empty string
        mock_db.execute.assert_awaited_once()

    async def test_add_event_inserts_correct_params(self, service, mock_db):
        await service.add_event(
            event_type="UserUpdated",
            aggregate_id="user-2",
            payload={"name": "Test"},
            aggregate_type="user",
        )

        call_args = mock_db.execute.call_args
        params = call_args[0][1]  # positional arg [1] is the params dict
        assert params["event_type"] == "UserUpdated"
        assert params["aggregate_id"] == "user-2"
        assert params["aggregate_type"] == "user"
        assert params["published"] is False
        assert params["attempts"] == 0
        payload = json.loads(params["payload"])
        assert payload["name"] == "Test"


class TestOutboxServiceUserEvents:
    """Tests for user-specific event convenience methods."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return OutboxService(mock_db)

    async def test_add_user_created_event(self, service, mock_db):
        event_id = await service.add_user_created_event(
            user_id="user-1",
            email="test@example.com",
            display_name="Test User",
        )
        assert event_id
        call_args = mock_db.execute.call_args[0][1]
        assert call_args["event_type"] == "UserCreated"
        payload = json.loads(call_args["payload"])
        assert payload["email"] == "test@example.com"
        assert payload["display_name"] == "Test User"
        assert payload["status"] == "active"

    async def test_add_user_updated_event(self, service, mock_db):
        event_id = await service.add_user_updated_event(
            user_id="user-1",
            email="test@example.com",
            changed_fields=["email", "display_name"],
        )
        assert event_id
        call_args = mock_db.execute.call_args[0][1]
        assert call_args["event_type"] == "UserUpdated"
        payload = json.loads(call_args["payload"])
        assert payload["changed_fields"] == ["email", "display_name"]

    async def test_add_user_updated_event_default_changed_fields(self, service, mock_db):
        await service.add_user_updated_event(
            user_id="user-1",
            email="test@example.com",
        )
        payload = json.loads(mock_db.execute.call_args[0][1]["payload"])
        assert payload["changed_fields"] == []

    async def test_add_user_disabled_event(self, service, mock_db):
        event_id = await service.add_user_disabled_event(
            user_id="user-1",
            email="test@example.com",
            disabled_by="admin-1",
            reason="policy_violation",
        )
        assert event_id
        call_args = mock_db.execute.call_args[0][1]
        assert call_args["event_type"] == "UserDisabled"
        payload = json.loads(call_args["payload"])
        assert payload["disabled_by"] == "admin-1"
        assert payload["reason"] == "policy_violation"


class TestOutboxServicePublish:
    """Tests for event publishing lifecycle."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return OutboxService(mock_db)

    async def test_mark_event_published_success(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await service.mark_event_published("event-1")
        assert result is True

    async def test_mark_event_published_not_found(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await service.mark_event_published("nonexistent")
        assert result is False

    async def test_mark_event_failed(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await service.mark_event_failed(
            event_id="event-1",
            error_message="Connection refused",
            retry_after_seconds=120,
        )
        assert result is True

    async def test_mark_event_failed_not_found(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await service.mark_event_failed(
            event_id="nonexistent",
            error_message="Error",
        )
        assert result is False


class TestDatabaseWithOutbox:
    """Tests for the DatabaseWithOutbox wrapper."""

    def test_wraps_session(self):
        from app.services.database_outbox import DatabaseWithOutbox

        mock_session = AsyncMock()
        wrapper = DatabaseWithOutbox(mock_session)
        assert wrapper.session is mock_session
        assert isinstance(wrapper.outbox, OutboxService)

    async def test_commit_delegates(self):
        from app.services.database_outbox import DatabaseWithOutbox

        mock_session = AsyncMock()
        wrapper = DatabaseWithOutbox(mock_session)
        await wrapper.commit()
        mock_session.commit.assert_awaited_once()

    async def test_rollback_delegates(self):
        from app.services.database_outbox import DatabaseWithOutbox

        mock_session = AsyncMock()
        wrapper = DatabaseWithOutbox(mock_session)
        await wrapper.rollback()
        mock_session.rollback.assert_awaited_once()

    async def test_close_delegates(self):
        from app.services.database_outbox import DatabaseWithOutbox

        mock_session = AsyncMock()
        wrapper = DatabaseWithOutbox(mock_session)
        await wrapper.close()
        mock_session.close.assert_awaited_once()

    def test_getattr_delegates(self):
        from app.services.database_outbox import DatabaseWithOutbox

        mock_session = MagicMock()
        mock_session.some_attr = "test_value"
        wrapper = DatabaseWithOutbox(mock_session)
        assert wrapper.some_attr == "test_value"

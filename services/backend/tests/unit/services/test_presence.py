"""Tests for WebSocket presence manager."""
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.presence import PresenceManager, UserPresence, STALE_THRESHOLD


class TestUserPresence:
    """Tests for the UserPresence dataclass."""

    def test_default_values(self):
        p = UserPresence(user_id=1, display_name="Alice")
        assert p.user_id == 1
        assert p.display_name == "Alice"
        assert p.document_id is None
        assert p.last_heartbeat > 0

    def test_custom_values(self):
        p = UserPresence(user_id=1, display_name="Alice", document_id=42)
        assert p.document_id == 42


class TestPresenceManagerConnect:
    """Tests for connection handling."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_connect_accepts_websocket(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")

        ws.accept.assert_awaited_once()
        assert 1 in manager._connections
        assert 1 in manager._users
        assert manager._users[1].display_name == "Alice"

    async def test_connect_replaces_existing(self, manager):
        old_ws = AsyncMock()
        await manager.connect(old_ws, user_id=1, display_name="Alice")

        new_ws = AsyncMock()
        await manager.connect(new_ws, user_id=1, display_name="Alice")

        assert manager._connections[1] is new_ws
        old_ws.close.assert_awaited_once()


class TestPresenceManagerDisconnect:
    """Tests for disconnection handling."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_disconnect_removes_user(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.disconnect(user_id=1)

        assert 1 not in manager._connections
        assert 1 not in manager._users

    async def test_disconnect_cleans_up_document(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.set_document(user_id=1, document_id=42)
        assert 1 in manager._document_users.get(42, set())

        await manager.disconnect(user_id=1)
        assert 42 not in manager._document_users  # cleaned up

    async def test_disconnect_unknown_user(self, manager):
        # Should not raise
        await manager.disconnect(user_id=999)


class TestPresenceManagerSetDocument:
    """Tests for document presence tracking."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_set_document(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.set_document(user_id=1, document_id=42)

        assert manager._users[1].document_id == 42
        assert 1 in manager._document_users[42]

    async def test_switch_document(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.set_document(user_id=1, document_id=42)
        await manager.set_document(user_id=1, document_id=99)

        assert manager._users[1].document_id == 99
        assert 42 not in manager._document_users  # removed
        assert 1 in manager._document_users[99]

    async def test_set_document_to_none(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.set_document(user_id=1, document_id=42)
        await manager.set_document(user_id=1, document_id=None)

        assert manager._users[1].document_id is None
        assert 42 not in manager._document_users

    async def test_set_same_document_is_noop(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        await manager.set_document(user_id=1, document_id=42)

        # Reset send_text mock to check no broadcast on same-doc set
        ws.send_text.reset_mock()
        await manager.set_document(user_id=1, document_id=42)
        # Should not broadcast since nothing changed

    async def test_set_document_unknown_user(self, manager):
        # Should not raise
        await manager.set_document(user_id=999, document_id=42)


class TestPresenceManagerHeartbeat:
    """Tests for heartbeat tracking."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_heartbeat_updates_timestamp(self, manager):
        ws = AsyncMock()
        await manager.connect(ws, user_id=1, display_name="Alice")
        old_hb = manager._users[1].last_heartbeat

        # Small sleep to ensure time difference
        manager._users[1].last_heartbeat = old_hb - 10
        manager.heartbeat(user_id=1)

        assert manager._users[1].last_heartbeat > old_hb - 10

    def test_heartbeat_unknown_user(self, manager):
        manager = PresenceManager()
        manager.heartbeat(user_id=999)  # should not raise


class TestPresenceManagerGetDocumentUsers:
    """Tests for document user listing."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_get_users_on_document(self, manager):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await manager.connect(ws1, user_id=1, display_name="Alice")
        await manager.connect(ws2, user_id=2, display_name="Bob")
        await manager.set_document(user_id=1, document_id=42)
        await manager.set_document(user_id=2, document_id=42)

        users = manager.get_document_users(42)
        assert len(users) == 2
        names = {u["display_name"] for u in users}
        assert names == {"Alice", "Bob"}

    def test_get_users_empty_document(self, manager):
        manager = PresenceManager()
        users = manager.get_document_users(99)
        assert users == []


class TestPresenceManagerBroadcast:
    """Tests for presence broadcast."""

    @pytest.fixture
    def manager(self):
        return PresenceManager()

    async def test_broadcasts_presence_to_document_users(self, manager):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await manager.connect(ws1, user_id=1, display_name="Alice")
        await manager.connect(ws2, user_id=2, display_name="Bob")
        await manager.set_document(user_id=1, document_id=42)

        # Reset mocks after setup broadcasts
        ws1.send_text.reset_mock()
        ws2.send_text.reset_mock()

        # Bob joins the document → broadcast to Alice (already there)
        await manager.set_document(user_id=2, document_id=42)

        # Both should receive presence update
        assert ws1.send_text.await_count >= 1
        assert ws2.send_text.await_count >= 1

        # Verify message format
        msg = json.loads(ws1.send_text.call_args[0][0])
        assert msg["type"] == "presence"
        assert msg["document_id"] == 42
        assert len(msg["users"]) == 2


class TestPresenceManagerStartStop:
    """Tests for background task management."""

    def test_stop_cancels_task(self):
        manager = PresenceManager()
        mock_task = MagicMock()
        manager._cleanup_task = mock_task

        manager.stop()

        mock_task.cancel.assert_called_once()
        assert manager._cleanup_task is None

    def test_stop_no_task(self):
        manager = PresenceManager()
        manager.stop()  # should not raise

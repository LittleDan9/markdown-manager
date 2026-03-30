"""Tests for collaborative editing session manager."""
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pycrdt import Doc, Text

from app.services.collab import CollabClient, CollabManager, CollabSession


class TestCollabSession:
    """Tests for the CollabSession dataclass."""

    def test_default_session(self):
        session = CollabSession(document_id=1)
        assert session.document_id == 1
        assert isinstance(session.ydoc, Doc)
        assert session.clients == {}
        assert session.dirty is False

    def test_ytext_property(self):
        session = CollabSession(document_id=1)
        text = session.ytext
        assert isinstance(text, Text)

    def test_ytext_same_underlying_type(self):
        session = CollabSession(document_id=1)
        with session.ydoc.transaction():
            session.ytext.__iadd__("hello")
        # Subsequent access returns same content
        assert str(session.ytext) == "hello"


class TestCollabClient:
    """Tests for the CollabClient dataclass."""

    def test_create_client(self):
        ws = MagicMock()
        client = CollabClient(websocket=ws, user_id=1, display_name="Alice")
        assert client.user_id == 1
        assert client.display_name == "Alice"
        assert client.websocket is ws


class TestCollabManagerJoinLeave:
    """Tests for join/leave lifecycle."""

    @pytest.fixture
    def manager(self):
        return CollabManager()

    @patch.object(CollabManager, "_create_session")
    async def test_join_creates_session(self, mock_create, manager):
        session = CollabSession(document_id=1)
        mock_create.return_value = session
        ws = AsyncMock()

        result = await manager.join(document_id=1, websocket=ws, user_id=10, display_name="Alice")

        assert result is session
        assert 10 in session.clients
        assert session.clients[10].display_name == "Alice"
        mock_create.assert_awaited_once_with(1)

    @patch.object(CollabManager, "_create_session")
    async def test_join_reuses_existing_session(self, mock_create, manager):
        session = CollabSession(document_id=1)
        manager._sessions[1] = session
        ws = AsyncMock()

        result = await manager.join(document_id=1, websocket=ws, user_id=10, display_name="Alice")

        assert result is session
        mock_create.assert_not_awaited()

    @patch.object(CollabManager, "_create_session")
    async def test_join_replaces_existing_connection(self, mock_create, manager):
        session = CollabSession(document_id=1)
        old_ws = AsyncMock()
        session.clients[10] = CollabClient(websocket=old_ws, user_id=10, display_name="Alice")
        manager._sessions[1] = session

        new_ws = AsyncMock()
        await manager.join(document_id=1, websocket=new_ws, user_id=10, display_name="Alice")

        old_ws.close.assert_awaited_once()
        assert session.clients[10].websocket is new_ws

    @patch.object(CollabManager, "_persist_session")
    @patch.object(CollabManager, "_write_content_back")
    async def test_leave_removes_client(self, mock_write, mock_persist, manager):
        session = CollabSession(document_id=1)
        ws = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws, user_id=10, display_name="Alice")
        session.clients[20] = CollabClient(websocket=AsyncMock(), user_id=20, display_name="Bob")
        manager._sessions[1] = session

        await manager.leave(document_id=1, user_id=10)

        assert 10 not in session.clients
        assert 20 in session.clients
        mock_persist.assert_not_awaited()  # not last client

    @patch.object(CollabManager, "_persist_session")
    @patch.object(CollabManager, "_write_content_back")
    async def test_leave_last_client_persists(self, mock_write, mock_persist, manager):
        session = CollabSession(document_id=1)
        ws = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws, user_id=10, display_name="Alice")
        manager._sessions[1] = session

        await manager.leave(document_id=1, user_id=10)

        assert 10 not in session.clients
        mock_persist.assert_awaited_once_with(session)
        mock_write.assert_awaited_once_with(session)

    async def test_leave_nonexistent_session(self, manager):
        # Should not raise
        await manager.leave(document_id=999, user_id=10)


class TestCollabManagerSync:
    """Tests for sync/awareness message handling."""

    @pytest.fixture
    def manager(self):
        return CollabManager()

    async def test_handle_sync_message_updates_doc(self, manager):
        session = CollabSession(document_id=1)
        ws = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws, user_id=10, display_name="Alice")

        # Create a valid update from another doc
        other_doc = Doc()
        other_text = other_doc.get("content", type=Text)
        with other_doc.transaction():
            other_text += "Hello"
        empty = Doc()
        update = other_doc.get_update(empty.get_state())

        await manager.handle_sync_message(session, sender_id=10, data=update)

        assert session.dirty is True
        assert str(session.ytext) == "Hello"

    async def test_handle_sync_message_broadcasts(self, manager):
        session = CollabSession(document_id=1)
        ws_sender = AsyncMock()
        ws_receiver = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws_sender, user_id=10, display_name="Alice")
        session.clients[20] = CollabClient(websocket=ws_receiver, user_id=20, display_name="Bob")

        other_doc = Doc()
        other_text = other_doc.get("content", type=Text)
        with other_doc.transaction():
            other_text += "Hi"
        empty = Doc()
        update = other_doc.get_update(empty.get_state())

        await manager.handle_sync_message(session, sender_id=10, data=update)

        ws_receiver.send_bytes.assert_awaited_once_with(update)
        ws_sender.send_bytes.assert_not_awaited()  # excluded

    async def test_handle_awareness_broadcasts(self, manager):
        session = CollabSession(document_id=1)
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws1, user_id=10, display_name="Alice")
        session.clients[20] = CollabClient(websocket=ws2, user_id=20, display_name="Bob")

        data = b"awareness_data"
        await manager.handle_awareness_message(session, sender_id=10, data=data)

        ws2.send_bytes.assert_awaited_once_with(data)
        ws1.send_bytes.assert_not_awaited()


class TestCollabManagerInitialState:
    """Tests for getting initial document state."""

    def test_get_initial_state_empty_doc(self):
        manager = CollabManager()
        session = CollabSession(document_id=1)
        # Should return bytes (even for empty doc)
        loop = asyncio.new_event_loop()
        try:
            state = loop.run_until_complete(manager.get_initial_state(session))
            assert isinstance(state, bytes)
        finally:
            loop.close()

    def test_get_initial_state_with_content(self):
        manager = CollabManager()
        session = CollabSession(document_id=1)
        with session.ydoc.transaction():
            session.ytext.__iadd__("Hello World")

        loop = asyncio.new_event_loop()
        try:
            state = loop.run_until_complete(manager.get_initial_state(session))
            assert isinstance(state, bytes)
            assert len(state) > 0
        finally:
            loop.close()


class TestCollabManagerBroadcast:
    """Tests for the internal broadcast helper."""

    @pytest.fixture
    def manager(self):
        return CollabManager()

    async def test_broadcast_excludes_sender(self, manager):
        session = CollabSession(document_id=1)
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        ws3 = AsyncMock()
        session.clients[10] = CollabClient(websocket=ws1, user_id=10, display_name="A")
        session.clients[20] = CollabClient(websocket=ws2, user_id=20, display_name="B")
        session.clients[30] = CollabClient(websocket=ws3, user_id=30, display_name="C")

        await manager._broadcast(session, b"data", exclude_user=10)

        ws1.send_bytes.assert_not_awaited()
        ws2.send_bytes.assert_awaited_once_with(b"data")
        ws3.send_bytes.assert_awaited_once_with(b"data")

    async def test_broadcast_removes_disconnected_clients(self, manager):
        session = CollabSession(document_id=1)
        ws_good = AsyncMock()
        ws_bad = AsyncMock()
        ws_bad.send_bytes.side_effect = Exception("Disconnected")
        session.clients[10] = CollabClient(websocket=ws_good, user_id=10, display_name="A")
        session.clients[20] = CollabClient(websocket=ws_bad, user_id=20, display_name="B")

        await manager._broadcast(session, b"data", exclude_user=None)

        assert 20 not in session.clients  # removed on error
        assert 10 in session.clients


class TestCollabManagerStartStop:
    """Tests for background task management."""

    def test_stop_cancels_task(self):
        manager = CollabManager()
        mock_task = MagicMock()
        manager._persist_task = mock_task

        manager.stop()

        mock_task.cancel.assert_called_once()
        assert manager._persist_task is None

    def test_stop_no_task(self):
        manager = CollabManager()
        manager.stop()  # should not raise

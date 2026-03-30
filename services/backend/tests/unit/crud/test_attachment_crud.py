"""Tests for attachment CRUD operations."""
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

import pytest

from app.crud.attachment import AttachmentCRUD


class TestAttachmentCRUD:
    """Unit tests for AttachmentCRUD with mocked database."""

    @pytest.fixture
    def crud(self):
        return AttachmentCRUD()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def sample_attachment(self):
        attachment = MagicMock()
        attachment.id = 1
        attachment.user_id = 10
        attachment.document_id = 20
        attachment.original_filename = "test.pdf"
        attachment.stored_filename = "abc123.pdf"
        attachment.mime_type = "application/pdf"
        attachment.file_size_bytes = 1024
        attachment.content_hash = "sha256_abc"
        attachment.scan_status = "clean"
        attachment.scan_result = None
        attachment.created_at = datetime.utcnow()
        return attachment

    async def test_create_attachment(self, crud, mock_db):
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()

        result = await crud.create(
            mock_db,
            user_id=10,
            document_id=20,
            original_filename="test.pdf",
            stored_filename="abc123.pdf",
            mime_type="application/pdf",
            file_size_bytes=1024,
            content_hash="sha256_abc",
        )

        mock_db.add.assert_called_once()
        mock_db.commit.assert_awaited_once()
        mock_db.refresh.assert_awaited_once()
        assert result.original_filename == "test.pdf"
        assert result.scan_status == "pending"  # default

    async def test_create_attachment_with_scan_status(self, crud, mock_db):
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()

        result = await crud.create(
            mock_db,
            user_id=10,
            document_id=20,
            original_filename="test.pdf",
            stored_filename="abc123.pdf",
            mime_type="application/pdf",
            file_size_bytes=1024,
            content_hash="sha256_abc",
            scan_status="clean",
            scan_result="No threats found",
        )

        assert result.scan_status == "clean"
        assert result.scan_result == "No threats found"

    async def test_get_with_ownership(self, crud, mock_db, sample_attachment):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_attachment
        mock_db.execute.return_value = mock_result

        result = await crud.get(mock_db, attachment_id=1, user_id=10)
        assert result == sample_attachment
        mock_db.execute.assert_awaited_once()

    async def test_get_not_found(self, crud, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await crud.get(mock_db, attachment_id=999, user_id=10)
        assert result is None

    async def test_get_by_id_no_ownership_check(self, crud, mock_db, sample_attachment):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_attachment
        mock_db.execute.return_value = mock_result

        result = await crud.get_by_id(mock_db, attachment_id=1)
        assert result == sample_attachment

    async def test_get_by_document(self, crud, mock_db, sample_attachment):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [sample_attachment]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        result = await crud.get_by_document(mock_db, document_id=20, user_id=10)
        assert len(result) == 1
        assert result[0] == sample_attachment

    async def test_get_by_document_empty(self, crud, mock_db):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result

        result = await crud.get_by_document(mock_db, document_id=20, user_id=10)
        assert result == []

    async def test_get_by_user_with_pagination(self, crud, mock_db, sample_attachment):
        # Count query
        mock_count_result = MagicMock()
        mock_count_result.scalar_one.return_value = 5

        # Data query
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [sample_attachment]
        mock_data_result = MagicMock()
        mock_data_result.scalars.return_value = mock_scalars

        mock_db.execute.side_effect = [mock_count_result, mock_data_result]

        items, total = await crud.get_by_user(mock_db, user_id=10, offset=0, limit=50)
        assert total == 5
        assert len(items) == 1

    async def test_delete_existing(self, crud, mock_db, sample_attachment):
        # Mock get() call
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_attachment
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        result = await crud.delete(mock_db, attachment_id=1, user_id=10)
        assert result == sample_attachment
        mock_db.delete.assert_awaited_once_with(sample_attachment)
        mock_db.commit.assert_awaited_once()

    async def test_delete_not_found(self, crud, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await crud.delete(mock_db, attachment_id=999, user_id=10)
        assert result is None

    async def test_get_user_total_size(self, crud, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 5_000_000
        mock_db.execute.return_value = mock_result

        total = await crud.get_user_total_size(mock_db, user_id=10)
        assert total == 5_000_000

    async def test_get_user_attachment_count(self, crud, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 12
        mock_db.execute.return_value = mock_result

        count = await crud.get_user_attachment_count(mock_db, user_id=10)
        assert count == 12

    async def test_delete_by_document(self, crud, mock_db, sample_attachment):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [sample_attachment]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.side_effect = [mock_result, MagicMock()]  # select, then delete
        mock_db.commit = AsyncMock()

        result = await crud.delete_by_document(mock_db, document_id=20)
        assert len(result) == 1
        assert mock_db.commit.await_count == 1

    async def test_delete_by_document_no_attachments(self, crud, mock_db):
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        result = await crud.delete_by_document(mock_db, document_id=20)
        assert result == []
        mock_db.commit.assert_not_awaited()

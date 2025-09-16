"""
Unit tests for the UserDocument service.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch

from app.services.storage.user.document import UserDocument


class TestUserDocument:
    """Test cases for UserDocument service."""

    @pytest.fixture
    def temp_storage(self):
        """Create a temporary directory for testing."""
        temp_dir = Path(tempfile.mkdtemp())

        # Set environment variable so service uses our temp directory
        original_root = os.environ.get('MARKDOWN_STORAGE_ROOT')
        os.environ['MARKDOWN_STORAGE_ROOT'] = str(temp_dir)

        yield temp_dir

        # Restore original environment
        if original_root is not None:
            os.environ['MARKDOWN_STORAGE_ROOT'] = original_root
        else:
            os.environ.pop('MARKDOWN_STORAGE_ROOT', None)

        shutil.rmtree(temp_dir)

    @pytest.fixture
    def user_document(self, temp_storage):
        """Create a UserDocument instance with temporary storage."""
        service = UserDocument()
        yield service

    @pytest.mark.asyncio
    async def test_read_document_success(self, user_document, temp_storage):
        """Test successful document reading."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document\n\nContent here."

        # Create the file
        full_path = temp_storage / str(user_id) / file_path
        full_path.parent.mkdir(parents=True)
        full_path.write_text(content)

        with patch.object(user_document.filesystem, 'read_document') as mock_read:
            mock_read.return_value = content

            result = await user_document.read_document(user_id, file_path)

            assert result == content
            mock_read.assert_called_once_with(user_id, file_path)

    @pytest.mark.asyncio
    async def test_read_document_not_found(self, user_document):
        """Test reading non-existent document."""
        user_id = 123
        file_path = "local/work/nonexistent.md"

        with patch.object(user_document.filesystem, 'read_document') as mock_read:
            mock_read.return_value = None

            result = await user_document.read_document(user_id, file_path)

            assert result is None

    @pytest.mark.asyncio
    async def test_write_document_success(self, user_document):
        """Test successful document writing."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document\n\nNew content."

        with patch.object(user_document.filesystem, 'write_document') as mock_write:
            mock_write.return_value = True

            result = await user_document.write_document(user_id, file_path, content)

            assert result is True
            mock_write.assert_called_once_with(user_id, file_path, content)

    @pytest.mark.asyncio
    async def test_write_document_failure(self, user_document):
        """Test document writing failure."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document"

        with patch.object(user_document.filesystem, 'write_document') as mock_write:
            mock_write.return_value = False

            result = await user_document.write_document(user_id, file_path, content)

            assert result is False

    @pytest.mark.asyncio
    async def test_move_document_success(self, user_document):
        """Test successful document moving."""
        user_id = 123
        old_path = "local/work/test.md"
        new_path = "local/personal/test.md"

        with patch.object(user_document.filesystem, 'move_document') as mock_move:
            mock_move.return_value = True

            result = await user_document.move_document(user_id, old_path, new_path)

            assert result is True
            mock_move.assert_called_once_with(user_id, old_path, new_path)

    @pytest.mark.asyncio
    async def test_move_document_failure(self, user_document):
        """Test document moving failure."""
        user_id = 123
        old_path = "local/work/test.md"
        new_path = "local/personal/test.md"

        with patch.object(user_document.filesystem, 'move_document') as mock_move:
            mock_move.return_value = False

            result = await user_document.move_document(user_id, old_path, new_path)

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_document_success(self, user_document):
        """Test successful document deletion."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_document.filesystem, 'delete_document') as mock_delete:
            mock_delete.return_value = True

            result = await user_document.delete_document(user_id, file_path)

            assert result is True
            mock_delete.assert_called_once_with(user_id, file_path)

    @pytest.mark.asyncio
    async def test_delete_document_failure(self, user_document):
        """Test document deletion failure."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_document.filesystem, 'delete_document') as mock_delete:
            mock_delete.return_value = False

            result = await user_document.delete_document(user_id, file_path)

            assert result is False

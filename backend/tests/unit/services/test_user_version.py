"""
Unit tests for the UserVersion service.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch
from datetime import datetime

from app.services.storage.user.version import UserVersion
from app.services.storage.git import GitCommit


class TestUserVersion:
    """Test cases for UserVersion service."""

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
    def user_version(self, temp_storage):
        """Create a UserVersion instance with temporary storage."""
        service = UserVersion()
        yield service

    @pytest.mark.asyncio
    async def test_commit_file_change_success(self, user_version, temp_storage):
        """Test successful file change commit."""
        user_id = 123
        file_path = "local/work/test.md"
        commit_message = "Update test file"

        # Create mock repository structure
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        # Create the test file
        test_file = work_dir / "test.md"
        test_file.write_text("# Test Content")

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_version.git, 'commit') as mock_commit:

            mock_get_repo.return_value = work_dir
            mock_user_dir.return_value = user_dir
            mock_commit.return_value = True

            result = await user_version.commit_file_change(user_id, file_path, commit_message)

            assert result is True
            mock_commit.assert_called_once_with(work_dir, commit_message, ["test.md"])

    @pytest.mark.asyncio
    async def test_commit_file_change_auto_message(self, user_version, temp_storage):
        """Test file commit with auto-generated message."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create mock repository structure
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        # Create the test file
        test_file = work_dir / "test.md"
        test_file.write_text("# Test Content")

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_version.git, 'commit') as mock_commit:

            mock_get_repo.return_value = work_dir
            mock_user_dir.return_value = user_dir
            mock_commit.return_value = True

            result = await user_version.commit_file_change(user_id, file_path, None)

            assert result is True
            # Should auto-generate commit message
            expected_message = "Update test.md"
            mock_commit.assert_called_once_with(work_dir, expected_message, ["test.md"])

    @pytest.mark.asyncio
    async def test_commit_file_change_no_repo(self, user_version):
        """Test commit when no repository is found."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo:
            mock_get_repo.return_value = None

            result = await user_version.commit_file_change(user_id, file_path, "Test commit")

            assert result is True  # Not an error if no git repo

    @pytest.mark.asyncio
    async def test_commit_file_change_missing_file(self, user_version, temp_storage):
        """Test commit when file doesn't exist."""
        user_id = 123
        file_path = "local/work/nonexistent.md"

        # Create mock repository structure
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir:

            mock_get_repo.return_value = work_dir
            mock_user_dir.return_value = user_dir

            result = await user_version.commit_file_change(user_id, file_path, "Test commit")

            assert result is False

    @pytest.mark.asyncio
    async def test_commit_file_change_missing_file_allowed(self, user_version, temp_storage):
        """Test commit when file doesn't exist but missing is allowed."""
        user_id = 123
        file_path = "local/work/deleted.md"

        # Create mock repository structure
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_version.git, 'commit') as mock_commit:

            mock_get_repo.return_value = work_dir
            mock_user_dir.return_value = user_dir
            mock_commit.return_value = True

            result = await user_version.commit_file_change(
                user_id, file_path, "Delete file", allow_missing=True
            )

            assert result is True
            mock_commit.assert_called_once_with(work_dir, "Delete file", ["deleted.md"])

    @pytest.mark.asyncio
    async def test_get_document_history_success(self, user_version, temp_storage):
        """Test getting document history."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create a mock git commit
        mock_commit = GitCommit(
            hash="abc123",
            message="Test commit",
            author="Test Author",
            date=datetime.now(),
            files=["test.md"]
        )

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_version.git, 'file_history') as mock_history:

            mock_repo_path = temp_storage / str(user_id) / "local" / "work"
            mock_user_dir_path = temp_storage / str(user_id)
            mock_get_repo.return_value = mock_repo_path
            mock_user_dir.return_value = mock_user_dir_path
            mock_history.return_value = [mock_commit]

            result = await user_version.get_document_history(user_id, file_path, limit=10)

            assert len(result) == 1
            assert result[0] == mock_commit
            mock_history.assert_called_once_with(mock_repo_path, "test.md", 10)

    @pytest.mark.asyncio
    async def test_get_document_history_no_repo(self, user_version):
        """Test getting document history when no repository is found."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo:
            mock_get_repo.return_value = None

            result = await user_version.get_document_history(user_id, file_path)

            assert result == []

    @pytest.mark.asyncio
    async def test_get_document_at_commit_success(self, user_version, temp_storage):
        """Test getting document content at specific commit."""
        user_id = 123
        file_path = "local/work/test.md"
        commit_hash = "abc123"
        expected_content = "# Old Content"

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo, \
             patch.object(user_version.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_version.git, 'file_at_commit') as mock_content:

            mock_repo_path = temp_storage / str(user_id) / "local" / "work"
            mock_user_dir_path = temp_storage / str(user_id)
            mock_get_repo.return_value = mock_repo_path
            mock_user_dir.return_value = mock_user_dir_path
            mock_content.return_value = expected_content

            result = await user_version.get_document_at_commit(user_id, file_path, commit_hash)

            assert result == expected_content
            mock_content.assert_called_once_with(mock_repo_path, "test.md", commit_hash)

    @pytest.mark.asyncio
    async def test_get_document_at_commit_no_repo(self, user_version):
        """Test getting document at commit when no repository is found."""
        user_id = 123
        file_path = "local/work/test.md"
        commit_hash = "abc123"

        with patch.object(user_version.directory, 'get_repository_path_for_file') as mock_get_repo:
            mock_get_repo.return_value = None

            result = await user_version.get_document_at_commit(user_id, file_path, commit_hash)

            assert result is None

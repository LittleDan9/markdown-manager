"""
Unit tests for the UserStorage service.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch

from app.services.storage.user import UserStorage
from app.services.storage.git import GitCommit


class TestUserStorage:
    """Test cases for UserStorage."""

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
    def user_storage_service(self, temp_storage):
        """Create a UserStorage instance with mocked services."""
        # Service will pick up MARKDOWN_STORAGE_ROOT from environment
        service = UserStorage()
        yield service

    @pytest.mark.asyncio
    async def test_create_user_directory_success(self, user_storage_service):
        """Test successful user directory creation."""
        user_id = 123

        with patch.object(user_storage_service.directory, 'create_user_directory') as mock_create:
            mock_create.return_value = True

            result = await user_storage_service.create_user_directory(user_id)

            assert result is True
            mock_create.assert_called_once_with(user_id)

    @pytest.mark.asyncio
    async def test_create_user_directory_failure(self, user_storage_service):
        """Test user directory creation failure."""
        user_id = 123

        with patch.object(user_storage_service.directory, 'create_user_directory') as mock_create:
            mock_create.return_value = False

            result = await user_storage_service.create_user_directory(user_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_initialize_category_repo_success(self, user_storage_service, temp_storage):
        """Test successful category repository initialization."""
        user_id = 123
        category_name = "work"

        with patch.object(user_storage_service.repository, 'initialize_category_repo') as mock_init:
            mock_init.return_value = True

            result = await user_storage_service.initialize_category_repo(user_id, category_name)

            assert result is True
            mock_init.assert_called_once_with(user_id, category_name)

    @pytest.mark.asyncio
    async def test_initialize_category_repo_failure(self, user_storage_service):
        """Test category repository initialization failure."""
        user_id = 123
        category_name = "work"

        with patch.object(user_storage_service.repository, 'initialize_category_repo') as mock_init:
            mock_init.return_value = False

            result = await user_storage_service.initialize_category_repo(user_id, category_name)

            assert result is False

    @pytest.mark.asyncio
    async def test_clone_github_repo_success(self, user_storage_service, temp_storage):
        """Test successful GitHub repository cloning."""
        user_id = 123
        account_id = 456
        repo_name = "my-repo"
        repo_url = "https://github.com/user/my-repo.git"

        with patch.object(user_storage_service.repository, 'clone_github_repo') as mock_clone:
            mock_clone.return_value = True

            result = await user_storage_service.clone_github_repo(
                user_id, account_id, repo_name, repo_url
            )

            assert result is True
            mock_clone.assert_called_once_with(user_id, account_id, repo_name, repo_url, None)

    @pytest.mark.asyncio
    async def test_clone_github_repo_with_branch(self, user_storage_service, temp_storage):
        """Test GitHub repository cloning with specific branch."""
        user_id = 123
        account_id = 456
        repo_name = "my-repo"
        repo_url = "https://github.com/user/my-repo.git"
        branch = "feature-branch"

        with patch.object(user_storage_service.repository, 'clone_github_repo') as mock_clone:
            mock_clone.return_value = True

            result = await user_storage_service.clone_github_repo(
                user_id, account_id, repo_name, repo_url, branch
            )

            assert result is True
            mock_clone.assert_called_once_with(user_id, account_id, repo_name, repo_url, branch)

    @pytest.mark.asyncio
    async def test_read_document(self, user_storage_service):
        """Test document reading delegation."""
        user_id = 123
        file_path = "local/work/test.md"
        expected_content = "# Test Document"

        with patch.object(user_storage_service.document, 'read_document') as mock_read:
            mock_read.return_value = expected_content

            result = await user_storage_service.read_document(user_id, file_path)

            assert result == expected_content
            mock_read.assert_called_once_with(user_id, file_path)

    @pytest.mark.asyncio
    async def test_write_document_success(self, user_storage_service):
        """Test successful document writing with auto-commit."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document"

        with patch.object(user_storage_service.document, 'write_document') as mock_write, \
             patch.object(user_storage_service.version, 'commit_file_change') as mock_commit:

            mock_write.return_value = True
            mock_commit.return_value = True

            result = await user_storage_service.write_document(user_id, file_path, content)

            assert result is True
            mock_write.assert_called_once_with(user_id, file_path, content)
            mock_commit.assert_called_once_with(user_id, file_path, None)

    @pytest.mark.asyncio
    async def test_write_document_no_auto_commit(self, user_storage_service):
        """Test document writing without auto-commit."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document"

        with patch.object(user_storage_service.document, 'write_document') as mock_write, \
             patch.object(user_storage_service.version, 'commit_file_change') as mock_commit:

            mock_write.return_value = True

            result = await user_storage_service.write_document(
                user_id, file_path, content, auto_commit=False
            )

            assert result is True
            mock_write.assert_called_once_with(user_id, file_path, content)
            mock_commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_write_document_filesystem_failure(self, user_storage_service):
        """Test document writing when filesystem operation fails."""
        user_id = 123
        file_path = "local/work/test.md"
        content = "# Test Document"

        with patch.object(user_storage_service.document, 'write_document') as mock_write:
            mock_write.return_value = False

            result = await user_storage_service.write_document(user_id, file_path, content)

            assert result is False

    @pytest.mark.asyncio
    async def test_move_document_success(self, user_storage_service):
        """Test successful document moving with auto-commit."""
        user_id = 123
        old_path = "local/work/test.md"
        new_path = "local/personal/test.md"

        with patch.object(user_storage_service.document, 'move_document') as mock_move, \
             patch.object(user_storage_service.version, 'commit_file_change') as mock_commit:

            mock_move.return_value = True
            mock_commit.return_value = True

            result = await user_storage_service.move_document(user_id, old_path, new_path)

            assert result is True
            mock_move.assert_called_once_with(user_id, old_path, new_path)

            # Should auto-commit both old and new paths
            assert mock_commit.call_count == 2

    @pytest.mark.asyncio
    async def test_delete_document_success(self, user_storage_service):
        """Test successful document deletion with auto-commit."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_storage_service.document, 'delete_document') as mock_delete, \
             patch.object(user_storage_service.version, 'commit_file_change') as mock_commit:

            mock_delete.return_value = True
            mock_commit.return_value = True

            result = await user_storage_service.delete_document(user_id, file_path)

            assert result is True
            mock_delete.assert_called_once_with(user_id, file_path)
            mock_commit.assert_called_once_with(user_id, file_path, "Delete test.md", allow_missing=True)

    @pytest.mark.asyncio
    async def test_get_document_history_success(self, user_storage_service, temp_storage):
        """Test getting document history."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create a mock git commit
        from datetime import datetime
        mock_commit = GitCommit(
            hash="abc123",
            message="Test commit",
            author="Test Author",
            date=datetime.now(),
            files=["test.md"]
        )

        with patch.object(user_storage_service.version, 'get_document_history') as mock_history:
            mock_history.return_value = [mock_commit]

            result = await user_storage_service.get_document_history(user_id, file_path)

            assert len(result) == 1
            assert result[0] == mock_commit
            mock_history.assert_called_once_with(user_id, file_path, 50)

    @pytest.mark.asyncio
    async def test_get_document_history_no_repo(self, user_storage_service):
        """Test getting document history when no repository is found."""
        user_id = 123
        file_path = "local/work/test.md"

        with patch.object(user_storage_service.version, 'get_document_history') as mock_history:
            mock_history.return_value = []

            result = await user_storage_service.get_document_history(user_id, file_path)

            assert result == []

    @pytest.mark.asyncio
    async def test_get_document_at_commit_success(self, user_storage_service, temp_storage):
        """Test getting document content at specific commit."""
        user_id = 123
        file_path = "local/work/test.md"
        commit_hash = "abc123"
        expected_content = "# Old Content"

        with patch.object(user_storage_service.version, 'get_document_at_commit') as mock_content:
            mock_content.return_value = expected_content

            result = await user_storage_service.get_document_at_commit(user_id, file_path, commit_hash)

            assert result == expected_content
            mock_content.assert_called_once_with(user_id, file_path, commit_hash)

    @pytest.mark.asyncio
    async def test_get_user_repositories_success(self, user_storage_service, temp_storage):
        """Test getting user repositories information."""
        user_id = 123

        mock_repos = {
            "local_categories": [{"name": "work", "branch": "main", "has_changes": False}],
            "github_repositories": [{"name": "my-repo", "account_id": "456", "branch": "main", "has_changes": False}]
        }

        with patch.object(user_storage_service.repository, 'get_user_repositories') as mock_get_repos:
            mock_get_repos.return_value = mock_repos

            result = await user_storage_service.get_user_repositories(user_id)

            assert len(result["local_categories"]) == 1
            assert result["local_categories"][0]["name"] == "work"
            assert len(result["github_repositories"]) == 1
            assert result["github_repositories"][0]["name"] == "my-repo"

    def test_get_repository_path_for_file_success(self, user_storage_service, temp_storage):
        """Test finding repository path for a file."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create mock directory structure with .git
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        # Mock directory service to use temp storage
        with patch.object(user_storage_service.directory, 'get_user_directory') as mock_user_dir:
            mock_user_dir.return_value = user_dir

            result = user_storage_service.get_repository_path_for_file(user_id, file_path)

        assert result == work_dir

    def test_get_repository_path_for_file_not_found(self, user_storage_service, temp_storage):
        """Test repository path lookup when no git repository is found."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create directory structure without .git
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)

        result = user_storage_service.get_repository_path_for_file(user_id, file_path)

        assert result is None

    def test_convenience_methods(self, user_storage_service, temp_storage):
        """Test convenience methods for directory paths."""
        user_id = 123

        # Mock directory service to use temp storage
        with patch.object(user_storage_service.directory, 'get_user_directory') as mock_user_dir:
            mock_user_dir.return_value = temp_storage / str(user_id)

            # Test user directory
            user_dir = user_storage_service.get_user_directory(user_id)
            expected_user_dir = temp_storage / str(user_id)
            assert user_dir == expected_user_dir

        with patch.object(user_storage_service.directory, 'get_github_directory') as mock_github_dir:
            mock_github_dir.return_value = temp_storage / str(user_id) / "github"

            # Test GitHub directory
            github_dir = user_storage_service.get_github_directory(user_id)
            expected_github_dir = temp_storage / str(user_id) / "github"
            assert github_dir == expected_github_dir

            # Test GitHub account directory (uses get_github_directory)
            account_id = 456
            account_dir = user_storage_service.get_github_account_directory(user_id, account_id)
            expected_account_dir = expected_github_dir / str(account_id)
            assert account_dir == expected_account_dir

            # Test GitHub repo directory (uses get_github_account_directory)
            repo_name = "my-repo"
            repo_dir = user_storage_service.get_github_repo_directory(user_id, account_id, repo_name)
            expected_repo_dir = expected_account_dir / repo_name
            assert repo_dir == expected_repo_dir

        # Test repository type detection
        with patch.object(user_storage_service.directory, 'is_github_repository') as mock_is_github:
            mock_is_github.return_value = True

            is_github = user_storage_service.is_github_repository(user_id, "github/456/my-repo/test.md")
            assert is_github is True

            mock_is_github.return_value = False
            is_local = user_storage_service.is_github_repository(user_id, "local/work/test.md")
            assert is_local is False

    def test_is_github_repository(self, user_storage_service):
        """Test GitHub repository detection."""
        user_id = 123

        # Test local category file
        local_path = "local/work/test.md"
        is_github = user_storage_service.is_github_repository(user_id, local_path)
        assert is_github is False

        # Test GitHub repository file
        github_path = "github/456/repo/test.md"
        is_github = user_storage_service.is_github_repository(user_id, github_path)
        assert is_github is True

    @pytest.mark.asyncio
    async def test_cleanup_user_directory(self, user_storage_service):
        """Test cleanup user directory delegation."""
        user_id = 123

        with patch.object(user_storage_service.directory, 'cleanup_user_directory') as mock_cleanup:
            mock_cleanup.return_value = True

            result = await user_storage_service.cleanup_user_directory(user_id)

            assert result is True
            mock_cleanup.assert_called_once_with(user_id)

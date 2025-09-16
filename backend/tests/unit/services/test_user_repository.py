"""
Unit tests for the UserRepository service.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path
from unittest.mock import patch, AsyncMock

from app.services.storage.user.repository import UserRepository


class TestUserRepository:
    """Test cases for UserRepository service."""

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
    def user_repository(self, temp_storage):
        """Create a UserRepository instance with temporary storage."""
        service = UserRepository()
        yield service

    @pytest.mark.asyncio
    async def test_initialize_category_repo_success(self, user_repository, temp_storage):
        """Test successful category repository initialization."""
        user_id = 123
        category_name = "work"

        # Mock the directory service to return the expected path
        with patch.object(user_repository.directory, 'get_category_directory') as mock_get_cat_dir, \
             patch.object(user_repository.git, 'initialize') as mock_init:

            expected_path = temp_storage / str(user_id) / "local" / category_name
            mock_get_cat_dir.return_value = expected_path
            mock_init.return_value = True

            result = await user_repository.initialize_category_repo(user_id, category_name)

            assert result is True

            # Verify correct path was used
            mock_get_cat_dir.assert_called_once_with(user_id, category_name)
            mock_init.assert_called_once_with(expected_path, f"Initialize {category_name} category")

    @pytest.mark.asyncio
    async def test_initialize_category_repo_failure(self, user_repository):
        """Test category repository initialization failure."""
        user_id = 123
        category_name = "work"

        with patch.object(user_repository.git, 'initialize') as mock_init:
            mock_init.return_value = False

            result = await user_repository.initialize_category_repo(user_id, category_name)

            assert result is False

    @pytest.mark.asyncio
    async def test_clone_github_repo_success(self, user_repository, temp_storage):
        """Test successful GitHub repository cloning."""
        user_id = 123
        account_id = 456
        repo_name = "my-repo"
        repo_url = "https://github.com/user/my-repo.git"

        with patch.object(user_repository.github_filesystem_service, 'clone_repository_for_account') as mock_clone:
            mock_clone.return_value = True

            result = await user_repository.clone_github_repo(
                user_id, account_id, repo_name, repo_url
            )

            assert result is True

            # Verify correct parameters were used
            mock_clone.assert_called_once_with(user_id, account_id, repo_name, repo_url, None)

    @pytest.mark.asyncio
    async def test_clone_github_repo_with_branch(self, user_repository, temp_storage):
        """Test GitHub repository cloning with specific branch."""
        user_id = 123
        account_id = 456
        repo_name = "my-repo"
        repo_url = "https://github.com/user/my-repo.git"
        branch = "feature-branch"

        with patch.object(user_repository.github_filesystem_service, 'clone_repository_for_account') as mock_clone:
            mock_clone.return_value = True

            result = await user_repository.clone_github_repo(
                user_id, account_id, repo_name, repo_url, branch
            )

            assert result is True

            # Verify correct parameters were used
            mock_clone.assert_called_once_with(user_id, account_id, repo_name, repo_url, branch)

    @pytest.mark.asyncio
    async def test_clone_github_repo_failure(self, user_repository):
        """Test GitHub repository cloning failure."""
        user_id = 123
        account_id = 456
        repo_name = "my-repo"
        repo_url = "https://github.com/user/my-repo.git"

        with patch.object(user_repository.github_filesystem_service, 'clone_repository_for_account') as mock_clone:
            mock_clone.return_value = False

            result = await user_repository.clone_github_repo(
                user_id, account_id, repo_name, repo_url
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_get_user_repositories_success(self, user_repository, temp_storage):
        """Test getting user repositories information."""
        user_id = 123

        # Create mock directory structure
        user_dir = temp_storage / str(user_id)
        local_dir = user_dir / "local"
        github_dir = user_dir / "github"

        # Mock category directory
        category_dir = local_dir / "work"
        category_dir.mkdir(parents=True)
        (category_dir / ".git").mkdir()

        # Mock GitHub repo directory
        github_account_dir = github_dir / "456"
        github_repo_dir = github_account_dir / "my-repo"
        github_repo_dir.mkdir(parents=True)
        (github_repo_dir / ".git").mkdir()

        mock_status = {
            "branch": "main",
            "has_changes": False,
            "staged_files": [],
            "modified_files": [],
            "untracked_files": []
        }

        # Mock directory service to use temp storage
        with patch.object(user_repository.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_repository.directory, 'get_local_directory') as mock_local_dir, \
             patch.object(user_repository.directory, 'get_github_directory') as mock_github_dir, \
             patch.object(user_repository.git, 'status') as mock_status_func:

            mock_user_dir.return_value = user_dir
            mock_local_dir.return_value = local_dir
            mock_github_dir.return_value = github_dir
            mock_status_func.return_value = mock_status

            result = await user_repository.get_user_repositories(user_id)

            assert len(result["local_categories"]) == 1
            assert result["local_categories"][0]["name"] == "work"
            assert result["local_categories"][0]["status"]["branch"] == "main"

            assert len(result["github_repositories"]) == 1
            assert result["github_repositories"][0]["name"] == "my-repo"
            assert result["github_repositories"][0]["account_id"] == "456"
            assert result["github_repositories"][0]["status"]["branch"] == "main"

    @pytest.mark.asyncio
    async def test_get_user_repositories_no_directories(self, user_repository, temp_storage):
        """Test getting repositories when no user directories exist."""
        user_id = 123

        result = await user_repository.get_user_repositories(user_id)

        assert result["local_categories"] == []
        assert result["github_repositories"] == []

    @pytest.mark.asyncio
    async def test_get_user_repositories_git_status_error(self, user_repository, temp_storage):
        """Test getting repositories when git status fails."""
        user_id = 123

        # Create mock directory structure
        user_dir = temp_storage / str(user_id)
        local_dir = user_dir / "local"
        category_dir = local_dir / "work"
        category_dir.mkdir(parents=True)
        (category_dir / ".git").mkdir()

        mock_status = {"error": "Not a git repository"}

        # Mock directory service to use temp storage
        with patch.object(user_repository.directory, 'get_user_directory') as mock_user_dir, \
             patch.object(user_repository.directory, 'get_local_directory') as mock_local_dir, \
             patch.object(user_repository.directory, 'get_github_directory') as mock_github_dir, \
             patch.object(user_repository.git, 'status') as mock_status_func:

            mock_user_dir.return_value = user_dir
            mock_local_dir.return_value = local_dir
            mock_github_dir.return_value = user_dir / "github"  # github dir doesn't exist in this test
            mock_status_func.return_value = mock_status

            result = await user_repository.get_user_repositories(user_id)

            # Should still include the repository but with error status
            assert len(result["local_categories"]) == 1
            assert result["local_categories"][0]["name"] == "work"
            assert "error" in result["local_categories"][0]["status"]

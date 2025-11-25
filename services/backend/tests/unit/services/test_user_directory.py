"""
Unit tests for the UserDirectory service.
"""

import pytest
import shutil
from pathlib import Path

from app.services.storage.user.directory import UserDirectory


class TestUserDirectory:
    """Test cases for UserDirectory service."""

    @pytest.fixture
    def temp_storage(self):
        """Create a temporary directory for testing."""
        # Use the global pytest storage location to avoid path mismatches
        temp_dir = Path("/tmp/pytest-storage")
        temp_dir.mkdir(parents=True, exist_ok=True)

        yield temp_dir

        # Clean up test files but keep directory for other tests
        for child in temp_dir.glob("*"):
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

    @pytest.fixture
    def user_directory(self, temp_storage):
        """Create a UserDirectory instance with temporary storage."""
        service = UserDirectory()
        yield service

    @pytest.mark.asyncio
    async def test_create_user_directory_success(self, user_directory, temp_storage):
        """Test successful user directory creation."""
        user_id = 123

        result = await user_directory.create_user_directory(user_id)

        assert result is True

        # Verify directory structure was created
        user_dir = temp_storage / str(user_id)
        assert user_dir.exists()
        assert (user_dir / "local").exists()
        assert (user_dir / "github").exists()

    @pytest.mark.asyncio
    async def test_create_user_directory_already_exists(self, user_directory, temp_storage):
        """Test user directory creation when directory already exists."""
        user_id = 123

        # Create directory first
        user_dir = temp_storage / str(user_id)
        user_dir.mkdir()

        result = await user_directory.create_user_directory(user_id)

        assert result is True  # Should still succeed

    @pytest.mark.asyncio
    async def test_cleanup_user_directory_success(self, user_directory, temp_storage):
        """Test successful user directory cleanup."""
        user_id = 123

        # Create directory structure first
        await user_directory.create_user_directory(user_id)
        user_dir = temp_storage / str(user_id)
        assert user_dir.exists()

        result = await user_directory.cleanup_user_directory(user_id)

        assert result is True
        assert not user_dir.exists()

    @pytest.mark.asyncio
    async def test_cleanup_user_directory_not_exists(self, user_directory, temp_storage):
        """Test cleanup when user directory doesn't exist."""
        user_id = 123

        result = await user_directory.cleanup_user_directory(user_id)

        assert result is True  # Should succeed even if not exists

    def test_get_user_directory(self, user_directory, temp_storage):
        """Test getting user directory path."""
        user_id = 123

        result = user_directory.get_user_directory(user_id)

        expected_path = temp_storage / str(user_id)
        assert result == expected_path

    def test_get_github_directory(self, user_directory, temp_storage):
        """Test getting GitHub directory path."""
        user_id = 123

        result = user_directory.get_github_directory(user_id)

        expected_path = temp_storage / str(user_id) / "github"
        assert result == expected_path

    def test_get_repository_path_for_file_local_category(self, user_directory, temp_storage):
        """Test finding repository path for local category file."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create mock directory structure with .git
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)
        (work_dir / ".git").mkdir()

        result = user_directory.get_repository_path_for_file(user_id, file_path)

        assert result == work_dir

    def test_get_repository_path_for_file_github_repo(self, user_directory, temp_storage):
        """Test finding repository path for GitHub repository file."""
        user_id = 123
        file_path = "github/456/my-repo/test.md"

        # Create mock GitHub repo structure with .git
        user_dir = temp_storage / str(user_id)
        repo_dir = user_dir / "github" / "456" / "my-repo"
        repo_dir.mkdir(parents=True)
        (repo_dir / ".git").mkdir()

        result = user_directory.get_repository_path_for_file(user_id, file_path)

        assert result == repo_dir

    def test_get_repository_path_for_file_not_found(self, user_directory, temp_storage):
        """Test repository path lookup when no git repository is found."""
        user_id = 123
        file_path = "local/work/test.md"

        # Create directory structure without .git
        user_dir = temp_storage / str(user_id)
        work_dir = user_dir / "local" / "work"
        work_dir.mkdir(parents=True)

        result = user_directory.get_repository_path_for_file(user_id, file_path)

        assert result is None

    def test_is_github_repository_local_file(self, user_directory):
        """Test GitHub repository detection for local category file."""
        user_id = 123
        file_path = "local/work/test.md"

        result = user_directory.is_github_repository(user_id, file_path)

        assert result is False

    def test_is_github_repository_github_file(self, user_directory):
        """Test GitHub repository detection for GitHub repository file."""
        user_id = 123
        file_path = "github/456/repo/test.md"

        result = user_directory.is_github_repository(user_id, file_path)

        assert result is True

    def test_is_github_repository_invalid_path(self, user_directory):
        """Test GitHub repository detection for invalid path."""
        user_id = 123
        file_path = "invalid/path.md"

        result = user_directory.is_github_repository(user_id, file_path)

        assert result is False

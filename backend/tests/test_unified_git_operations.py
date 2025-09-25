"""
Tests for UnifiedGitOperations - Consistent git operations across repository types.

Tests cover:
1. Git status for local category repositories
2. Git status for GitHub repositories
3. Commit operations across repository types
4. Git history retrieval
5. Branch information
6. Error handling and edge cases
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.unified_git_operations import unified_git_operations
from app.models.document import Document as DocumentModel
from app.models.category import Category


class TestUnifiedGitOperations:
    """Test suite for UnifiedGitOperations."""

    @pytest.fixture
    async def mock_db(self):
        """Mock database session."""
        db = Mock(spec=AsyncSession)
        return db

    @pytest.fixture
    def mock_local_document(self):
        """Mock local document for testing."""
        category = Category(id=1, name="TestCategory", user_id=1)

        document = DocumentModel(
            id=1,
            name="test-document.md",
            user_id=1,
            category_id=1,
            repository_type="local",
            file_path="local/TestCategory/test-document.md",
            folder_path="/TestCategory",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        document.category_ref = category
        return document

    @pytest.fixture
    def mock_github_document(self):
        """Mock GitHub document for testing."""
        document = DocumentModel(
            id=2,
            name="github-doc.md",
            user_id=1,
            github_repository_id=1,
            repository_type="github",
            file_path="github/123/test-repo/docs/github-doc.md",
            github_file_path="docs/github-doc.md",
            github_branch="main",
            folder_path="/GitHub/docs",
            github_sync_status="synced",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        return document

    @pytest.mark.asyncio
    async def test_get_local_git_status(self, mock_db, mock_local_document):
        """Test getting git status for local category repository."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_category_dir = Mock()
                mock_category_dir.exists.return_value = True
                mock_storage.get_category_directory.return_value = mock_category_dir
                mock_storage_class.return_value = mock_storage

                # Mock git filesystem service
                with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                    mock_git_service.get_git_status.return_value = {
                        "current_branch": "main",
                        "has_changes": True,
                        "modified_files": ["test-document.md"],
                        "staged_files": [],
                        "untracked_files": ["new-file.md"],
                        "ahead_behind": {"ahead": 1, "behind": 0}
                    }

                    # Test the service
                    result = await unified_git_operations.get_git_status(
                        db=mock_db,
                        document_id=1,
                        user_id=1
                    )

                    # Verify result
                    assert result["current_branch"] == "main"
                    assert result["has_uncommitted_changes"] is True
                    assert result["has_staged_changes"] is False
                    assert result["has_untracked_files"] is True
                    assert result["modified_files"] == ["test-document.md"]
                    assert result["untracked_files"] == ["new-file.md"]
                    assert result["repository_type"] == "local"
                    assert result["category_name"] == "TestCategory"
                    assert "error" not in result

    @pytest.mark.asyncio
    async def test_get_github_git_status_cloned(self, mock_db, mock_github_document):
        """Test getting git status for cloned GitHub repository."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_github_document

            # Mock GitHub repository
            mock_repository = Mock()
            mock_repository.account_id = 123
            mock_repository.repo_name = "test-repo"
            mock_repository.repo_owner = "testowner"
            mock_repository.default_branch = "main"

            # Mock GitHub CRUD
            with patch('app.crud.github_crud.GitHubCRUD') as mock_github_crud_class:
                mock_github_crud = AsyncMock()
                mock_github_crud.get_repository.return_value = mock_repository
                mock_github_crud_class.return_value = mock_github_crud

                # Mock storage service
                with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                    mock_storage = AsyncMock()
                    mock_repo_dir = Mock()
                    mock_repo_dir.exists.return_value = True
                    mock_storage.get_github_repo_directory.return_value = mock_repo_dir
                    mock_storage_class.return_value = mock_storage

                    # Mock git filesystem service
                    with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                        mock_git_service.get_git_status.return_value = {
                            "current_branch": "feature-branch",
                            "has_changes": False,
                            "modified_files": [],
                            "staged_files": [],
                            "untracked_files": [],
                            "ahead_behind": {"ahead": 0, "behind": 2}
                        }

                        # Test the service
                        result = await unified_git_operations.get_git_status(
                            db=mock_db,
                            document_id=2,
                            user_id=1
                        )

                        # Verify result
                        assert result["current_branch"] == "feature-branch"
                        assert result["has_uncommitted_changes"] is False
                        assert result["repository_type"] == "github"
                        assert result["github_info"]["repository_name"] == "test-repo"
                        assert result["github_info"]["owner"] == "testowner"
                        assert result["github_info"]["cloned"] is True

    @pytest.mark.asyncio
    async def test_get_github_git_status_not_cloned(self, mock_db, mock_github_document):
        """Test getting git status for GitHub repository not yet cloned."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_github_document

            # Mock GitHub repository
            mock_repository = Mock()
            mock_repository.account_id = 123
            mock_repository.repo_name = "test-repo"
            mock_repository.repo_owner = "testowner"
            mock_repository.default_branch = "main"

            # Mock GitHub CRUD
            with patch('app.crud.github_crud.GitHubCRUD') as mock_github_crud_class:
                mock_github_crud = AsyncMock()
                mock_github_crud.get_repository.return_value = mock_repository
                mock_github_crud_class.return_value = mock_github_crud

                # Mock storage service
                with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                    mock_storage = AsyncMock()
                    mock_repo_dir = Mock()
                    mock_repo_dir.exists.return_value = False  # Not cloned yet
                    mock_storage.get_github_repo_directory.return_value = mock_repo_dir
                    mock_storage_class.return_value = mock_storage

                    # Test the service
                    result = await unified_git_operations.get_git_status(
                        db=mock_db,
                        document_id=2,
                        user_id=1
                    )

                    # Verify result for non-cloned repo
                    assert result["current_branch"] == "main"
                    assert result["has_uncommitted_changes"] is False  # Based on sync status
                    assert result["repository_type"] == "github"
                    assert result["github_info"]["cloned"] is False

    @pytest.mark.asyncio
    async def test_commit_local_changes(self, mock_db, mock_local_document):
        """Test committing changes in local category repository."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_category_dir = Mock()
                mock_storage.get_category_directory.return_value = mock_category_dir
                mock_storage_class.return_value = mock_storage

                # Mock git filesystem service
                with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                    mock_git_service.commit_changes.return_value = {
                        "commit_sha": "abc123def456"
                    }

                    # Test committing changes
                    result = await unified_git_operations.commit_changes(
                        db=mock_db,
                        document_id=1,
                        user_id=1,
                        commit_message="Test commit message",
                        auto_push=False
                    )

                    # Verify result
                    assert result["success"] is True
                    assert result["commit_sha"] == "abc123def456"
                    assert result["commit_message"] == "Test commit message"
                    assert result["repository_type"] == "local"
                    assert result["category_name"] == "TestCategory"

                    # Verify git service was called correctly
                    mock_git_service.commit_changes.assert_called_once_with(
                        repo_dir=mock_category_dir,
                        commit_message="Test commit message",
                        files=["test-document.md"]
                    )

    @pytest.mark.asyncio
    async def test_commit_github_changes_with_push(self, mock_db, mock_github_document):
        """Test committing and pushing GitHub repository changes."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_github_document

            # Mock GitHub repository
            mock_repository = Mock()
            mock_repository.account_id = 123
            mock_repository.repo_name = "test-repo"
            mock_repository.repo_owner = "testowner"
            mock_repository.default_branch = "main"

            # Mock GitHub CRUD
            with patch('app.crud.github_crud.GitHubCRUD') as mock_github_crud_class:
                mock_github_crud = AsyncMock()
                mock_github_crud.get_repository.return_value = mock_repository
                mock_github_crud_class.return_value = mock_github_crud

                # Mock storage service
                with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                    mock_storage = AsyncMock()
                    mock_repo_dir = Mock()
                    mock_storage.get_github_repo_directory.return_value = mock_repo_dir
                    mock_storage_class.return_value = mock_storage

                    # Mock git filesystem service
                    with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                        mock_git_service.commit_changes.return_value = {
                            "commit_sha": "xyz789abc123"
                        }
                        mock_git_service.push_changes.return_value = None

                        # Test committing and pushing changes
                        result = await unified_git_operations.commit_changes(
                            db=mock_db,
                            document_id=2,
                            user_id=1,
                            commit_message="GitHub commit message",
                            auto_push=True
                        )

                        # Verify result
                        assert result["success"] is True
                        assert result["commit_sha"] == "xyz789abc123"
                        assert result["repository_type"] == "github"
                        assert result["pushed"] is True
                        assert result["github_info"]["repository_name"] == "test-repo"
                        assert result["github_info"]["branch"] == "main"

                        # Verify git operations were called
                        mock_git_service.commit_changes.assert_called_once()
                        mock_git_service.push_changes.assert_called_once_with(
                            repo_dir=mock_repo_dir,
                            branch="main"
                        )

                        # Verify document sync status was updated
                        assert mock_github_document.github_sync_status == "synced"
                        assert mock_github_document.local_sha == "xyz789abc123"

    @pytest.mark.asyncio
    async def test_get_git_history_local(self, mock_db, mock_local_document):
        """Test getting git history for local document."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_category_dir = Mock()
                mock_storage.get_category_directory.return_value = mock_category_dir
                mock_storage_class.return_value = mock_storage

                # Mock git filesystem service
                with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                    mock_git_service.get_git_history.return_value = [
                        {
                            "sha": "abc123",
                            "message": "Initial commit",
                            "author": "Test Author",
                            "date": "2024-01-01T10:00:00Z"
                        },
                        {
                            "sha": "def456",
                            "message": "Update document",
                            "author": "Test Author",
                            "date": "2024-01-02T14:30:00Z"
                        }
                    ]

                    # Test getting history
                    result = await unified_git_operations.get_git_history(
                        db=mock_db,
                        document_id=1,
                        user_id=1,
                        limit=10
                    )

                    # Verify result
                    assert len(result) == 2
                    assert result[0]["sha"] == "abc123"
                    assert result[0]["message"] == "Initial commit"
                    assert result[0]["repository_type"] == "local"
                    assert result[1]["sha"] == "def456"

    @pytest.mark.asyncio
    async def test_get_branch_info_local(self, mock_db, mock_local_document):
        """Test getting branch information for local repository."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_category_dir = Mock()
                mock_storage.get_category_directory.return_value = mock_category_dir
                mock_storage_class.return_value = mock_storage

                # Mock git filesystem service
                with patch('app.services.unified_git_operations.github_filesystem_service') as mock_git_service:
                    mock_git_service.get_branch_info.return_value = {
                        "current_branch": "main",
                        "branches": ["main", "feature-branch", "develop"]
                    }

                    # Test getting branch info
                    result = await unified_git_operations.get_branch_info(
                        db=mock_db,
                        document_id=1,
                        user_id=1
                    )

                    # Verify result
                    assert result["current_branch"] == "main"
                    assert result["branches"] == ["main", "feature-branch", "develop"]
                    assert result["repository_type"] == "local"

    @pytest.mark.asyncio
    async def test_error_handling_document_not_found(self, mock_db):
        """Test error handling when document is not found."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = None

            with pytest.raises(ValueError, match="Document not found or access denied"):
                await unified_git_operations.get_git_status(
                    db=mock_db,
                    document_id=999,
                    user_id=1
                )

    @pytest.mark.asyncio
    async def test_error_handling_git_failure(self, mock_db, mock_local_document):
        """Test error handling when git operations fail."""
        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_git_operations.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_category_dir = Mock()
                mock_category_dir.exists.return_value = False  # Directory doesn't exist
                mock_storage.get_category_directory.return_value = mock_category_dir
                mock_storage_class.return_value = mock_storage

                # Test the service - should return safe fallback
                result = await unified_git_operations.get_git_status(
                    db=mock_db,
                    document_id=1,
                    user_id=1
                )

                # Verify error fallback
                assert result["current_branch"] == "unknown"
                assert result["has_uncommitted_changes"] is False
                assert result["repository_type"] == "local"
                assert "error" in result

    @pytest.mark.asyncio
    async def test_unsupported_repository_type(self, mock_db, mock_local_document):
        """Test error handling for unsupported repository types."""
        mock_local_document.repository_type = "unsupported"

        with patch('app.services.unified_git_operations.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            with pytest.raises(ValueError, match="Unsupported repository type: unsupported"):
                await unified_git_operations.get_git_status(
                    db=mock_db,
                    document_id=1,
                    user_id=1
                )


if __name__ == "__main__":
    pytest.main([__file__])
"""
Tests for UnifiedDocumentService - Core unified document access functionality.

Tests cover:
1. Document retrieval for local and GitHub documents
2. Content updates across repository types
3. Error handling and edge cases
4. Unified response format consistency
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.unified_document import unified_document_service


class TestUnifiedDocumentService:
    """Test suite for UnifiedDocumentService."""

    @pytest.fixture
    async def mock_db(self):
        """Mock database session."""
        db = Mock(spec=AsyncSession)
        return db

    @pytest.fixture
    def mock_user(self):
        """Mock user for testing."""
        user = Mock()
        user.id = 1
        user.username = "testuser"
        user.email = "test@example.com"
        return user

    @pytest.fixture
    def mock_local_document(self):
        """Mock local document for testing."""
        category = Mock()
        category.id = 1
        category.name = "TestCategory"
        category.user_id = 1

        document = Mock()
        document.id = 1
        document.name = "test-document.md"
        document.user_id = 1
        document.category_id = 1
        document.repository_type = "local"
        document.file_path = "local/TestCategory/test-document.md"
        document.folder_path = "/TestCategory"
        document.created_at = datetime.now(timezone.utc)
        document.updated_at = datetime.now(timezone.utc)
        document.last_opened_at = None
        document.category_ref = category
        return document

    @pytest.fixture
    def mock_github_document(self):
        """Mock GitHub document for testing."""
        document = Mock()
        document.id = 2
        document.name = "github-doc.md"
        document.user_id = 1
        document.github_repository_id = 1
        document.repository_type = "github"
        document.file_path = "github/123/test-repo/docs/github-doc.md"
        document.github_file_path = "docs/github-doc.md"
        document.github_branch = "main"
        document.folder_path = "/GitHub/docs"
        document.github_sync_status = "synced"
        document.created_at = datetime.now(timezone.utc)
        document.updated_at = datetime.now(timezone.utc)
        document.last_opened_at = None
        document.category_ref = None
        return document

    @pytest.mark.asyncio
    async def test_get_local_document_with_content(
        self, mock_db, mock_user, mock_local_document
    ):
        """Test getting local document with content."""
        # Mock document CRUD
        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            # Mock storage service
            with patch('app.services.unified_document.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_storage.read_document.return_value = "# Test Content\n\nThis is test content."
                mock_storage_class.return_value = mock_storage

                # Test the service
                result = await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=1,
                    user_id=1,
                    force_sync=False
                )

                # Verify result
                assert result["id"] == 1
                assert result["name"] == "test-document.md"
                assert result["content"] == "# Test Content\n\nThis is test content."
                assert result["repository_type"] == "local"
                assert result["category"] == "TestCategory"
                assert result["github_repository_id"] is None

                # Verify storage service was called correctly
                mock_storage.read_document.assert_called_once_with(
                    user_id=1,
                    file_path="local/TestCategory/test-document.md"
                )

    @pytest.mark.asyncio
    async def test_get_github_document_with_content(
        self, mock_db, mock_user, mock_github_document
    ):
        """Test getting GitHub document with content and auto-sync."""
        # Mock document CRUD
        with patch('app.services.unified_document.document_crud') as mock_crud:
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
                with patch('app.services.unified_document.UserStorage') as mock_storage_class:
                    mock_storage = AsyncMock()
                    mock_storage.read_document.return_value = "# GitHub Content\n\nFrom repository."
                    mock_storage.get_github_repo_directory.return_value = Mock(exists=Mock(return_value=True))
                    mock_storage_class.return_value = mock_storage

                    # Mock GitHub service
                    with patch('app.services.unified_document.GitHubService') as mock_github_service_class:
                        mock_github_service = AsyncMock()
                        mock_github_service._filesystem_service.pull_changes.return_value = None
                        mock_github_service_class.return_value = mock_github_service

                        # Test the service
                        result = await unified_document_service.get_document_with_content(
                            db=mock_db,
                            document_id=2,
                            user_id=1,
                            force_sync=False
                        )

                        # Verify result
                        assert result["id"] == 2
                        assert result["name"] == "github-doc.md"
                        assert result["content"] == "# GitHub Content\n\nFrom repository."
                        assert result["repository_type"] == "github"
                        assert result["github_repository_id"] == 1
                        assert result["github_file_path"] == "docs/github-doc.md"
                        assert result["github_branch"] == "main"
                        assert result["github_sync_status"] == "synced"
                        assert result["category"] is None

    @pytest.mark.asyncio
    async def test_document_not_found_error(self, mock_db):
        """Test error handling when document is not found."""
        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = None

            with pytest.raises(ValueError, match="Document not found or access denied"):
                await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=999,
                    user_id=1,
                    force_sync=False
                )

    @pytest.mark.asyncio
    async def test_document_access_denied_wrong_user(self, mock_db, mock_local_document):
        """Test error handling when user doesn't own document."""
        mock_local_document.user_id = 2  # Different user

        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            with pytest.raises(ValueError, match="Document not found or access denied"):
                await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=1,
                    user_id=1,  # Requesting user is different
                    force_sync=False
                )

    @pytest.mark.asyncio
    async def test_update_local_document_content(self, mock_db, mock_local_document):
        """Test updating local document content."""
        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            with patch('app.services.unified_document.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_storage.write_document.return_value = True
                mock_storage_class.return_value = mock_storage

                # Test content update
                result = await unified_document_service.update_document_content(
                    db=mock_db,
                    document_id=1,
                    user_id=1,
                    content="# Updated Content\n\nNew content here.",
                    commit_message="Update test document"
                )

                assert result is True
                mock_storage.write_document.assert_called_once_with(
                    user_id=1,
                    file_path="local/TestCategory/test-document.md",
                    content="# Updated Content\n\nNew content here.",
                    commit_message="Update test document",
                    auto_commit=True
                )

    @pytest.mark.asyncio
    async def test_update_github_document_content(self, mock_db, mock_github_document):
        """Test updating GitHub document content."""
        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_github_document

            with patch('app.services.unified_document.UserStorage') as mock_storage_class:
                mock_storage = AsyncMock()
                mock_storage.write_document.return_value = True
                mock_storage_class.return_value = mock_storage

                # Test content update
                result = await unified_document_service.update_document_content(
                    db=mock_db,
                    document_id=2,
                    user_id=1,
                    content="# Updated GitHub Content\n\nNew GitHub content.",
                    commit_message="Update GitHub document"
                )

                assert result is True
                mock_storage.write_document.assert_called_once_with(
                    user_id=1,
                    file_path="github/123/test-repo/docs/github-doc.md",
                    content="# Updated GitHub Content\n\nNew GitHub content.",
                    commit_message="Update GitHub document",
                    auto_commit=True
                )

    @pytest.mark.asyncio
    async def test_unsupported_repository_type(self, mock_db, mock_local_document):
        """Test error handling for unsupported repository types."""
        mock_local_document.repository_type = "unsupported_type"

        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = mock_local_document

            with pytest.raises(ValueError, match="Unsupported repository type: unsupported_type"):
                await unified_document_service.get_document_with_content(
                    db=mock_db,
                    document_id=1,
                    user_id=1,
                    force_sync=False
                )

    @pytest.mark.asyncio
    async def test_legacy_document_fallback(self, mock_db):
        """Test fallback to database content for legacy documents without file_path."""
        legacy_document = Mock()
        legacy_document.id = 3
        legacy_document.name = "legacy-doc.md"
        legacy_document.user_id = 1
        legacy_document.category_id = 1
        legacy_document.repository_type = "local"
        legacy_document.file_path = None  # Legacy document
        legacy_document.folder_path = "/Legacy"
        legacy_document.created_at = datetime.now(timezone.utc)
        legacy_document.updated_at = datetime.now(timezone.utc)
        legacy_document.content = "Legacy database content"  # Content in database

        category = Mock()
        category.id = 1
        category.name = "Legacy"
        category.user_id = 1
        legacy_document.category_ref = category

        with patch('app.services.unified_document.document_crud') as mock_crud:
            mock_crud.document.get.return_value = legacy_document

            # Test the service
            result = await unified_document_service.get_document_with_content(
                db=mock_db,
                document_id=3,
                user_id=1,
                force_sync=False
            )

            # Should get legacy content from database
            assert result["content"] == "Legacy database content"
            assert result["repository_type"] == "local"

    @pytest.mark.asyncio
    async def test_force_sync_github_document(
        self, mock_db, mock_user, mock_github_document
    ):
        """Test force sync for GitHub documents."""
        # Mock document CRUD
        with patch('app.services.unified_document.document_crud') as mock_crud:
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
                with patch('app.services.unified_document.UserStorage') as mock_storage_class:
                    mock_storage = AsyncMock()
                    mock_storage.read_document.return_value = "Fresh synced content"
                    mock_repo_dir = Mock()
                    mock_repo_dir.exists.return_value = True
                    mock_storage.get_github_repo_directory.return_value = mock_repo_dir
                    mock_storage_class.return_value = mock_storage

                    # Mock GitHub service
                    with patch('app.services.unified_document.GitHubService') as mock_github_service_class:
                        mock_github_service = AsyncMock()
                        mock_github_service.clone_repository.return_value = None
                        mock_github_service._filesystem_service.pull_changes.return_value = None
                        mock_github_service_class.return_value = mock_github_service

                        # Test with force_sync=True
                        result = await unified_document_service.get_document_with_content(
                            db=mock_db,
                            document_id=2,
                            user_id=1,
                            force_sync=True
                        )

                        # Verify force sync was triggered
                        assert result["content"] == "Fresh synced content"
                        mock_github_service.clone_repository.assert_called_once()
                        mock_github_service._filesystem_service.pull_changes.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__])
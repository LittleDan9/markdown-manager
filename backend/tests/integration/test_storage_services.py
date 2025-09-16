"""
Integration tests for filesystem storage services.

These tests verify that the filesystem services work together correctly
and interact properly with the actual filesystem and git.
"""

import pytest
import tempfile
import shutil
import os
from pathlib import Path

from app.services.storage.user import UserStorage
from app.services.storage.filesystem import Filesystem
from app.services.storage.git import Git


class TestStorageServicesIntegration:
    """Integration tests for storage services working together."""

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
    def storage_services(self, temp_storage):
        """Create storage service instances with temporary storage."""
        # Services will pick up MARKDOWN_STORAGE_ROOT from environment
        user_service = UserStorage()
        filesystem_service = Filesystem()
        git_service = Git()

        return {
            'user_service': user_service,
            'filesystem_service': filesystem_service,
            'git_service': git_service
        }

    @pytest.mark.asyncio
    async def test_complete_user_setup_workflow(self, storage_services, temp_storage):
        """Test complete workflow from user creation to document operations."""
        user_service = storage_services['user_service']
        filesystem_service = storage_services['filesystem_service']
        git_service = storage_services['git_service']

        user_id = 123
        category_name = 'test-category'

        # Step 1: Create user directory structure
        success = await user_service.create_user_directory(user_id)
        assert success is True

        # Verify user directory exists
        user_dir = temp_storage / str(user_id)
        assert user_dir.exists()
        assert (user_dir / 'local').exists()
        assert (user_dir / 'github').exists()

        # Step 2: Initialize category repository
        success = await user_service.initialize_category_repo(user_id, category_name)
        assert success is True

        # Verify category repo exists
        category_dir = user_dir / 'local' / category_name
        assert category_dir.exists()
        assert (category_dir / '.git').exists()

        # Step 3: Create a document
        file_path = f"local/{category_name}/test-document.md"
        content = "# Test Document\n\nThis is test content."

        success = await filesystem_service.write_document(user_id, file_path, content)
        assert success is True

        # Verify document exists
        doc_file = user_dir / file_path
        assert doc_file.exists()

        # Step 4: Read document back
        read_content = await filesystem_service.read_document(user_id, file_path)
        assert read_content == content

        # Step 5: Verify git history
        history = await git_service.file_history(category_dir, "test-document.md")
        assert len(history) >= 1
        assert history[0].message == "Add test-document.md"

    @pytest.mark.asyncio
    async def test_document_movement_between_categories(self, storage_services, temp_storage):
        """Test moving documents between different categories."""
        user_service = storage_services['user_service']
        filesystem_service = storage_services['filesystem_service']

        user_id = 456
        source_category = 'source-category'
        target_category = 'target-category'

        # Setup user and categories
        await user_service.create_user_directory(user_id)
        await user_service.initialize_category_repo(user_id, source_category)
        await user_service.initialize_category_repo(user_id, target_category)

        # Create document in source category
        source_path = f"local/{source_category}/movable-doc.md"
        target_path = f"local/{target_category}/movable-doc.md"
        content = "# Movable Document\n\nThis will be moved."

        await filesystem_service.write_document(user_id, source_path, content)

        # Move document
        success = await filesystem_service.move_document(user_id, source_path, target_path)
        assert success is True

        # Verify move completed
        user_dir = temp_storage / str(user_id)
        source_file = user_dir / source_path
        target_file = user_dir / target_path

        assert not source_file.exists()
        assert target_file.exists()

        # Verify content preserved
        moved_content = await filesystem_service.read_document(user_id, target_path)
        assert moved_content == content

    @pytest.mark.asyncio
    async def test_github_repository_structure(self, storage_services, temp_storage):
        """Test GitHub repository cloning and organization."""
        user_service = storage_services['user_service']

        user_id = 789
        github_account_id = 42
        repo_name = 'test-repo'

        # Setup user directory
        await user_service.create_user_directory(user_id)

        # Clone GitHub repository (mocked)
        success = await user_service.clone_github_repo(user_id, github_account_id, repo_name)
        assert success is True

        # Verify GitHub repo structure
        user_dir = temp_storage / str(user_id)
        github_repo_dir = user_dir / 'github' / str(github_account_id) / repo_name
        assert github_repo_dir.exists()
        assert (github_repo_dir / '.git').exists()

    @pytest.mark.asyncio
    async def test_error_handling_and_rollback(self, storage_services, temp_storage):
        """Test error handling and proper cleanup on failures."""
        filesystem_service = storage_services['filesystem_service']

        user_id = 999

        # Test reading non-existent document
        content = await filesystem_service.read_document(user_id, "non-existent/path.md")
        assert content is None

        # Test writing to invalid path (should create directories)
        success = await filesystem_service.write_document(
            user_id,
            "local/new-category/deep/nested/doc.md",
            "# Test"
        )
        # This should succeed as it creates the directory structure
        assert success is True

        # Verify the nested structure was created
        user_dir = temp_storage / str(user_id)
        nested_file = user_dir / "local/new-category/deep/nested/doc.md"
        assert nested_file.exists()

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, storage_services, temp_storage):
        """Test handling of concurrent operations on the same user's storage."""
        filesystem_service = storage_services['filesystem_service']

        user_id = 888

        # Create multiple documents concurrently
        import asyncio

        async def create_doc(doc_num):
            path = f"local/concurrent-test/doc_{doc_num}.md"
            content = f"# Document {doc_num}\n\nContent for doc {doc_num}"
            return await filesystem_service.write_document(user_id, path, content)

        # Run concurrent operations
        tasks = [create_doc(i) for i in range(5)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All operations should succeed
        for result in results:
            assert result is True

        # Verify all documents exist
        user_dir = temp_storage / str(user_id)
        for i in range(5):
            doc_file = user_dir / f"local/concurrent-test/doc_{i}.md"
            assert doc_file.exists()


class TestGitIntegration:
    """Test git-specific integration scenarios."""

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
    def git_service(self, temp_storage):
        """Create a Git service instance."""
        return Git()

    @pytest.mark.asyncio
    async def test_git_repository_lifecycle(self, git_service, temp_storage):
        """Test complete git repository lifecycle."""
        repo_path = temp_storage / "test-repo"

        # Initialize repository
        success = await git_service.initialize(repo_path)
        assert success is True
        assert (repo_path / '.git').exists()

        # Create and commit a file
        test_file = repo_path / "test.md"
        test_file.write_text("# Test File\n\nInitial content")

        success = await git_service.commit(repo_path, "Initial commit", ["test.md"])
        assert success is True

        # Verify commit history
        history = await git_service.file_history(repo_path, "test.md")
        assert len(history) == 1
        assert history[0].message == "Initial commit"

        # Update file and commit again
        test_file.write_text("# Test File\n\nUpdated content")
        success = await git_service.commit(repo_path, "Update content", ["test.md"])
        assert success is True

        # Verify updated history
        history = await git_service.file_history(repo_path, "test.md")
        assert len(history) == 2
        assert history[0].message == "Update content"
        assert history[1].message == "Initial commit"
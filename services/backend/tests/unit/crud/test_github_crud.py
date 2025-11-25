"""Unit tests for GitHub CRUD operations."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.github_crud import GitHubCRUD
from app.models.github_models import GitHubAccount, GitHubRepository, GitHubSyncHistory
from app.models.user import User


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def github_crud():
    """Create GitHubCRUD instance."""
    return GitHubCRUD()


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return User(
        id=1,
        email="test@example.com",
        hashed_password="hashedpassword123",
        first_name="Test",
        last_name="User",
        is_active=True
    )


@pytest.fixture
def sample_github_account(sample_user):
    """Create a sample GitHub account for testing."""
    return GitHubAccount(
        id=1,
        user_id=sample_user.id,
        github_id=12345,
        username="testuser",
        display_name="Test User",
        avatar_url="https://github.com/avatar.jpg",
        access_token="test_token",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def sample_repository(sample_github_account):
    """Create a sample GitHub repository for testing."""
    return GitHubRepository(
        id=1,
        account_id=sample_github_account.id,
        github_repo_id=67890,
        repo_name="test-repo",
        repo_full_name="testuser/test-repo",
        repo_owner="testuser",
        description="A test repository",
        is_private=False,
        default_branch="main",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def sample_sync_history(sample_repository):
    """Create a sample sync history for testing."""
    return GitHubSyncHistory(
        id=1,
        repository_id=sample_repository.id,
        operation="import",
        status="success",
        commit_sha="abc123",
        branch_name="main",
        message="Import completed successfully",
        files_changed=5,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


class TestGitHubAccountCRUD:
    """Test GitHub Account CRUD operations."""

    async def test_create_account_success(self, github_crud, mock_db, sample_user, sample_github_account):
        """Test successful GitHub account creation."""
        account_data = {
            "user_id": sample_user.id,
            "github_id": 12345,
            "username": "testuser",
            "display_name": "Test User",
            "avatar_url": "https://github.com/avatar.jpg",
            "access_token": "test_token"
        }

        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with MagicMock() as mock_github_account:
            mock_github_account.return_value = sample_github_account
            result = await github_crud.create_account(mock_db, account_data)

            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            mock_db.refresh.assert_called_once()

    async def test_get_account_success(self, github_crud, mock_db, sample_github_account):
        """Test successful GitHub account retrieval."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_github_account
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_account(mock_db, account_id=1)

        assert result == sample_github_account
        mock_db.execute.assert_called_once()

    async def test_get_account_not_found(self, github_crud, mock_db):
        """Test GitHub account not found."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_account(mock_db, account_id=999)

        assert result is None
        mock_db.execute.assert_called_once()

    async def test_get_account_by_github_id_success(self, github_crud, mock_db, sample_github_account):
        """Test successful GitHub account retrieval by GitHub ID."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_github_account
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_account_by_github_id(mock_db, github_id=12345)

        assert result == sample_github_account
        mock_db.execute.assert_called_once()

    async def test_get_user_accounts_success(self, github_crud, mock_db, sample_github_account):
        """Test successful user accounts retrieval."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_github_account]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_user_accounts(mock_db, user_id=1)

        assert result == [sample_github_account]
        mock_db.execute.assert_called_once()

    async def test_get_user_accounts_empty(self, github_crud, mock_db):
        """Test user accounts retrieval with no accounts."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_user_accounts(mock_db, user_id=999)

        assert result == []
        mock_db.execute.assert_called_once()

    async def test_update_account_success(self, github_crud, mock_db, sample_github_account):
        """Test successful GitHub account update."""
        # Mock get_account to return existing account
        github_crud.get_account = AsyncMock(return_value=sample_github_account)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        account_data = {"display_name": "Updated User"}
        result = await github_crud.update_account(mock_db, account_id=1, account_data=account_data)

        assert result == sample_github_account
        assert sample_github_account.display_name == "Updated User"
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_update_account_not_found(self, github_crud, mock_db):
        """Test GitHub account update when account not found."""
        github_crud.get_account = AsyncMock(return_value=None)

        result = await github_crud.update_account(mock_db, account_id=999, account_data={"display_name": "Test"})

        assert result is None

    async def test_delete_account_success(self, github_crud, mock_db, sample_github_account):
        """Test successful GitHub account deletion."""
        github_crud.get_account = AsyncMock(return_value=sample_github_account)
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        result = await github_crud.delete_account(mock_db, account_id=1)

        assert result is True
        mock_db.delete.assert_called_once_with(sample_github_account)
        mock_db.commit.assert_called_once()

    async def test_delete_account_not_found(self, github_crud, mock_db):
        """Test GitHub account deletion when account not found."""
        github_crud.get_account = AsyncMock(return_value=None)

        result = await github_crud.delete_account(mock_db, account_id=999)

        assert result is False


class TestGitHubRepositoryCRUD:
    """Test GitHub Repository CRUD operations."""

    async def test_create_repository_success(self, github_crud, mock_db, sample_repository):
        """Test successful GitHub repository creation."""
        repository_data = {
            "account_id": 1,
            "github_repo_id": 67890,
            "repo_name": "test-repo",
            "repo_full_name": "testuser/test-repo",
            "repo_owner": "testuser",
            "description": "A test repository",
            "is_private": False,
            "default_branch": "main"
        }

        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with MagicMock() as mock_repository:
            mock_repository.return_value = sample_repository
            result = await github_crud.create_repository(mock_db, repository_data)

            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            mock_db.refresh.assert_called_once()

    async def test_get_repository_success(self, github_crud, mock_db, sample_repository):
        """Test successful GitHub repository retrieval."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_repository
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_repository(mock_db, repo_id=1)

        assert result == sample_repository
        mock_db.execute.assert_called_once()

    async def test_get_repository_by_github_id_success(self, github_crud, mock_db, sample_repository):
        """Test successful GitHub repository retrieval by GitHub ID."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_repository
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_repository_by_github_id(mock_db, github_repo_id=67890)

        assert result == sample_repository
        mock_db.execute.assert_called_once()

    async def test_get_account_repositories_success(self, github_crud, mock_db, sample_repository):
        """Test successful account repositories retrieval."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_repository]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_account_repositories(mock_db, account_id=1)

        assert result == [sample_repository]
        mock_db.execute.assert_called_once()

    async def test_update_repository_success(self, github_crud, mock_db, sample_repository):
        """Test successful GitHub repository update."""
        github_crud.get_repository = AsyncMock(return_value=sample_repository)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        repository_data = {"description": "Updated description"}
        result = await github_crud.update_repository(mock_db, repo_id=1, repo_data=repository_data)

        assert result == sample_repository
        assert sample_repository.description == "Updated description"
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_delete_repository_success(self, github_crud, mock_db, sample_repository):
        """Test successful GitHub repository deletion."""
        github_crud.get_repository = AsyncMock(return_value=sample_repository)
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        result = await github_crud.delete_repository(mock_db, repo_id=1)

        assert result is True
        mock_db.delete.assert_called_once_with(sample_repository)
        mock_db.commit.assert_called_once()


class TestGitHubSyncHistoryCRUD:
    """Test GitHub Sync History CRUD operations."""

    async def test_create_sync_history_success(self, github_crud, mock_db, sample_sync_history):
        """Test successful GitHub sync history creation."""
        sync_data = {
            "repository_id": 1,
            "operation": "import",
            "status": "success",
            "commit_sha": "abc123",
            "branch_name": "main"
        }

        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        with MagicMock() as mock_sync_history:
            mock_sync_history.return_value = sample_sync_history
            result = await github_crud.create_sync_history(mock_db, sync_data)

            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            mock_db.refresh.assert_called_once()

    async def test_get_repository_sync_history_success(self, github_crud, mock_db, sample_sync_history):
        """Test successful repository sync history retrieval."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_sync_history]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_repository_sync_history(mock_db, repo_id=1)

        assert result == [sample_sync_history]
        mock_db.execute.assert_called_once()

    async def test_get_document_sync_history_success(self, github_crud, mock_db, sample_sync_history):
        """Test successful document sync history retrieval."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_sync_history]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_document_sync_history(mock_db, document_id=1)

        assert result == [sample_sync_history]
        mock_db.execute.assert_called_once()

    async def test_get_repository_sync_history_empty(self, github_crud, mock_db):
        """Test repository sync history retrieval with no history."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await github_crud.get_repository_sync_history(mock_db, repo_id=999)

        assert result == []
        mock_db.execute.assert_called_once()
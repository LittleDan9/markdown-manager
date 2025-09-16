"""Unit tests for Document CRUD operations."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.document import DocumentCRUD
from app.models.document import Document
from app.models.category import Category
from app.models.user import User


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def document_crud():
    """Create DocumentCRUD instance."""
    return DocumentCRUD()


@pytest.fixture
def sample_category():
    """Create a sample category for testing."""
    return Category(
        id=1,
        name="work",
        user_id=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


@pytest.fixture
def sample_document(sample_category):
    """Create a sample document for testing."""
    doc = Document(
        id=1,
        name="Test Document",
        category_id=1,
        user_id=1,
        file_path="/test/doc.md",
        repository_type="local",
        folder_path="/",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    return doc


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    user = User(
        id=1,
        username="testuser",
        email="test@example.com",
        is_active=True
    )
    return user


class TestDocumentCRUD:
    """Test DocumentCRUD operations."""

    @pytest.mark.asyncio
    async def test_get_by_user_success(self, document_crud, mock_db, sample_document):
        """Test successful retrieval of documents by user."""
        # Mock database query result with category join
        mock_row = MagicMock()
        mock_row.Document = sample_document
        mock_row.category_name = "work"
        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([mock_row])
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.get_by_user(mock_db, user_id=1)

        # Assert results
        assert len(documents) == 1
        assert documents[0].name == "Test Document"
        assert documents[0].user_id == 1
        assert documents[0].category == "work"  # Category name added by CRUD
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_user_empty_result(self, document_crud, mock_db):
        """Test get_by_user with no documents."""
        # Mock empty result
        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([])
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.get_by_user(mock_db, user_id=1)

        # Assert empty result
        assert len(documents) == 0
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_user_and_category_success(self, document_crud, mock_db, sample_document):
        """Test successful retrieval of documents by user and category."""
        # Mock database query result with category join
        mock_row = MagicMock()
        mock_row.Document = sample_document
        mock_row.category_name = "work"
        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([mock_row])
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.get_by_user_and_category(
            mock_db, user_id=1, category="work"
        )

        # Assert results
        assert len(documents) == 1
        assert documents[0].name == "Test Document"
        assert documents[0].category == "work"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_document_success(self, document_crud, mock_db, sample_document, sample_category):
        """Test successful document creation."""
        # Mock category validation
        mock_category_result = MagicMock()
        mock_category_result.scalar_one_or_none.return_value = sample_category

        # Mock document creation
        mock_db.execute.return_value = mock_category_result
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Call method
        with patch('app.crud.document.Document', return_value=sample_document):
            result = await document_crud.create(
                mock_db,
                user_id=1,
                name="New Document",
                category_id=1,
                content="Test content",
                file_path="/test/new.md"
            )

        # Assert document creation
        assert result.name == "Test Document"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(sample_document)

    @pytest.mark.asyncio
    async def test_create_document_invalid_category(self, document_crud, mock_db):
        """Test document creation with invalid category."""
        # Mock category validation failure
        mock_category_result = MagicMock()
        mock_category_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_category_result

        # Call method and expect ValueError
        with pytest.raises(ValueError, match="Category with ID 999 not found for user"):
            await document_crud.create(
                mock_db,
                user_id=1,
                name="New Document",
                category_id=999,
                content="Test content"
            )

    @pytest.mark.asyncio
    async def test_update_document_success(self, document_crud, mock_db, sample_document):
        """Test successful document update."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        # Call method
        result = await document_crud.update(
            mock_db,
            document_id=1,
            user_id=1,
            name="Updated Document",
            content="Updated content"
        )

        # Assert document update
        assert result is not None
        assert result.name == "Updated Document"
        assert result.content == "Updated content"
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_document_not_found(self, document_crud, mock_db):
        """Test document update when document doesn't exist."""
        # Mock no document found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Call method
        result = await document_crud.update(
            mock_db,
            document_id=999,
            user_id=1,
            name="Updated Document"
        )

        # Assert no update
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_document_success(self, document_crud, mock_db, sample_document):
        """Test successful document deletion."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        # Call method
        result = await document_crud.delete(mock_db, document_id=1, user_id=1)

        # Assert deletion
        assert result is True
        mock_db.delete.assert_called_once_with(sample_document)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_document_not_found(self, document_crud, mock_db):
        """Test document deletion when document doesn't exist."""
        # Mock no document found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Call method
        result = await document_crud.delete(mock_db, document_id=999, user_id=1)

        # Assert no deletion
        assert result is False

    @pytest.mark.asyncio
    async def test_get_document_by_id(self, document_crud, mock_db, sample_document):
        """Test getting document by ID."""
        # Mock database query result with proper result structure
        mock_result = MagicMock()
        mock_result.first.return_value = MagicMock(Document=sample_document, category_name="work")
        mock_db.execute.return_value = mock_result

        # Call method
        result = await document_crud.get(mock_db, id=1)

        # Assert document retrieval
        assert result is not None
        assert result.name == "Test Document"
        assert result.category == "work"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_document_by_id_not_found(self, document_crud, mock_db):
        """Test getting document by ID when not found."""
        # Mock no document found
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute.return_value = mock_result

        # Call method
        result = await document_crud.get(mock_db, id=999)

        # Assert no document found
        assert result is None

    @pytest.mark.asyncio
    async def test_get_categories_by_user(self, document_crud, mock_db, sample_category):
        """Test getting categories for a user."""
        # Create mock category objects with name attribute
        mock_category = MagicMock()
        mock_category.name = "work"

        # Mock the get_user_categories function from category module
        with patch('app.crud.category.get_user_categories') as mock_get_categories:
            mock_get_categories.return_value = [mock_category]

            # Call method
            categories = await document_crud.get_categories_by_user(mock_db, user_id=1)

            # Assert categories
            assert len(categories) == 1
            assert categories[0] == "work"
            mock_get_categories.assert_called_once_with(mock_db, 1)

    @pytest.mark.asyncio
    async def test_get_documents_by_folder_path(self, document_crud, mock_db, sample_document):
        """Test getting documents by folder path."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_document]
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.get_documents_by_folder_path(
            mock_db, user_id=1, folder_path="/test"
        )

        # Assert results
        assert len(documents) == 1
        assert documents[0].folder_path == "/"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_recent_documents(self, document_crud, mock_db, sample_document):
        """Test getting recent documents."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_document]
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.get_recent_documents(mock_db, user_id=1, limit=5)

        # Assert results
        assert len(documents) == 1
        assert documents[0].name == "Test Document"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_mark_document_opened(self, document_crud, mock_db, sample_document):
        """Test marking document as opened."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        # Call method
        await document_crud.mark_document_opened(mock_db, document_id=1, user_id=1)

        # Assert last_opened_at was updated
        assert sample_document.last_opened_at is not None
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_documents_success(self, document_crud, mock_db, sample_document):
        """Test successful document search."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_document]
        mock_db.execute.return_value = mock_result

        # Call method - search_documents doesn't use content field
        documents = await document_crud.search_documents(
            mock_db, user_id=1, query="test"
        )

        # Assert search results
        assert len(documents) == 1
        assert documents[0].name == "Test Document"
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_documents_empty_query(self, document_crud, mock_db):
        """Test document search with empty query."""
        # Mock empty result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # Call method
        documents = await document_crud.search_documents(
            mock_db, user_id=1, query=""
        )

        # Assert empty results
        assert len(documents) == 0

    @pytest.mark.asyncio
    async def test_move_document_to_folder(self, document_crud, mock_db, sample_document):
        """Test moving document to different folder."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        # Call method
        result = await document_crud.move_document_to_folder(
            mock_db, document_id=1, user_id=1, new_folder_path="/new"
        )

        # Assert document move
        assert result is not None
        assert result.folder_path == "/new"
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_enable_sharing(self, document_crud, mock_db, sample_document):
        """Test enabling document sharing."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Call method
        result = await document_crud.enable_sharing(
            mock_db, document_id=1, user_id=1
        )

        # Assert sharing enabled - returns token string
        assert result is not None
        assert isinstance(result, str)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_disable_sharing(self, document_crud, mock_db, sample_document):
        """Test disabling document sharing."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_document
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        # Call method
        result = await document_crud.disable_sharing(
            mock_db, document_id=1, user_id=1
        )

        # Assert sharing disabled - returns boolean
        assert result is True
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_folder_structure(self, document_crud, mock_db):
        """Test getting folder structure for user."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = ["/", "/docs", "/notes"]
        mock_db.execute.return_value = mock_result

        # Call method
        structure = await document_crud.get_folder_structure(mock_db, user_id=1)

        # Assert folder structure
        assert isinstance(structure, dict)
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_folder_stats(self, document_crud, mock_db):
        """Test getting folder statistics for user."""
        # Mock database query result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [("/", 5), ("/docs", 3)]
        mock_db.execute.return_value = mock_result

        # Call method
        stats = await document_crud.get_folder_stats(mock_db, user_id=1)

        # Assert folder stats
        assert isinstance(stats, dict)
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_document_in_folder(self, document_crud, mock_db, sample_document):
        """Test creating document in specific folder."""
        # Mock database operations
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # No existing document
        mock_db.execute.return_value = mock_result
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Call method with correct signature
        result = await document_crud.create_document_in_folder(
            mock_db,
            user_id=1,
            name="New Doc",
            content="Content",
            folder_path="/docs"
        )

        # Assert document creation
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

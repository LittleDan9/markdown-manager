"""Tests for folder-based document API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.user import User


class TestFolderAPI:
    """Test class for folder-based document operations."""

    def test_get_folder_structure(self, client: TestClient, auth_headers: dict):
        """Test folder structure endpoint."""
        response = client.get("/documents/folders", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "tree" in data
        assert "total_folders" in data
        assert "user_id" in data
        assert isinstance(data["tree"], dict)
        assert isinstance(data["total_folders"], int)

    def test_get_documents_in_folder(self, client: TestClient, auth_headers: dict):
        """Test getting documents in a specific folder."""
        # Test with a standard folder path
        response = client.get("/documents/folders/Work", headers=auth_headers)
        assert response.status_code == 200

        documents = response.json()
        assert isinstance(documents, list)

        # All documents should be in the Work folder
        for doc in documents:
            assert doc["folder_path"].startswith("/Work")

    def test_get_documents_in_folder_with_subfolders(self, client: TestClient, auth_headers: dict):
        """Test getting documents with subfolder inclusion."""
        response = client.get(
            "/documents/folders/Work",
            params={"include_subfolders": True},
            headers=auth_headers
        )
        assert response.status_code == 200

        documents = response.json()
        assert isinstance(documents, list)

    def test_create_folder(self, client: TestClient, auth_headers: dict):
        """Test creating a virtual folder."""
        folder_data = {
            "path": "/Projects/TestProject"
        }

        response = client.post(
            "/documents/folders",
            json=folder_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["folder_path"] == "/Projects/TestProject"
        assert "exists" in data
        assert "document_count" in data

    def test_create_folder_validation(self, client: TestClient, auth_headers: dict):
        """Test folder creation validation."""
        # Test invalid folder path
        folder_data = {
            "path": "/"
        }

        response = client.post(
            "/documents/folders",
            json=folder_data,
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_create_document_with_folder(self, client: TestClient, auth_headers: dict):
        """Test creating document with folder path."""
        document_data = {
            "name": "test-folder-doc.md",
            "content": "# Test Document",
            "folder_path": "/Projects/TestProject"
        }

        response = client.post(
            "/documents/",
            json=document_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        doc = response.json()
        assert doc["folder_path"] == "/Projects/TestProject"
        assert doc["name"] == "test-folder-doc.md"

    def test_create_document_duplicate_in_folder(self, client: TestClient, auth_headers: dict):
        """Test creating duplicate document in same folder."""
        document_data = {
            "name": "duplicate-test.md",
            "content": "# Test Document",
            "folder_path": "/Test"
        }

        # Create first document
        response1 = client.post(
            "/documents/",
            json=document_data,
            headers=auth_headers
        )
        assert response1.status_code == 200

        # Try to create duplicate
        response2 = client.post(
            "/documents/",
            json=document_data,
            headers=auth_headers
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]

    @pytest.mark.asyncio
    async def test_move_document(
        self,
        client: TestClient,
        auth_headers: dict,
        async_db: AsyncSession,
        test_user: User
    ):
        """Test moving document to different folder."""
        # Create a test document first
        document = Document(
            name="move-test.md",
            content="# Test Content",
            folder_path="/Original",
            user_id=test_user.id
        )
        async_db.add(document)
        await async_db.commit()
        await async_db.refresh(document)

        move_data = {
            "new_folder_path": "/Archive"
        }

        response = client.put(
            f"/documents/{document.id}/move",
            json=move_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        doc = response.json()
        assert doc["folder_path"] == "/Archive"

    def test_move_nonexistent_document(self, client: TestClient, auth_headers: dict):
        """Test moving a document that doesn't exist."""
        move_data = {
            "new_folder_path": "/Archive"
        }

        response = client.put(
            "/documents/99999/move",
            json=move_data,
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_search_documents(self, client: TestClient, auth_headers: dict):
        """Test document search without folder filter."""
        response = client.get(
            "/documents/search",
            params={"q": "test"},
            headers=auth_headers
        )
        assert response.status_code == 200

        documents = response.json()
        assert isinstance(documents, list)

    def test_search_documents_with_folder_filter(self, client: TestClient, auth_headers: dict):
        """Test document search with folder filtering."""
        response = client.get(
            "/documents/search",
            params={"q": "test", "folder_path": "/Work"},
            headers=auth_headers
        )
        assert response.status_code == 200

        documents = response.json()
        assert isinstance(documents, list)

        # All results should be in Work folder or subfolders
        for doc in documents:
            assert doc["folder_path"].startswith("/Work")

    def test_search_documents_invalid_query(self, client: TestClient, auth_headers: dict):
        """Test search with invalid query."""
        response = client.get(
            "/documents/search",
            params={"q": ""},  # Empty query
            headers=auth_headers
        )
        assert response.status_code == 422  # Validation error

    def test_get_documents_with_folder_filter(self, client: TestClient, auth_headers: dict):
        """Test the enhanced get_documents endpoint with folder filtering."""
        response = client.get(
            "/documents/",
            params={"folder_path": "/Work"},
            headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert "documents" in data
        assert "total" in data
        assert "categories" in data

        # All documents should be in Work folder
        for doc in data["documents"]:
            assert doc["folder_path"].startswith("/Work")

    def test_get_documents_backward_compatibility(self, client: TestClient, auth_headers: dict):
        """Test that category filtering still works."""
        response = client.get(
            "/documents/",
            params={"category": "General"},
            headers=auth_headers
        )
        assert response.status_code == 200

        data = response.json()
        assert "documents" in data
        assert "categories" in data


@pytest.fixture
async def test_documents(async_db: AsyncSession, test_user: User):
    """Create test documents in various folders."""
    documents = [
        Document(
            name="work-doc.md",
            content="# Work Document",
            folder_path="/Work",
            user_id=test_user.id
        ),
        Document(
            name="project-doc.md",
            content="# Project Document",
            folder_path="/Work/Projects",
            user_id=test_user.id
        ),
        Document(
            name="personal-doc.md",
            content="# Personal Document",
            folder_path="/Personal",
            user_id=test_user.id
        ),
    ]

    for doc in documents:
        async_db.add(doc)

    await async_db.commit()

    for doc in documents:
        await async_db.refresh(doc)

    return documents

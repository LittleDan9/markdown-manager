"""Unit tests for document CRUD router endpoints."""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import status

from app.models.user import User
from app.models.document import Document
from app.models.category import Category


class TestDocumentCrudRouter:
    """Test document CRUD router endpoints."""

    @pytest.mark.asyncio
    async def test_get_document_success(self, auth_client: AsyncClient, sample_user: User, sample_document: Document):
        """Test successful document retrieval."""
        with patch('app.crud.document.document.get') as mock_get, \
             patch('app.routers.documents.crud.create_document_response') as mock_response:

            mock_get.return_value = sample_document
            mock_response.return_value = {
                "id": sample_document.id,
                "name": sample_document.name,
                "content": "Test content",
                "file_path": sample_document.file_path,
                "category_id": sample_document.category_id,
                "user_id": sample_document.user_id
            }

            response = await auth_client.get(f"/api/documents/{sample_document.id}")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == sample_document.id
            assert data["name"] == sample_document.name
            mock_get.assert_called_once()
            mock_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_document_not_found(self, auth_client: AsyncClient):
        """Test document not found."""
        with patch('app.crud.document.document.get') as mock_get:
            mock_get.return_value = None

            response = await auth_client.get("/api/documents/999")

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert response.json()["detail"] == "Document not found"

    @pytest.mark.asyncio
    async def test_get_document_unauthorized(self, auth_client: AsyncClient, sample_user: User):
        """Test unauthorized document access."""
        other_user_document = Document(
            id=999,
            name="Other Document",
            user_id=999,  # Different user
            category_id=1,
            file_path="other/doc.md"
        )

        with patch('app.crud.document.document.get') as mock_get:
            mock_get.return_value = other_user_document

            response = await auth_client.get("/api/documents/999")

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert response.json()["detail"] == "Document not found"

    @pytest.mark.asyncio
    async def test_update_document_content_helper(self):
        """Test document content update helper function."""
        from app.routers.documents.crud import _update_document_content

        document = Document(
            id=1,
            name="Test Doc",
            file_path="test/doc.md",
            user_id=1,
            category_id=1
        )

        mock_storage = AsyncMock()
        mock_storage.write_document.return_value = True

        result = await _update_document_content(
            document=document,
            storage_service=mock_storage,
            user_id=1,
            new_content="Updated content"
        )

        assert result is True
        mock_storage.write_document.assert_called_once_with(
            user_id=1,
            file_path="test/doc.md",
            content="Updated content",
            commit_message="Update content: Test Doc",
            auto_commit=True
        )

    @pytest.mark.asyncio
    async def test_update_document_content_no_file_path(self):
        """Test document content update with no file path."""
        from app.routers.documents.crud import _update_document_content

        document = Document(
            id=1,
            name="Test Doc",
            file_path=None,  # No file path
            user_id=1,
            category_id=1
        )

        mock_storage = AsyncMock()

        result = await _update_document_content(
            document=document,
            storage_service=mock_storage,
            user_id=1,
            new_content="Updated content"
        )

        # Should return None/False when no file path
        assert result is None or result is False
        mock_storage.write_document.assert_not_called()
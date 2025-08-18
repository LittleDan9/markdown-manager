"""
Simple E2E tests for production API.
Tests key endpoints in logical order and cleans up via API.
"""
from typing import Dict

import httpx


class TestProductionAPI:
    """Test core API functionality against production"""

    async def test_health_check(self, unauthenticated_client: httpx.AsyncClient):
        """Test basic health endpoint"""
        response = await unauthenticated_client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()

    async def test_auth_me(self, authenticated_client: httpx.AsyncClient):
        """Test authenticated user profile access"""
        response = await authenticated_client.get("/auth/me")
        assert response.status_code == 200
        user_data = response.json()
        assert "email" in user_data
        assert "@example.com" in user_data["email"]

    async def test_categories_list(self, authenticated_client: httpx.AsyncClient):
        """Test categories listing"""
        response = await authenticated_client.get("/categories/")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)

    async def test_categories_stats(self, authenticated_client: httpx.AsyncClient):
        """Test categories statistics"""
        response = await authenticated_client.get("/categories/stats")
        assert response.status_code == 200
        stats = response.json()
        assert isinstance(stats, (list, dict))

    async def test_dictionary_access(self, authenticated_client: httpx.AsyncClient):
        """Test dictionary endpoint"""
        response = await authenticated_client.get("/dictionary/")
        assert response.status_code == 200
        dictionary = response.json()
        assert isinstance(dictionary, list)

    async def test_documents_list(self, authenticated_client: httpx.AsyncClient):
        """Test documents listing"""
        response = await authenticated_client.get("/documents/")
        assert response.status_code == 200
        doc_response = response.json()
        assert isinstance(doc_response, dict)
        assert "documents" in doc_response
        assert isinstance(doc_response["documents"], list)

    async def test_document_lifecycle(self, authenticated_client: httpx.AsyncClient):
        """Test complete document CRUD operations"""
        # Create document
        doc_data = {
            "name": "E2E Test Document",
            "content": "# Test Content\n\nThis is a test document for E2E testing.",
            "category": "General",
        }

        response = await authenticated_client.post("/documents/", json=doc_data)
        assert response.status_code in [200, 201]
        created_doc = response.json()
        doc_id = created_doc["id"]

        # Read document
        response = await authenticated_client.get(f"/documents/{doc_id}")
        assert response.status_code == 200
        retrieved_doc = response.json()
        assert retrieved_doc["name"] == doc_data["name"]

        # Update document
        update_data = {
            "name": "Updated E2E Test Document",
            "content": "# Updated Content\n\nThis document has been updated.",
            "category": "General",
        }
        response = await authenticated_client.put(
            f"/documents/{doc_id}", json=update_data
        )
        assert response.status_code == 200

        # Verify update
        response = await authenticated_client.get(f"/documents/{doc_id}")
        assert response.status_code == 200
        updated_doc = response.json()
        assert updated_doc["name"] == update_data["name"]

        # Delete document
        response = await authenticated_client.delete(f"/documents/{doc_id}")
        assert response.status_code == 200

        # Verify deletion
        response = await authenticated_client.get(f"/documents/{doc_id}")
        assert response.status_code == 404

    async def test_highlight_languages(self, authenticated_client: httpx.AsyncClient):
        """Test syntax highlighting languages"""
        response = await authenticated_client.get("/highlight/languages")
        assert response.status_code == 200
        lang_response = response.json()
        assert isinstance(lang_response, dict)
        assert "languages" in lang_response
        assert isinstance(lang_response["languages"], dict)
        # Should have many languages
        assert len(lang_response["languages"]) > 100

    async def test_user_profile(self, authenticated_client: httpx.AsyncClient):
        """Test user profile access"""
        response = await authenticated_client.get("/users/profile")
        assert response.status_code == 200
        profile = response.json()
        assert "email" in profile


class TestCleanup:
    """Test cleanup - this runs last to clean up the test user"""

    async def test_delete_user_cleanup(
        self, authenticated_client: httpx.AsyncClient, test_user: Dict[str, str]
    ):
        """Delete the test user to clean up all artifacts"""
        # This should cascade delete all user-related data
        response = await authenticated_client.delete("/users/account")
        assert response.status_code == 200

        print(f"🧹 Cleaned up test user: {test_user['email']}")

        # Verify user is deleted by trying to access profile
        response = await authenticated_client.get("/auth/me")
        assert response.status_code == 401  # Should be unauthorized now

"""Simple category CRUD tests to demonstrate Phase 6.5 coverage improvement."""
import pytest


class TestCategoryCRUD:
    """Test category CRUD operations through API endpoints."""

    @pytest.mark.asyncio
    async def test_create_category_valid_data(self, client, auth_headers):
        """Test creating a category with valid data."""
        category_data = {"name": "Test Category"}

        response = await client.post("/categories", json=category_data, headers=auth_headers)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Category"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_category_strips_whitespace(self, client, auth_headers):
        """Test that category creation strips whitespace."""
        category_data = {"name": "  Whitespace Category  "}

        response = await client.post("/categories", json=category_data, headers=auth_headers)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Whitespace Category"

    @pytest.mark.asyncio
    async def test_create_category_unauthorized(self, client):
        """Test creating a category without authentication."""
        category_data = {"name": "Test Category"}

        response = await client.post("/categories", json=category_data)

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_categories_empty(self, client, auth_headers):
        """Test getting categories when user has none."""
        response = await client.get("/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_categories_multiple(self, client, auth_headers):
        """Test getting multiple categories, ordered by name."""
        categories = ["Zebra", "Alpha", "Beta"]

        for name in categories:
            category_data = {"name": name}
            response = await client.post(
                "/categories", json=category_data, headers=auth_headers
            )
            assert response.status_code == 201

        response = await client.get("/categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert len(data) >= 3
        names = [c["name"] for c in data]
        assert "Alpha" in names
        assert "Beta" in names
        assert "Zebra" in names

    @pytest.mark.asyncio
    async def test_get_category_by_id_exists(self, client, auth_headers):
        """Test getting a specific category by ID."""
        category_data = {"name": "Test Category By ID"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        category_id = response.json()["id"]

        response = await client.get(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category_id
        assert data["name"] == "Test Category By ID"

    @pytest.mark.asyncio
    async def test_get_category_by_id_not_found(self, client, auth_headers):
        """Test getting a category that doesn't exist."""
        response = await client.get("/categories/99999", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_category_valid_data(self, client, auth_headers):
        """Test updating a category with valid data."""
        category_data = {"name": "Original Name"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        category_id = response.json()["id"]

        update_data = {"name": "Updated Name"}
        response = await client.put(
            f"/categories/{category_id}", json=update_data, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category_id
        assert data["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_category_not_found(self, client, auth_headers):
        """Test updating a category that doesn't exist."""
        update_data = {"name": "New Name"}
        response = await client.put(
            "/categories/99999", json=update_data, headers=auth_headers
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_category_exists(self, client, auth_headers):
        """Test deleting a category that exists."""
        category_data = {"name": "To Delete"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        category_id = response.json()["id"]

        response = await client.delete(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200

        response = await client.get(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_category_not_found(self, client, auth_headers):
        """Test deleting a category that doesn't exist."""
        response = await client.delete("/categories/99999", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_categories_unauthorized(self, client):
        """Test getting categories without authentication."""
        response = await client.get("/categories")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_category_by_id_unauthorized(self, client):
        """Test getting a category by ID without authentication."""
        response = await client.get("/categories/1")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_category_unauthorized(self, client):
        """Test updating a category without authentication."""
        update_data = {"name": "New Name"}
        response = await client.put("/categories/1", json=update_data)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_category_unauthorized(self, client):
        """Test deleting a category without authentication."""
        response = await client.delete("/categories/1")
        assert response.status_code == 403

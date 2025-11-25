"""Integration tests for category endpoints."""
import pytest


@pytest.mark.asyncio
class TestCategoryEndpoints:
    """Test category API endpoints with real database."""

    async def test_create_category(self, async_client, authenticated_user_data):
        """Test creating a category."""
        token, user_data = authenticated_user_data
        headers = {"Authorization": f"Bearer {token}"}

        category_data = {
            "name": "Test Category"
        }

        response = await async_client.post("/categories", json=category_data, headers=headers)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == category_data["name"]
        assert data["user_id"] == user_data["id"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_categories(self, async_client, authenticated_user_data):
        """Test getting user's categories."""
        token, user_data = authenticated_user_data
        headers = {"Authorization": f"Bearer {token}"}

        # Get initial categories (should include "General" and "Drafts" defaults)
        initial_response = await async_client.get("/categories", headers=headers)
        assert initial_response.status_code == 200
        initial_categories = initial_response.json()
        initial_count = len(initial_categories)

        # Create a few categories
        categories_to_create = [
            {"name": "Category 1"},
            {"name": "Category 2"},
            {"name": "Category 3"}
        ]

        created_categories = []
        for cat_data in categories_to_create:
            response = await async_client.post("/categories", json=cat_data, headers=headers)
            assert response.status_code == 201
            created_categories.append(response.json())

        # Get all categories
        response = await async_client.get("/categories", headers=headers)
        assert response.status_code == 200

        data = response.json()
        # Should have initial categories plus the 3 we created
        assert len(data) == initial_count + 3

        # Verify the categories we created are present
        created_names = {cat["name"] for cat in created_categories}
        returned_names = {cat["name"] for cat in data}
        assert created_names.issubset(returned_names)

    async def test_get_category_by_id(self, async_client, authenticated_user_data):
        """Test getting a specific category by ID."""
        token, user_data = authenticated_user_data
        headers = {"Authorization": f"Bearer {token}"}

        # Create a category
        category_data = {"name": "Test Category"}
        create_response = await async_client.post("/categories", json=category_data, headers=headers)
        assert create_response.status_code == 201
        created_category = create_response.json()

        # Get the category by ID
        response = await async_client.get(f"/categories/{created_category['id']}", headers=headers)
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == created_category["id"]
        assert data["name"] == category_data["name"]

    async def test_update_category(self, async_client, authenticated_user_data):
        """Test updating a category."""
        token, user_data = authenticated_user_data
        headers = {"Authorization": f"Bearer {token}"}

        # Create a category
        category_data = {"name": "Original Name"}
        create_response = await async_client.post("/categories", json=category_data, headers=headers)
        assert create_response.status_code == 201
        created_category = create_response.json()

        # Update the category
        update_data = {"name": "Updated Name"}
        response = await async_client.put(
            f"/categories/{created_category['id']}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == created_category["id"]
        assert data["name"] == update_data["name"]
        assert data["updated_at"] != created_category["updated_at"]

    async def test_delete_category(self, async_client, authenticated_user_data):
        """Test deleting a category."""
        token, user_data = authenticated_user_data
        headers = {"Authorization": f"Bearer {token}"}

        # Create a category
        category_data = {"name": "To Delete"}
        create_response = await async_client.post("/categories", json=category_data, headers=headers)
        assert create_response.status_code == 201
        created_category = create_response.json()

        # Delete the category
        response = await async_client.delete(f"/categories/{created_category['id']}", headers=headers)
        assert response.status_code == 200

        # Verify it's deleted by trying to get it
        get_response = await async_client.get(f"/categories/{created_category['id']}", headers=headers)
        assert get_response.status_code == 404

    async def test_category_access_forbidden(self, async_client, test_user_data):
        """Test that users cannot access other users' categories."""
        # Create two users
        user1_data = test_user_data.copy()
        user2_data = test_user_data.copy()
        user2_data["email"] = "user2@example.com"

        # Register both users
        await async_client.post("/auth/register", json=user1_data)
        await async_client.post("/auth/register", json=user2_data)

        # Login as user1 and create a category
        login1 = await async_client.post("/auth/login", json={
            "email": user1_data["email"],
            "password": user1_data["password"]
        })
        token1 = login1.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}

        category_response = await async_client.post(
            "/categories",
            json={"name": "User1 Category"},
            headers=headers1
        )
        assert category_response.status_code == 201
        category = category_response.json()

        # Login as user2 and try to access user1's category
        login2 = await async_client.post("/auth/login", json={
            "email": user2_data["email"],
            "password": user2_data["password"]
        })
        token2 = login2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        # Try to get user1's category as user2
        response = await async_client.get(f"/categories/{category['id']}", headers=headers2)
        assert response.status_code in [403, 404]  # Forbidden or Not Found

    async def test_create_category_unauthorized(self, async_client):
        """Test creating category without authentication."""
        category_data = {"name": "Test Category"}
        response = await async_client.post("/categories", json=category_data)
        assert response.status_code == 403

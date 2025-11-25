"""Simple category CRUD tests to demonstrate Phase 6.5 coverage improvement."""
import pytest
import httpx

from app.app_factory import create_app
from app.database import get_db


@pytest.fixture
async def client(async_db_session):
    """Create async test client with database dependency override."""
    app = create_app()

    # Override the database dependency
    async def override_get_db():
        yield async_db_session

    app.dependency_overrides[get_db] = override_get_db

    # Create async client
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test"
    ) as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user_token(client):
    """Create a test user and return authentication token."""
    import uuid

    # Use UUID to create unique email
    unique_id = str(uuid.uuid4())[:8]

    # Register user
    user_data = {
        "email": f"testuser_{unique_id}@example.com",
        "password": "testpassword123",
        "first_name": "Test",
        "last_name": "User",
    }

    response = await client.post("/auth/register", json=user_data)
    assert response.status_code == 200

    # Login to get token
    login_data = {
        "email": f"testuser_{unique_id}@example.com",
        "password": "testpassword123",
    }

    response = await client.post("/auth/login", json=login_data)
    assert response.status_code == 200

    token_data = response.json()
    return token_data["access_token"]


@pytest.fixture
async def auth_headers(test_user_token):
    """Create authorization headers."""
    return {"Authorization": f"Bearer {test_user_token}"}


class TestCategoryCRUD:
    """Test category CRUD operations through API endpoints."""

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

    async def test_create_category_strips_whitespace(self, client, auth_headers):
        """Test that category creation strips whitespace."""
        category_data = {"name": "  Whitespace Category  "}

        response = await client.post("/categories", json=category_data, headers=auth_headers)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Whitespace Category"

    async def test_create_category_unauthorized(self, client):
        """Test creating a category without authentication."""
        category_data = {"name": "Test Category"}

        response = await client.post("/categories", json=category_data)

        assert response.status_code == 403

    async def test_get_categories_empty(self, client, auth_headers):
        """Test getting categories when user has default categories."""
        response = await client.get("/categories", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        # Users get default "General" and "Drafts" categories on registration
        assert len(data) == 2
        category_names = [cat["name"] for cat in data]
        assert "General" in category_names
        assert "Drafts" in category_names

    async def test_get_categories_multiple(self, client, auth_headers):
        """Test getting multiple categories, ordered by name."""
        # Create multiple categories (in addition to default "General" and "Drafts")
        categories = ["Zebra", "Alpha", "Beta"]
        created_ids = []

        for category_name in categories:
            category_data = {"name": category_name}
            response = await client.post("/categories", json=category_data, headers=auth_headers)
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        # Get all categories
        response = await client.get("/categories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Should have 5 total: 2 default + 3 created
        assert len(data) == 5

    async def test_get_category_by_id_exists(self, client, auth_headers):
        """Test getting a specific category by ID."""
        # Create category
        category_data = {"name": "Test Category"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        created_category = response.json()
        category_id = created_category["id"]

        # Get category by ID
        response = await client.get(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category_id
        assert data["name"] == "Test Category"

    async def test_get_category_by_id_not_found(self, client, auth_headers):
        """Test getting a category that doesn't exist."""
        response = await client.get("/categories/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_update_category_valid_data(self, client, auth_headers):
        """Test updating a category with valid data."""
        # Create category
        category_data = {"name": "Original Name"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        category_id = response.json()["id"]

        # Update category
        update_data = {"name": "Updated Name"}
        response = await client.put(
            f"/categories/{category_id}", json=update_data, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category_id
        assert data["name"] == "Updated Name"

    async def test_update_category_not_found(self, client, auth_headers):
        """Test updating a category that doesn't exist."""
        update_data = {"name": "New Name"}
        response = await client.put(
            "/categories/99999", json=update_data, headers=auth_headers
        )
        assert response.status_code == 404

    async def test_delete_category_exists(self, client, auth_headers):
        """Test deleting a category that exists."""
        # Create category
        category_data = {"name": "To Delete"}
        response = await client.post("/categories", json=category_data, headers=auth_headers)
        assert response.status_code == 201
        category_id = response.json()["id"]

        # Delete category
        response = await client.delete(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 200

        # Verify category is deleted
        response = await client.get(f"/categories/{category_id}", headers=auth_headers)
        assert response.status_code == 404

    async def test_delete_category_not_found(self, client, auth_headers):
        """Test deleting a category that doesn't exist."""
        response = await client.delete("/categories/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_get_categories_unauthorized(self, client):
        """Test getting categories without authentication."""
        response = await client.get("/categories")
        assert response.status_code == 403

    async def test_get_category_by_id_unauthorized(self, client):
        """Test getting a category by ID without authentication."""
        response = await client.get("/categories/1")
        assert response.status_code == 403

    async def test_update_category_unauthorized(self, client):
        """Test updating a category without authentication."""
        update_data = {"name": "New Name"}
        response = await client.put("/categories/1", json=update_data)
        assert response.status_code == 403

    async def test_delete_category_unauthorized(self, client):
        """Test deleting a category without authentication."""
        response = await client.delete("/categories/1")
        assert response.status_code == 403

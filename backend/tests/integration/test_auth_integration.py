"""Integration tests for authentication endpoints."""
import pytest


@pytest.mark.asyncio
class TestAuthenticationEndpoints:
    """Test authentication API endpoints with real database."""

    async def test_register_user(self, async_client, test_user_data):
        """Test user registration endpoint."""
        response = await async_client.post("/auth/register", json=test_user_data)
        assert response.status_code == 200

        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["first_name"] == test_user_data["first_name"]
        assert data["last_name"] == test_user_data["last_name"]
        assert data["display_name"] == test_user_data["display_name"]
        assert data["is_active"] is True
        assert "id" in data
        assert "hashed_password" not in data

    async def test_register_duplicate_email(self, async_client, test_user_data):
        """Test registering with duplicate email."""
        # Register first user
        response1 = await async_client.post("/auth/register", json=test_user_data)
        assert response1.status_code == 200

        # Try to register with same email
        response2 = await async_client.post("/auth/register", json=test_user_data)
        assert response2.status_code == 400
        assert "Email already registered" in response2.json()["detail"]

    async def test_login_user(self, async_client, test_user_data):
        """Test user login."""
        # First register a user
        register_response = await async_client.post("/auth/register", json=test_user_data)
        assert register_response.status_code == 200

        # Now login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }

        response = await async_client.post("/auth/login", json=login_data)
        assert response.status_code == 200

        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data

    async def test_login_invalid_credentials(self, async_client):
        """Test login with invalid credentials."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }

        response = await async_client.post("/auth/login", json=login_data)
        assert response.status_code == 401

    async def test_get_current_user(self, async_client, test_user_data):
        """Test getting current user profile."""
        # Register and login to get token
        await async_client.post("/auth/register", json=test_user_data)

        login_response = await async_client.post("/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })

        token = login_response.json()["access_token"]

        # Get current user profile
        headers = {"Authorization": f"Bearer {token}"}
        response = await async_client.get("/auth/me", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["first_name"] == test_user_data["first_name"]
        assert data["last_name"] == test_user_data["last_name"]

    async def test_get_current_user_invalid_token(self, async_client):
        """Test getting current user with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = await async_client.get("/auth/me", headers=headers)

        assert response.status_code == 401

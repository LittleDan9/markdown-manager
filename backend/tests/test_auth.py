"""Test user authentication endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.app_factory import AppFactory
from app.database import get_db


@pytest.fixture
def test_app(test_db):
    """Create test app with test database."""
    app_factory = AppFactory()
    app = app_factory.create_app()

    # Override the database dependency
    async def get_test_db():
        yield test_db

    app.dependency_overrides[get_db] = get_test_db

    yield app

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_app):
    """Create test client."""
    return TestClient(test_app)


@pytest.mark.asyncio
async def test_register_user(client):
    """Test user registration."""
    user_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "first_name": "Test",
        "last_name": "User",
        "display_name": "TestUser",
    }

    response = client.post("/auth/register", json=user_data)
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == user_data["email"]
    assert data["first_name"] == user_data["first_name"]
    assert data["last_name"] == user_data["last_name"]
    assert data["display_name"] == user_data["display_name"]
    assert data["is_active"] is True
    assert "id" in data
    assert "hashed_password" not in data  # Password should not be returned


@pytest.mark.asyncio
async def test_login_user(client):
    """Test user login."""
    # First register a user
    user_data = {
        "email": "login@example.com",
        "password": "loginpassword123",
        "first_name": "Login",
        "last_name": "Test",
    }

    register_response = client.post("/auth/register", json=user_data)
    assert register_response.status_code == 200

    # Now login
    login_data = {"email": "login@example.com", "password": "loginpassword123"}

    response = client.post("/auth/login", json=login_data)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    """Test login with invalid credentials."""
    login_data = {"email": "nonexistent@example.com", "password": "wrongpassword"}

    response = client.post("/auth/login", json=login_data)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user(client):
    """Test getting current user profile."""
    # Register and login to get token
    user_data = {
        "email": "profile@example.com",
        "password": "profilepassword123",
        "first_name": "Profile",
        "last_name": "User",
    }

    client.post("/auth/register", json=user_data)

    login_response = client.post(
        "/auth/login",
        json={"email": "profile@example.com", "password": "profilepassword123"},
    )

    token = login_response.json()["access_token"]

    # Get current user profile
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "profile@example.com"
    assert data["first_name"] == "Profile"
    assert data["last_name"] == "User"


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(client):
    """Test getting current user with invalid token."""
    headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """Test registering with duplicate email."""
    user_data = {
        "email": "duplicate@example.com",
        "password": "password123",
        "first_name": "First",
        "last_name": "User",
    }

    # Register first user
    response1 = client.post("/auth/register", json=user_data)
    assert response1.status_code == 200

    # Try to register with same email
    response2 = client.post("/auth/register", json=user_data)
    assert response2.status_code == 400
    assert "Email already registered" in response2.json()["detail"]

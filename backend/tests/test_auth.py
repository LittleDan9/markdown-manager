"""Test user authentication endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_register_user():
    """Test user registration."""
    user_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "first_name": "Test",
        "last_name": "User",
        "display_name": "TestUser"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
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
async def test_login_user():
    """Test user login."""
    # First register a user
    user_data = {
        "email": "login@example.com",
        "password": "loginpassword123",
        "first_name": "Login",
        "last_name": "Test"
    }
    
    register_response = client.post("/api/v1/auth/register", json=user_data)
    assert register_response.status_code == 200
    
    # Now login
    login_data = {
        "email": "login@example.com",
        "password": "loginpassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == login_data["email"]


@pytest.mark.asyncio
async def test_login_invalid_credentials():
    """Test login with invalid credentials."""
    login_data = {
        "email": "nonexistent@example.com",
        "password": "wrongpassword"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user():
    """Test getting current user profile."""
    # Register and login to get token
    user_data = {
        "email": "profile@example.com",
        "password": "profilepassword123",
        "first_name": "Profile",
        "last_name": "User"
    }
    
    client.post("/api/v1/auth/register", json=user_data)
    
    login_response = client.post("/api/v1/auth/login", json={
        "email": "profile@example.com",
        "password": "profilepassword123"
    })
    
    token = login_response.json()["access_token"]
    
    # Get current user profile
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "profile@example.com"
    assert data["first_name"] == "Profile"
    assert data["last_name"] == "User"


@pytest.mark.asyncio
async def test_get_current_user_invalid_token():
    """Test getting current user with invalid token."""
    headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_duplicate_email():
    """Test registering with duplicate email."""
    user_data = {
        "email": "duplicate@example.com",
        "password": "password123",
        "first_name": "First",
        "last_name": "User"
    }
    
    # Register first user
    response1 = client.post("/api/v1/auth/register", json=user_data)
    assert response1.status_code == 200
    
    # Try to register with same email
    response2 = client.post("/api/v1/auth/register", json=user_data)
    assert response2.status_code == 400
    assert "Email already registered" in response2.json()["detail"]

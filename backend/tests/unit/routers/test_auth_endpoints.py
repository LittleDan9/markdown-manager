"""Tests for authentication endpoints and core auth functionality."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import timedelta

from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
    get_user_by_email,
)


# Create alias for async_client fixture to match existing test expectations
@pytest.fixture
async def client(async_client):
    """Alias for async_client fixture."""
    return async_client


class TestAuthCore:
    """Test core authentication functions."""

    def test_password_hashing(self):
        """Test password hashing and verification."""
        password = "test_password_123"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("wrong_password", hashed) is False

    def test_password_hashing_empty_password(self):
        """Test password hashing with empty password."""
        password = ""
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password("", hashed) is True
        assert verify_password("anything", hashed) is False

    def test_password_hashing_special_characters(self):
        """Test password hashing with special characters."""
        password = "p@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True
        assert verify_password("different", hashed) is False

    def test_create_access_token(self):
        """Test JWT access token creation."""
        data = {"sub": "test@example.com"}
        expires_delta = timedelta(minutes=15)

        token = create_access_token(data=data, expires_delta=expires_delta)

        assert isinstance(token, str)
        assert len(token) > 0

        # Decode token to verify contents
        from app.configs import settings
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "test@example.com"
        assert "exp" in payload

    def test_create_access_token_default_expiry(self):
        """Test JWT access token creation with default expiry."""
        data = {"sub": "user@example.com"}

        token = create_access_token(data=data)

        assert isinstance(token, str)
        assert len(token) > 0

        # Verify token can be decoded
        from app.configs import settings
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "user@example.com"

    def test_create_access_token_different_users(self):
        """Test that different users get different tokens."""
        token1 = create_access_token(data={"sub": "user1@example.com"})
        token2 = create_access_token(data={"sub": "user2@example.com"})

        assert token1 != token2

        # Verify both tokens contain correct user emails
        from app.configs import settings
        payload1 = jwt.decode(token1, settings.secret_key, algorithms=[settings.algorithm])
        payload2 = jwt.decode(token2, settings.secret_key, algorithms=[settings.algorithm])

        assert payload1["sub"] == "user1@example.com"
        assert payload2["sub"] == "user2@example.com"

    @pytest.mark.asyncio
    async def test_authenticate_user_success(self):
        """Test successful user authentication."""
        # Mock database and user
        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.email = "test@example.com"
        mock_user.hashed_password = get_password_hash("correct_password")

        with patch('app.core.auth.get_user_by_email') as mock_get_user:
            mock_get_user.return_value = mock_user

            result = await authenticate_user(mock_db, "test@example.com", "correct_password")

            assert result == mock_user
            mock_get_user.assert_called_once_with(mock_db, "test@example.com")

    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self):
        """Test user authentication with wrong password."""
        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.hashed_password = get_password_hash("correct_password")

        with patch('app.core.auth.get_user_by_email') as mock_get_user:
            mock_get_user.return_value = mock_user

            result = await authenticate_user(mock_db, "test@example.com", "wrong_password")

            assert result is None

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self):
        """Test user authentication when user doesn't exist."""
        mock_db = AsyncMock()

        with patch('app.core.auth.get_user_by_email') as mock_get_user:
            mock_get_user.return_value = None

            result = await authenticate_user(mock_db, "nonexistent@example.com", "any_password")

            assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self):
        """Test getting user by email."""
        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.email = "test@example.com"

        # Mock the database query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result

        result = await get_user_by_email(mock_db, "test@example.com")

        assert result == mock_user
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self):
        """Test getting user by email when user doesn't exist."""
        mock_db = AsyncMock()

        # Mock the database query returning None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await get_user_by_email(mock_db, "nonexistent@example.com")

        assert result is None
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_current_user_success(self):
        """Test getting current user from valid token."""
        # Create a test user
        mock_user = MagicMock()
        mock_user.email = "test@example.com"

        # Mock database session
        mock_db = AsyncMock()

        # Create valid token
        token_data = {"sub": "test@example.com"}
        token = create_access_token(data=token_data)

        # Mock credentials
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="bearer",
            credentials=token
        )

        with patch('app.core.auth.get_user_by_email') as mock_get_user:
            mock_get_user.return_value = mock_user

            result = await get_current_user(mock_credentials, mock_db)

            assert result == mock_user
            mock_get_user.assert_called_once_with(mock_db, email="test@example.com")

    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self):
        """Test getting current user with invalid token."""
        mock_db = AsyncMock()

        # Mock credentials with invalid token
        mock_credentials = HTTPAuthorizationCredentials(
            scheme="bearer",
            credentials="invalid.token.string"
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(mock_credentials, mock_db)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_get_current_user_user_not_found(self):
        """Test getting current user when user doesn't exist in database."""
        mock_db = AsyncMock()

        # Create valid token for non-existent user
        token_data = {"sub": "nonexistent@example.com"}
        token = create_access_token(data=token_data)

        mock_credentials = HTTPAuthorizationCredentials(
            scheme="bearer",
            credentials=token
        )

        with patch('app.core.auth.get_user_by_email') as mock_get_user:
            mock_get_user.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials, mock_db)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


class TestAuthEndpoints:
    """Test authentication router endpoints."""

    @pytest.mark.asyncio
    async def test_register_success(self, async_client, test_user_data):
        """Test successful user registration."""
        # Mock the storage service to avoid filesystem operations
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            response = await async_client.post("/auth/register", json=test_user_data)

            assert response.status_code == 200
            data = response.json()
            assert data["email"] == test_user_data["email"]
            assert data["first_name"] == test_user_data["first_name"]
            assert "id" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, async_client, test_user_data):
        """Test registration with existing email fails."""
        # Mock storage service for first registration
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            # Create first user
            first_response = await async_client.post("/auth/register", json=test_user_data)
            assert first_response.status_code == 200

            # Attempt duplicate registration
            response = await async_client.post("/auth/register", json=test_user_data)

            assert response.status_code == 400
            assert "Email already registered" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, async_client):
        """Test registration with invalid email format."""
        invalid_data = {
            "email": "not_an_email",
            "first_name": "Test",
            "last_name": "User",
            "display_name": "TestUser",
            "password": "testpassword123",
            "bio": "Test bio"
        }

        response = await async_client.post("/auth/register", json=invalid_data)

        assert response.status_code == 422
        assert "value_error" in response.json()["detail"][0]["type"]

    @pytest.mark.asyncio
    async def test_register_missing_required_fields(self, async_client):
        """Test registration with missing required fields."""
        incomplete_data = {
            "email": "test@example.com",
            # Missing other required fields
        }

        response = await async_client.post("/auth/register", json=incomplete_data)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_storage_failure(self, async_client, test_user_data):
        """Test registration failure when storage initialization fails."""
        # Mock storage service to fail
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = False  # Simulate failure
            mock_storage_class.return_value = mock_storage

            response = await async_client.post("/auth/register", json=test_user_data)

            assert response.status_code == 500
            assert "Failed to initialize user storage" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_success(self, async_client, test_user_data):
        """Test successful login after registration."""
        # Mock storage service for registration
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            # Register user first
            register_response = await async_client.post("/auth/register", json=test_user_data)
            assert register_response.status_code == 200

        # Mock background task to avoid GitHub sync
        with patch('app.routers.auth.login.sync_user_github_repositories_background'):
            # Then login
            login_data = {
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }

            response = await async_client.post("/auth/login", json=login_data)

            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert "token_type" in data
            assert data["token_type"] == "bearer"
            assert data["mfa_required"] is False

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, async_client):
        """Test login with invalid credentials."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }

        response = await async_client.post("/auth/login", json=login_data)

        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, async_client, test_user_data):
        """Test login with correct email but wrong password."""
        # Mock storage service for registration
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            # Register user first
            register_response = await async_client.post("/auth/register", json=test_user_data)
            assert register_response.status_code == 200

        # Try to login with wrong password
        login_data = {
            "email": test_user_data["email"],
            "password": "wrong_password"
        }

        response = await async_client.post("/auth/login", json=login_data)

        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_missing_fields(self, async_client):
        """Test login with missing required fields."""
        incomplete_data = {
            "email": "test@example.com"
            # Missing password
        }

        response = await async_client.post("/auth/login", json=incomplete_data)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_protected_endpoint_with_valid_token(self, async_client, test_user_data):
        """Test accessing protected endpoint with valid token."""
        # Mock storage service for registration
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            # Register user
            register_response = await async_client.post("/auth/register", json=test_user_data)
            assert register_response.status_code == 200

        # Mock background task and login to get token
        with patch('app.routers.auth.login.sync_user_github_repositories_background'):
            login_data = {
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }

            login_response = await async_client.post("/auth/login", json=login_data)
            assert login_response.status_code == 200
            token = login_response.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}

        # Try to access the user profile endpoint (correct path is /auth/me)
        response = await async_client.get("/auth/me", headers=headers)

        # Should succeed (200)
        assert response.status_code == 200
        profile_data = response.json()
        assert profile_data["email"] == test_user_data["email"]

    @pytest.mark.asyncio
    async def test_protected_endpoint_without_token(self, async_client):
        """Test accessing protected endpoint without token."""
        response = await async_client.get("/auth/me")

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_protected_endpoint_with_invalid_token(self, async_client):
        """Test accessing protected endpoint with invalid token."""
        headers = {"Authorization": "Bearer invalid_token_string"}

        response = await async_client.get("/auth/me", headers=headers)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout(self, async_client):
        """Test logout endpoint."""
        response = await async_client.post("/auth/logout")

        assert response.status_code == 200
        assert response.json()["message"] == "Logged out"

    @pytest.mark.asyncio
    async def test_login_with_mfa_enabled(self, async_client, test_user_data):
        """Test login when MFA is enabled returns mfa_required=True."""
        # Mock storage service for registration
        with patch('app.services.storage.user.UserStorage') as mock_storage_class:
            mock_storage = AsyncMock()
            mock_storage.create_user_directory.return_value = True
            mock_storage.initialize_category_repo.return_value = True
            mock_storage_class.return_value = mock_storage

            # Register user
            register_response = await async_client.post("/auth/register", json=test_user_data)
            assert register_response.status_code == 200

        # Mock the authenticate_user to return a user with MFA enabled
        mock_user = MagicMock()
        mock_user.email = test_user_data["email"]
        mock_user.is_active = True
        mock_user.mfa_enabled = True

        with patch('app.routers.auth.login.authenticate_user') as mock_auth:
            mock_auth.return_value = mock_user

            login_data = {
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }

            response = await async_client.post("/auth/login", json=login_data)

            assert response.status_code == 200
            data = response.json()
            assert data["mfa_required"] is True
            assert "access_token" not in data
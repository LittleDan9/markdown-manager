"""Data fixtures for testing."""
from typing import Dict, Any, Optional
import uuid

import pytest

from app.schemas.user import UserCreate
from app.schemas.category import CategoryCreate


class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    def user_data(variant: str = "default") -> Dict[str, Any]:
        """Generate test user data with unique email."""
        # Generate unique identifier for each test
        unique_id = str(uuid.uuid4())[:8]

        base_data = {
            "email": f"test_{unique_id}@example.com",
            "first_name": "Test",
            "last_name": "User",
            "display_name": "TestUser",
            "password": "testpassword123",
            "bio": "A test user for testing purposes"
        }

        if variant == "different":
            base_data.update({
                "email": f"different_{unique_id}@example.com",
                "first_name": "Different",
                "last_name": "Person",
                "display_name": "DifferentUser",
            })

        return base_data

    @staticmethod
    def user_create_schema(unique_suffix: Optional[str] = None) -> UserCreate:
        """Create UserCreate schema for testing."""
        data = TestDataFactory.user_data(unique_suffix or "default")
        return UserCreate(**data)

    @staticmethod
    def category_data() -> Dict[str, Any]:
        """Generate test category data."""
        return {
            "name": "Test Category"
        }


@pytest.fixture
async def authenticated_user_data(async_client, test_user_data):
    """Create a user and return both auth token and user data."""
    # Register user
    register_response = await async_client.post("/auth/register", json=test_user_data)
    assert register_response.status_code == 200
    user_data = register_response.json()

    # Login to get token
    login_response = await async_client.post("/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    return token, user_data

    @staticmethod
    def category_create_schema(name: Optional[str] = None) -> CategoryCreate:
        """Create CategoryCreate schema for testing."""
        data = TestDataFactory.category_data(name)
        return CategoryCreate(**data)

    @staticmethod
    def login_data(email: Optional[str] = None, password: str = "testpassword123") -> Dict[str, str]:
        """Create login data for testing."""
        if email is None:
            email = f"test_{str(uuid.uuid4())[:8]}@example.com"

        return {
            "email": email,
            "password": password,
        }


@pytest.fixture
def test_user_data():
    """Provide test user data."""
    return TestDataFactory.user_data()


@pytest.fixture
def test_user_schema():
    """Provide test user schema."""
    return TestDataFactory.user_create_schema()


@pytest.fixture
def test_category_data():
    """Provide test category data."""
    return TestDataFactory.category_data()


@pytest.fixture
def test_category_schema():
    """Provide test category schema."""
    return TestDataFactory.category_data()


@pytest.fixture
def different_user_data():
    """Provide different test user data for isolation testing."""
    return TestDataFactory.user_data("different")


@pytest.fixture
def different_user_schema():
    """Provide different test user schema for isolation testing."""
    return TestDataFactory.user_create_schema("different")

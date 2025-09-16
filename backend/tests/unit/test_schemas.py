"""Unit tests for data schemas."""
import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate, UserResponse
from app.schemas.category import CategoryCreate
from tests.fixtures.data import TestDataFactory


class TestUserSchemas:
    """Test user schema validation."""

    def test_user_create_valid_data(self):
        """Test UserCreate with valid data."""
        data = TestDataFactory.user_data()
        user = UserCreate(**data)

        assert user.email == data["email"]
        assert user.password == data["password"]
        assert user.first_name == data["first_name"]
        assert user.last_name == data["last_name"]
        assert user.display_name == data["display_name"]

    def test_user_create_missing_required_fields(self):
        """Test UserCreate with missing required fields."""
        # Missing email should raise ValidationError
        with pytest.raises(ValidationError):
            UserCreate(
                password="password123",
                first_name="Test",
                last_name="User"
            )

        # Missing password should raise ValidationError
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                first_name="Test",
                last_name="User"
            )

    def test_user_create_invalid_email(self):
        """Test UserCreate with invalid email."""
        data = TestDataFactory.user_data()
        data["email"] = "invalid-email"

        with pytest.raises(ValidationError):
            UserCreate(**data)

    def test_user_create_short_password(self):
        """Test UserCreate with short password."""
        data = TestDataFactory.user_data()
        data["password"] = "123"  # Too short

        with pytest.raises(ValidationError):
            UserCreate(**data)

    def test_user_response_excludes_password(self):
        """Test that UserResponse doesn't include password."""
        # UserResponse should not have password field
        user_data = {
            "id": 1,
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "display_name": "TestUser",
            "is_active": True,
            "is_verified": True,
            "is_admin": False,
            "mfa_enabled": False,
            "full_name": "Test User",
            "sync_preview_scroll_enabled": True,
            "autosave_enabled": True,
            "created_at": "2023-01-01T00:00:00",
            "updated_at": "2023-01-01T00:00:00",
        }

        user = UserResponse(**user_data)
        assert not hasattr(user, "password")
        assert not hasattr(user, "hashed_password")


class TestCategorySchemas:
    """Test category schema validation."""

    def test_category_create_valid_data(self):
        """Test CategoryCreate with valid data."""
        data = {"name": "Test Category"}
        category = CategoryCreate(**data)

        assert category.name == data["name"]

    def test_category_create_missing_name(self):
        """Test CategoryCreate with missing name."""
        # CategoryCreate requires name, so this should fail
        with pytest.raises(ValidationError):
            CategoryCreate()

    def test_category_create_empty_name(self):
        """Test CategoryCreate with empty name."""
        with pytest.raises(ValidationError):
            CategoryCreate(name="")

    def test_category_create_name_too_long(self):
        """Test CategoryCreate with name too long."""
        long_name = "a" * 256  # Assuming 100 is the limit based on schema

        with pytest.raises(ValidationError):
            CategoryCreate(name=long_name)

    def test_category_create_valid_name(self):
        """Test CategoryCreate with valid name."""
        category = CategoryCreate(name="Test Category")
        assert category.name == "Test Category"

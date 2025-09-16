"""Test database setup and fixtures."""
import os
import tempfile

import pytest
import pytest_asyncio
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.configs import settings
from app.models.base import Base
from app.models.user import User


@pytest.fixture(scope="session")
def temp_db_path():
    """Create a temporary database file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temp_file:
        temp_path = temp_file.name
    yield temp_path
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


@pytest.fixture(scope="session")
def test_database_url(temp_db_path):
    """Create test database URL."""
    return f"sqlite+aiosqlite:///{temp_db_path}"


@pytest_asyncio.fixture(scope="session")
async def test_engine(test_database_url):
    """Create test database engine."""
    engine = create_async_engine(test_database_url, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Cleanup
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_db_session(test_engine):
    """Create a test database session."""
    async_session_maker = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    session = async_session_maker()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def override_get_db(test_db_session):
    """Override the get_db dependency for tests."""
    # This fixture could be used to override database dependencies
    # For now, we'll use the test_db_session directly in tests
    pass


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """
    Cleanup users created by tests after each test run.
    Updated to handle missing tables gracefully.
    """
    yield

    # Use synchronous engine for cleanup
    try:
        sync_engine = create_engine(
            settings.database_url.replace("+aiosqlite", ""), echo=False
        )
        SessionLocal = sessionmaker(bind=sync_engine)
        db = SessionLocal()

        try:
            db.query(User).filter(User.email.like("%@example.com")).delete(
                synchronize_session=False
            )
            db.commit()
        except OperationalError:
            # Table doesn't exist, which is fine for tests that don't use the database
            pass
        finally:
            db.close()
    except Exception:
        # Database file might not exist, which is fine
        pass


# Sample test data factories
class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    def create_user_data(email_suffix="example.com", **overrides):
        """Create test user data."""
        import uuid

        base_data = {
            "email": f"test_{uuid.uuid4().hex[:8]}@{email_suffix}",
            "password": "testpassword123",
            "first_name": "Test",
            "last_name": "User",
            "display_name": "TestUser",
        }
        base_data.update(overrides)
        return base_data

    @staticmethod
    def create_category_data(**overrides):
        """Create test category data."""
        import uuid

        base_data = {
            "name": f"Test Category {uuid.uuid4().hex[:8]}",
            "description": "Test category description",
        }
        base_data.update(overrides)
        return base_data

    @staticmethod
    def create_document_data(**overrides):
        """Create test document data."""
        import uuid

        base_data = {
            "title": f"Test Document {uuid.uuid4().hex[:8]}",
            "content": "# Test Document\n\nThis is test content.",
            "is_public": False,
        }
        base_data.update(overrides)
        return base_data

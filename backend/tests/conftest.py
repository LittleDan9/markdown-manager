import os

# Set test environment variables BEFORE any other imports
# This ensures they override .env file values
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ALEMBIC_USE_SQLITE"] = "true"
os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"
os.environ["GITHUB_REDIRECT_URI"] = "http://localhost:8000/auth/github/callback"
os.environ["MARKDOWN_STORAGE_ROOT"] = "/tmp/pytest-storage"

import pytest
import httpx
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import fixtures from the fixtures package
pytest_plugins = [
    "tests.fixtures.database",
    "tests.fixtures.application",
    "tests.fixtures.data",
]

from app.models import Base  # Import the Base for table creation
from app.app_factory import create_app
from app.database import get_db

# Create async engine for tests
async_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
AsyncSessionLocal = async_sessionmaker(async_engine)

# Create sync engine for cleanup
sync_engine = create_engine("sqlite:///:memory:", echo=False)
SyncSessionLocal = sessionmaker(bind=sync_engine)


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Set up test database with all tables."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()


@pytest.fixture
async def test_db():
    """Provide an async database session for tests."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client(test_db):
    """Create async test client with database dependency override."""
    app = create_app()

    # Override the database dependency
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    # Create async client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """
    Cleanup users created by tests after each test run.
    Removes users with emails ending in '@example.com' (test pattern).
    """
    yield
    # Since we're using in-memory database, cleanup is automatic

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
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.pool import StaticPool

# Import fixtures from the fixtures package
pytest_plugins = [
    "tests.fixtures.database",
    "tests.fixtures.application",
    "tests.fixtures.data",
]

from app.models import Base  # Import the Base for table creation
from app.app_factory import create_app
from app.database import get_db


# Removed event_loop fixture to avoid conflicts with pytest-asyncio


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Set up test database with all tables."""
    # Create async engine for the session
    async_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    # Create tables using async context
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield async_engine
    await async_engine.dispose()


@pytest.fixture
async def async_db_session(setup_test_database):
    """Provide an async database session for tests."""
    engine = setup_test_database

    async_session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False
    )

    async with async_session_maker() as session:
        try:
            yield session
        finally:
            # Close the session cleanly without explicit rollback
            await session.close()


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


@pytest.fixture(autouse=True)
async def cleanup_test_data(async_db_session):
    """
    Clean up test data after each test.
    Rolls back any uncommitted changes.
    """
    yield
    # Cleanup is handled by session rollback in async_db_session fixture


@pytest.fixture
async def auth_headers(client):
    """Create authenticated user and return auth headers."""
    # Generate unique email for each test
    import uuid
    unique_id = str(uuid.uuid4())[:8]

    # Register a test user
    user_data = {
        "email": f"auth_test_{unique_id}@example.com",
        "first_name": "Auth",
        "last_name": "Test",
        "display_name": "AuthTest",
        "password": "testpassword123",
        "bio": "Test user for authentication"
    }

    register_response = await client.post("/auth/register", json=user_data)
    if register_response.status_code != 200:
        raise Exception(f"Failed to register user: {register_response.status_code} - {register_response.json()}")

    # Login to get token
    login_data = {
        "email": user_data["email"],
        "password": user_data["password"]
    }
    login_response = await client.post("/auth/login", json=login_data)
    if login_response.status_code != 200:
        raise Exception(f"Failed to login user: {login_response.status_code} - {login_response.json()}")

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_db(sync_db_session):
    """Alias for sync_db_session for compatibility."""
    return sync_db_session


@pytest.fixture
async def sample_user(async_db_session):
    """Create a sample user for testing."""
    from app.models.user import User
    import uuid

    unique_id = str(uuid.uuid4())[:8]

    user = User(
        email=f"sample_{unique_id}@example.com",
        first_name="Sample",
        last_name="User",
        display_name="SampleUser",
        hashed_password="$2b$12$dummy_hash",
        is_active=True
    )

    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest.fixture
async def sample_document(async_db_session, sample_user):
    """Create a sample document for testing."""
    from app.models.document import Document

    document = Document(
        name="Sample Document",
        file_path="sample/document.md",
        user_id=sample_user.id,
        category_id=1,
        folder_path="/sample"
    )

    async_db_session.add(document)
    await async_db_session.commit()
    await async_db_session.refresh(document)
    return document

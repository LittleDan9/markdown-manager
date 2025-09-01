import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

# Set test database URL before importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ALEMBIC_USE_SQLITE"] = "true"

from app.configs import settings
from app.models import Base  # Import the Base for table creation
from app.models.user import User

# Create a synchronous engine for cleanup
engine = create_engine(settings.database_url.replace("+aiosqlite", ""), echo=False)
SessionLocal = sessionmaker(bind=engine)

# Create async engine for tests
async_engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(async_engine)


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Set up test database with all tables."""
    # Create all tables for the in-memory database using async engine
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Cleanup is automatic since it's in-memory
    await async_engine.dispose()


@pytest.fixture
async def test_db():
    """Provide an async database session for tests."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def db(test_db):
    """Alias for test_db to match common test patterns."""
    yield test_db


@pytest.fixture
async def test_user(db: AsyncSession):
    """Create a test user for testing."""
    import uuid

    from app.crud.user import create_user
    from app.schemas.user import UserCreate

    # Use UUID to ensure unique email addresses across tests
    unique_id = str(uuid.uuid4())[:8]
    user_data = UserCreate(
        email=f"testuser_{unique_id}@example.com",
        password="testpassword123",
        first_name="Test",
        last_name="User",
    )
    user = await create_user(db, user_data)
    return user


@pytest.fixture
async def another_user(db: AsyncSession):
    """Create another test user for isolation testing."""
    import uuid

    from app.crud.user import create_user
    from app.schemas.user import UserCreate

    # Use UUID to ensure unique email addresses across tests
    unique_id = str(uuid.uuid4())[:8]
    user_data = UserCreate(
        email=f"anotheruser_{unique_id}@example.com",
        password="testpassword123",
        first_name="Another",
        last_name="User",
    )
    user = await create_user(db, user_data)
    return user


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """
    Cleanup users created by tests after each test run.
    Removes users with emails ending in '@example.com' (test pattern).
    """
    yield
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

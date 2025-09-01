"""Database fixtures for testing."""
import asyncio
from typing import AsyncGenerator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base


class TestDatabase:
    """Test database management class."""
    
    def __init__(self):
        self.async_engine = None
        self.sync_engine = None
        self.async_session_maker = None
        self.sync_session_maker = None
        
    async def setup_async_database(self):
        """Set up async test database."""
        # Use a unique database name for each test run
        db_url = "sqlite+aiosqlite:///:memory:"
        
        self.async_engine = create_async_engine(
            db_url,
            echo=False,
            poolclass=StaticPool,
            connect_args={
                "check_same_thread": False,
            },
        )
        
        self.async_session_maker = async_sessionmaker(
            bind=self.async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        
        # Create all tables
        async with self.async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    
    def setup_sync_database(self):
        """Set up sync test database for unit tests."""
        db_url = "sqlite:///:memory:"
        
        self.sync_engine = create_engine(
            db_url,
            echo=False,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
        
        self.sync_session_maker = sessionmaker(
            bind=self.sync_engine,
            autocommit=False,
            autoflush=False,
        )
        
        # Create all tables
        Base.metadata.create_all(bind=self.sync_engine)
    
    async def get_async_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get async database session.""" 
        if self.async_session_maker is None:
            await self.setup_async_database()
        
        if self.async_session_maker is not None:
            async with self.async_session_maker() as session:
                try:
                    yield session
                finally:
                    await session.close()
    
    def get_sync_session(self):
        """Get sync database session."""
        if self.sync_session_maker is None:
            self.setup_sync_database()
        
        if self.sync_session_maker is not None:
            session = self.sync_session_maker()
            try:
                yield session
            finally:
                session.close()
    
    async def cleanup_async(self):
        """Clean up async database."""
        if self.async_engine:
            await self.async_engine.dispose()
    
    def cleanup_sync(self):
        """Clean up sync database."""
        if self.sync_engine:
            self.sync_engine.dispose()


# Global test database instance
test_db = TestDatabase()


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Set up test database for the session."""
    await test_db.setup_async_database()
    yield
    await test_db.cleanup_async()


@pytest.fixture
async def async_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session for integration tests."""
    async for session in test_db.get_async_session():
        yield session


@pytest.fixture
def sync_db_session():
    """Provide a sync database session for unit tests."""
    yield from test_db.get_sync_session()

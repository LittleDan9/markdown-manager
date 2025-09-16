"""Database fixtures for testing."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base


@pytest.fixture
def sync_db_session():
    """Provide a sync database session for unit tests that require sync operations."""
    # Create a separate sync engine for unit tests
    sync_engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    # Create all tables in sync engine
    Base.metadata.create_all(bind=sync_engine)

    # Create session
    Session = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)
    session = Session()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        sync_engine.dispose()

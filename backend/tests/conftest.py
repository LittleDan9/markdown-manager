import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User

# Create a synchronous engine for cleanup
engine = create_engine(settings.database_url.replace("+aiosqlite", ""), echo=False)
SessionLocal = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """
    Cleanup users created by tests after each test run.
    Removes users with emails ending in '@example.com' (test pattern).
    """
    yield
    db = SessionLocal()
    db.query(User).filter(User.email.like("%@example.com")).delete(
        synchronize_session=False
    )
    db.commit()
    db.close()

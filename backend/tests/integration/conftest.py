"""Integration test configuration."""
import os

# Set test environment for async operations
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ALEMBIC_USE_SQLITE"] = "true"

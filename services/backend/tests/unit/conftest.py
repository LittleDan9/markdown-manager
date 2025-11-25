"""Unit test configuration."""
import os

# Set test environment
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ALEMBIC_USE_SQLITE"] = "true"

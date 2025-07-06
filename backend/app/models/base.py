"""Base database model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base

# Use type: ignore to satisfy mypy for SQLAlchemy base
Base = declarative_base()


class BaseModel(Base):  # type: ignore[misc, valid-type]
    """Base model with common fields."""

    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

"""Base icon service with common functionality."""
from sqlalchemy.ext.asyncio import AsyncSession
from .cache import get_icon_cache


class BaseIconService:
    """Base service with common functionality for icon services."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the service with database session."""
        self.db = db_session
        self.cache = get_icon_cache()

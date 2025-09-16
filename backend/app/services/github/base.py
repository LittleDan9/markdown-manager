"""Base GitHub service class."""
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class BaseGitHubService:
    """Base class for all GitHub services."""

    def __init__(self, db_session: Optional["AsyncSession"] = None):
        """Initialize base GitHub service."""
        self.db_session = db_session

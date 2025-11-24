"""Enhanced database dependencies with outbox support."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.outbox_service import OutboxService


class DatabaseWithOutbox:
    """Database session wrapper with outbox service."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.outbox = OutboxService(session)

    async def commit(self):
        """Commit the database transaction."""
        await self.session.commit()

    async def rollback(self):
        """Rollback the database transaction."""
        await self.session.rollback()

    async def close(self):
        """Close the database session."""
        await self.session.close()

    def __getattr__(self, name):
        """Delegate attribute access to the underlying session."""
        return getattr(self.session, name)


async def get_db_with_outbox() -> AsyncGenerator[DatabaseWithOutbox, None]:
    """Dependency to get database session with outbox service.

    This provides access to both the database session and outbox service
    for atomic transactions that include event publishing.
    """
    async with AsyncSessionLocal() as session:
        db_with_outbox = DatabaseWithOutbox(session)
        try:
            yield db_with_outbox
        finally:
            await session.close()
"""Database configuration."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.configs import settings
from app.configs.environment import EnvironmentConfig

# Initialize environment config
env_config = EnvironmentConfig(settings)

# Get environment-appropriate pool settings
pool_settings = env_config.get_database_pool_settings()

# Create async engine with enhanced configuration
engine = create_async_engine(
    settings.database_config.url,
    echo=settings.database_config.echo,
    future=True,
    pool_size=pool_settings["pool_size"],
    max_overflow=pool_settings["max_overflow"],
    pool_timeout=pool_settings["pool_timeout"],
    pool_recycle=pool_settings["pool_recycle"],
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables() -> None:
    """Create database tables."""
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

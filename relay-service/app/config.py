"""Configuration settings for relay service."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Relay service configuration."""

    # Database configuration
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager",
        description="PostgreSQL database URL"
    )

    # Redis configuration
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # Processing configuration
    batch_size: int = Field(
        default=100,
        description="Number of events to process in each batch"
    )

    poll_interval: int = Field(
        default=5,
        description="Seconds to wait between polling for events"
    )

    max_retry_attempts: int = Field(
        default=5,
        description="Maximum number of retry attempts for failed events"
    )

    retry_base_delay: int = Field(
        default=60,
        description="Base delay in seconds for exponential backoff"
    )

    # Stream configuration
    stream_name: str = Field(
        default="identity.user.v1",
        description="Redis stream name for identity events"
    )

    dlq_stream_name: str = Field(
        default="identity.user.v1.dlq",
        description="Dead letter queue stream name"
    )

    # Monitoring
    log_level: str = Field(
        default="INFO",
        description="Logging level"
    )

    class Config:
        env_prefix = "RELAY_"
        env_file = ".env"
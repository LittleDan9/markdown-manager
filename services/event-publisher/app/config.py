"""Configuration settings for relay service."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Relay service configuration."""

    # Database configuration
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager",
        description="PostgreSQL database URL",
        alias="DATABASE_URL"
    )

    # Redis configuration
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
        alias="REDIS_URL"
    )

    # Processing configuration
    batch_size: int = Field(
        default=100,
        description="Number of events to process in each batch",
        alias="BATCH_SIZE"
    )

    poll_interval: int = Field(
        default=5,
        description="Seconds to wait between polling for events",
        alias="POLL_INTERVAL"
    )

    # HTTP server configuration
    http_port: int = Field(
        default=8004,
        description="Port for HTTP health check server"
    )

    max_retry_attempts: int = Field(
        default=5,
        description="Maximum number of retry attempts for failed events",
        alias="MAX_RETRY_ATTEMPTS"
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
        description="Logging level",
        alias="LOG_LEVEL"
    )

    class Config:
        env_file = ".env"
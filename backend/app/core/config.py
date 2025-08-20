"""Core configuration module."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):  # type: ignore[misc]
    """Application settings."""

    # API settings
    project_name: str = "Markdown Manager API"
    api_v1_str: str = "/api/v1"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Database settings
    # Default to SQLite, but can be overridden by the DATABASE_URL environment variable (e.g., for Postgres)
    # Example Postgres URL: 'postgresql+asyncpg://postgres:postgres@db:5432/markdown_manager'
    database_url: str = "sqlite+aiosqlite:///./markdown_manager.db"

    # Security settings
    secret_key: str = (
        "your-secret-key-here-change-in-production-make-it-long-and-random"
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 90  # 90 minutes

    # Cookie settings
    secure_cookies: bool = False  # Set to True in production with HTTPS

    # File storage settings
    documents_directory: str = "./documents"
    max_file_size: int = 10 * 1024 * 1024  # 10MB

    # SMTP settings
    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = "your_smtp_user"
    smtp_pass: str = "your_smtp_password"
    from_email: str = "noreply@littledan.com"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()

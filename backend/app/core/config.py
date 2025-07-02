"""Core configuration module."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # API settings
    project_name: str = "Markdown Manager API"
    api_v1_str: str = "/api/v1"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Database settings
    database_url: str = "sqlite+aiosqlite:///./markdown_manager.db"
    
    # Security settings
    secret_key: str = (
        "your-secret-key-here-change-in-production-make-it-long-and-random"
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30 * 24 * 7  # 7 days
    
    # File storage settings
    documents_directory: str = "./documents"
    max_file_size: int = 10 * 1024 * 1024  # 10MB

    class Config:
        """Pydantic config."""
        env_file = ".env"


settings = Settings()

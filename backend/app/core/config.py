"""Core configuration module."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    project_name: str = "Markdown Manager API"
    api_v1_str: str = "/api/v1"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    class Config:
        """Pydantic config."""
        env_file = ".env"


settings = Settings()

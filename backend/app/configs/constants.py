"""Constants for the markdown-manager application."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Constants:
    """Application constants."""

    # API Configuration
    API_TITLE: str = "Markdown Manager API"
    API_DESCRIPTION: str = "A comprehensive markdown document management system"
    API_VERSION: str = "2.0.0"

    # File handling
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_EXTENSIONS: set[str] = field(
        default_factory=lambda: {".md", ".txt", ".pdf"}
    )

    # Security
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 90  # 90 minutes

    # Database
    SQLITE_URL_PATTERN: str = "sqlite+aiosqlite:///{path}"
    POSTGRES_URL_PATTERN: str = (
        "postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"
    )

    # Directories
    DEFAULT_DOCUMENTS_DIR: str = "./documents"
    DEFAULT_DATABASE_PATH: str = "./markdown_manager.db"

    # SMTP defaults
    DEFAULT_SMTP_PORT: int = 587
    DEFAULT_FROM_EMAIL: str = "noreply@markdown-manager.local"

    # Environment-specific defaults
    ENVIRONMENTS: set[str] = field(
        default_factory=lambda: {"local", "development", "staging", "production"}
    )

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


# Global constants instance
constants = Constants()

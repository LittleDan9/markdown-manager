"""Enhanced settings module with modular configuration management."""
from functools import lru_cache
from typing import Optional

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .constants import constants
from .models import DatabaseConfig, SecurityConfig, SMTPConfig


class Settings(BaseSettings):
    """Enhanced application settings with modular configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    # Environment configuration
    environment: str = Field(default="local", description="Application environment")
    debug: bool = Field(default=False, description="Enable debug mode")

    # Server configuration
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")

    # API configuration
    project_name: str = Field(
        default=constants.API_TITLE, description="API project name"
    )
    api_description: str = Field(
        default=constants.API_DESCRIPTION, description="API description"
    )
    api_version: str = Field(default=constants.API_VERSION, description="API version")

    # Database configuration
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager",
        description="Database connection URL",
    )
    database_echo: bool = Field(default=False, description="Enable SQL query logging")

    # Security configuration
    secret_key: str = Field(
        default="your-secret-key-here-change-in-production-make-it-long-and-random",
        description="JWT secret key",
    )
    algorithm: str = Field(default=constants.ALGORITHM, description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=constants.ACCESS_TOKEN_EXPIRE_MINUTES,
        description="Access token expiration in minutes",
    )
    secure_cookies: bool = Field(
        default=False, description="Use secure cookies (HTTPS only)"
    )

    # SMTP configuration
    smtp_host: str = Field(default="smtp.example.com", description="SMTP server host")
    smtp_port: int = Field(
        default=constants.DEFAULT_SMTP_PORT, description="SMTP server port"
    )
    smtp_user: Optional[str] = Field(default=None, description="SMTP username")
    smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    from_email: str = Field(
        default=constants.DEFAULT_FROM_EMAIL, description="From email address"
    )
    smtp_use_tls: bool = Field(default=True, description="Use TLS encryption")

    # Pagination configuration
    default_page_size: int = Field(
        default=constants.DEFAULT_PAGE_SIZE, description="Default pagination page size"
    )
    max_page_size: int = Field(
        default=constants.MAX_PAGE_SIZE, description="Maximum pagination page size"
    )

    # Export Service configuration
    export_service_url: str = Field(
        default="http://export-service:8001", description="Export service URL"
    )

    # Markdown Lint Service configuration
    markdown_lint_service_url: str = Field(
        default="http://markdown-lint-service:8002", description="Markdown lint service URL"
    )

    # Filesystem storage configuration
    markdown_storage_root: str = Field(
        default="/documents", description="Root directory for document storage"
    )

    # GitHub repository storage configuration
    github_max_repo_size_mb: int = Field(
        default=100, description="Maximum size per GitHub repository in MB"
    )
    github_total_storage_limit_gb: int = Field(
        default=5, description="Total GitHub storage limit in GB"
    )
    github_clone_depth: int = Field(
        default=10, description="Shallow clone depth for GitHub repositories"
    )
    github_auto_prune_days: int = Field(
        default=30, description="Auto-prune unused repositories after N days"
    )
    github_markdown_only: bool = Field(
        default=False,
        description="Only clone/sync markdown files from GitHub repos (deprecated - use storage limits instead)"
    )

    # GitHub OAuth configuration
    github_client_id: Optional[str] = Field(
        default=None, description="GitHub OAuth client ID"
    )
    github_client_secret: Optional[str] = Field(
        default=None, description="GitHub OAuth client secret"
    )
    github_redirect_uri: Optional[str] = Field(
        default=None, description="GitHub OAuth redirect URI"
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v):
        """Validate environment value."""
        if v not in constants.ENVIRONMENTS:
            raise ValueError(
                f"Environment must be one of {constants.ENVIRONMENTS}, got {v}"
            )
        return v

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v):
        """Validate database URL format."""
        if not v:
            raise ValueError("Database URL cannot be empty")
        if not (v.startswith("sqlite") or v.startswith("postgresql")):
            raise ValueError("Database URL must start with 'sqlite' or 'postgresql'")
        return v

    @computed_field
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @computed_field
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment in {"local", "development"}

    @computed_field
    @property
    def database_config(self) -> DatabaseConfig:
        """Get database configuration object."""
        return DatabaseConfig(
            url=self.database_url,
            echo=self.database_echo,
        )

    @computed_field
    @property
    def security_config(self) -> SecurityConfig:
        """Get security configuration object."""
        return SecurityConfig(
            secret_key=self.secret_key,
            algorithm=self.algorithm,
            access_token_expire_minutes=self.access_token_expire_minutes,
            secure_cookies=self.secure_cookies,
        )

    @computed_field
    @property
    def smtp_config(self) -> SMTPConfig:
        """Get SMTP configuration object."""
        return SMTPConfig(
            host=self.smtp_host,
            port=self.smtp_port,
            user=self.smtp_user,
            password=self.smtp_password,
            from_email=self.from_email,
            use_tls=self.smtp_use_tls,
        )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()

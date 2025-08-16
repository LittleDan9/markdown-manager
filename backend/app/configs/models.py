"""Database configuration models."""
from typing import Optional

from pydantic import BaseModel, Field


class DatabaseConfig(BaseModel):
    """Database configuration model."""

    url: str = Field(..., description="Database connection URL")
    echo: bool = Field(default=False, description="Enable SQL query logging")
    pool_size: int = Field(default=5, description="Connection pool size")
    max_overflow: int = Field(default=10, description="Maximum pool overflow")
    pool_timeout: int = Field(default=30, description="Pool timeout in seconds")
    pool_recycle: int = Field(default=3600, description="Pool recycle time in seconds")

    class Config:
        """Pydantic config."""

        extra = "forbid"


class SecurityConfig(BaseModel):
    """Security configuration model."""

    secret_key: str = Field(..., description="JWT secret key")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=90, description="Access token expiration in minutes"
    )
    secure_cookies: bool = Field(
        default=False, description="Use secure cookies (HTTPS only)"
    )

    class Config:
        """Pydantic config."""

        extra = "forbid"


class SMTPConfig(BaseModel):
    """SMTP configuration model."""

    host: str = Field(..., description="SMTP server host")
    port: int = Field(default=587, description="SMTP server port")
    user: Optional[str] = Field(default=None, description="SMTP username")
    password: Optional[str] = Field(default=None, description="SMTP password")
    from_email: str = Field(..., description="From email address")
    use_tls: bool = Field(default=True, description="Use TLS encryption")

    class Config:
        """Pydantic config."""

        extra = "forbid"


class StorageConfig(BaseModel):
    """File storage configuration model."""

    documents_directory: str = Field(
        default="./documents", description="Documents storage directory"
    )
    max_file_size: int = Field(
        default=10 * 1024 * 1024, description="Maximum file size in bytes"
    )
    allowed_extensions: set[str] = Field(
        default={".md", ".txt", ".pdf"}, description="Allowed file extensions"
    )

    class Config:
        """Pydantic config."""

        extra = "forbid"

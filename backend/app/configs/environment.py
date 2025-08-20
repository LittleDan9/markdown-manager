"""Environment-specific configuration helpers."""
import logging
from typing import Any, Dict

from .settings import Settings

logger = logging.getLogger(__name__)


class EnvironmentConfig:
    """Environment-specific configuration manager."""

    def __init__(self, settings: Settings):
        """Initialize with settings instance."""
        self.settings = settings

    def get_cors_origins(self) -> list[str]:
        """Get environment-appropriate CORS origins."""
        if self.settings.is_production:
            return [
                "https://littledan.com",
                "https://www.littledan.com",
                "https://markdown-manager.littledan.com",
            ]
        elif self.settings.environment == "staging":
            return [
                "https://staging.littledan.com",
                "https://staging-markdown-manager.littledan.com",
                "http://localhost:3000",  # Development frontend
            ]
        else:  # local/development
            return [
                "http://localhost:3000",  # Frontend development
                "http://127.0.0.1:3000",
                "http://localhost:8080",  # Alternative dev ports
                "http://127.0.0.1:8080",
            ]

    def get_log_level(self) -> str:
        """Get environment-appropriate log level."""
        if self.settings.is_production:
            return "INFO"
        elif self.settings.environment == "staging":
            return "INFO"
        else:
            return "DEBUG" if self.settings.debug else "INFO"

    def get_database_pool_settings(self) -> Dict[str, Any]:
        """Get environment-appropriate database pool settings."""
        if self.settings.is_production:
            return {
                "pool_size": 20,
                "max_overflow": 30,
                "pool_timeout": 30,
                "pool_recycle": 3600,
            }
        elif self.settings.environment == "staging":
            return {
                "pool_size": 10,
                "max_overflow": 20,
                "pool_timeout": 30,
                "pool_recycle": 3600,
            }
        else:  # local/development
            return {
                "pool_size": 5,
                "max_overflow": 10,
                "pool_timeout": 30,
                "pool_recycle": 3600,
            }

    def should_use_https_redirect(self) -> bool:
        """Check if HTTPS redirect should be enforced."""
        return self.settings.is_production

    def get_session_security_settings(self) -> Dict[str, Any]:
        """Get session security settings."""
        return {
            "secure": self.settings.secure_cookies or self.settings.is_production,
            "httponly": True,
            "samesite": "lax" if self.settings.is_production else "none",
        }

    def validate_configuration(self) -> bool:
        """Validate configuration for the current environment."""
        issues = []

        # Production-specific validations
        if self.settings.is_production:
            if (
                self.settings.secret_key
                == "your-secret-key-here-change-in-production-make-it-long-and-random"
            ):
                issues.append("Production secret key must be changed from default")

            if not self.settings.secure_cookies:
                issues.append("Secure cookies should be enabled in production")

            if self.settings.debug:
                issues.append("Debug mode should be disabled in production")

            if self.settings.database_url.startswith("sqlite"):
                issues.append("SQLite is not recommended for production")

        # Log validation issues
        if issues:
            logger.warning(f"Configuration validation issues: {issues}")
            return False

        logger.info(
            f"Configuration validated successfully for environment: {self.settings.environment}"
        )
        return True

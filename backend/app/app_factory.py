"""FastAPI Application Factory."""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.configs import settings
from app.configs.environment import EnvironmentConfig
from app.database import create_tables
from app.middleware import (
    ErrorHandlingMiddleware,
    LoggingMiddleware,
    MonitoringMiddleware,
    RequestContextMiddleware,
)
from app.routers import (
    auth,
    categories,
    custom_dictionary,
    default,
    documents,
    monitoring,
    pdf,
    public,
    syntax_highlighting,
    users,
)

logger = logging.getLogger(__name__)

# Initialize environment configuration
env_config = EnvironmentConfig(settings)


class AppFactory:
    """Factory class for creating FastAPI applications."""

    def __init__(self):
        """Initialize the app factory."""
        self.app: FastAPI | None = None
        self.monitoring_middleware: MonitoringMiddleware | None = None

    def _create_lifespan(self):
        """Create lifespan context manager for startup/shutdown events."""

        @asynccontextmanager
        async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
            """Application lifespan events."""
            # Startup: validate configuration and create database tables
            logger.info("Starting up application...")

            # Validate configuration for current environment
            if not env_config.validate_configuration():
                logger.warning("Configuration validation failed - proceeding anyway")

            await create_tables()
            logger.info("Database tables created/verified")

            yield

            # Shutdown: cleanup if needed
            logger.info("Shutting down application...")

        return lifespan

    def _setup_middleware(self) -> None:
        """Set up application middleware in correct order."""
        if not self.app:
            raise ValueError("App not initialized")

        # Error handling middleware (first - catches all errors)
        self.app.add_middleware(
            ErrorHandlingMiddleware, include_debug_info=settings.debug
        )

        # Request context middleware (early - sets up context for other middleware)
        self.app.add_middleware(RequestContextMiddleware)

        # Monitoring middleware (tracks performance)
        self.app.add_middleware(
            MonitoringMiddleware, enable_metrics=True, slow_request_threshold=1.0
        )

        # Logging middleware (logs with context from previous middleware)
        self.app.add_middleware(LoggingMiddleware)

        # CORS middleware (last - handles browser requests)
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=env_config.get_cors_origins(),
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def _setup_routers(self) -> None:
        """Set up application routers."""
        if not self.app:
            raise ValueError("App not initialized")

        # Include routers with consolidated structure - start with basics first
        self.app.include_router(
            default.router, tags=["default"]
        )  # Root, health, utilities

        # Enable monitoring router to test middleware functionality
        self.app.include_router(
            monitoring.router, prefix="/monitoring", tags=["monitoring"]
        )  # Monitoring and metrics endpoints

        # Include all other routers - middleware is working properly
        self.app.include_router(
            public.router, tags=["public"]
        )  # Public routes (no auth required)
        self.app.include_router(
            auth.router, prefix="/auth", tags=["auth"]
        )  # Includes MFA endpoints at /auth/mfa/*
        self.app.include_router(users.router, prefix="/users", tags=["users"])
        self.app.include_router(
            categories.router, prefix="/categories", tags=["categories"]
        )
        self.app.include_router(
            documents.router, prefix="/documents", tags=["documents"]
        )
        self.app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
        # Debug router removed - CSS service moved to PDF container
        self.app.include_router(
            syntax_highlighting.router,
            prefix="/highlight",
            tags=["syntax-highlighting"],
        )
        self.app.include_router(
            custom_dictionary.router, prefix="/dictionary", tags=["custom-dictionary"]
        )

    def _setup_exception_handlers(self) -> None:
        """Set up global exception handlers (basic ones - comprehensive handled by middleware)."""
        if not self.app:
            raise ValueError("App not initialized")

        # Note: Comprehensive error handling is now done by ErrorHandlingMiddleware
        # These are just fallback handlers for cases not caught by middleware

        # The ErrorHandlingMiddleware handles all exceptions comprehensively
        # No need for additional exception handlers here
        pass

    def create_app(self) -> FastAPI:
        """Create and configure FastAPI application."""
        # Create FastAPI app with enhanced configuration
        self.app = FastAPI(
            title=settings.project_name,
            description=settings.api_description,
            version=settings.api_version,
            openapi_url="/openapi.json",  # Remove v1 prefix
            lifespan=self._create_lifespan(),
            debug=settings.debug,
        )

        # Set up middleware
        self._setup_middleware()

        # Set up exception handlers
        self._setup_exception_handlers()

        # Set up routers
        self._setup_routers()

        logger.info("FastAPI application created successfully")
        return self.app


def create_app() -> FastAPI:
    """Factory function to create FastAPI application."""
    factory = AppFactory()
    return factory.create_app()

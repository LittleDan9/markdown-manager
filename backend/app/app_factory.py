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
    github,
    icons,
    monitoring,
    pdf,
    public,
    syntax_highlighting,
    users,
)

logger = logging.getLogger(__name__)

# Initialize environment configuration
env_config = EnvironmentConfig(settings)


def _create_lifespan():
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


def setup_middleware(app: FastAPI) -> None:
    """Set up application middleware in correct order."""
    # Error handling middleware (first - catches all errors)
    app.add_middleware(
        ErrorHandlingMiddleware, include_debug_info=settings.debug
    )

    # Request context middleware (early - sets up context for other middleware)
    app.add_middleware(RequestContextMiddleware)

    # Monitoring middleware (tracks performance)
    app.add_middleware(
        MonitoringMiddleware, enable_metrics=True, slow_request_threshold=1.0
    )

    # Logging middleware (logs with context from previous middleware)
    app.add_middleware(LoggingMiddleware)

    # CORS middleware (last - handles browser requests)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=env_config.get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def setup_routers(app: FastAPI) -> None:
    """Set up application routers."""
    # Include routers with consolidated structure - start with basics first
    app.include_router(
        default.router, tags=["default"]
    )  # Root, health, utilities

    # Enable monitoring router to test middleware functionality
    app.include_router(
        monitoring.router, prefix="/monitoring", tags=["monitoring"]
    )  # Monitoring and metrics endpoints

    # Include all other routers - middleware is working properly
    app.include_router(
        public.router, tags=["public"]
    )  # Public routes (no auth required)
    app.include_router(
        auth.router, prefix="/auth", tags=["auth"]
    )  # Includes MFA endpoints at /auth/mfa/*
    app.include_router(users.router, prefix="/users", tags=["users"])
    app.include_router(
        icons.router  # Icon service endpoints - tags already defined in router
    )
    app.include_router(
        categories.router, prefix="/categories", tags=["categories"]
    )
    app.include_router(
        documents.router, prefix="/documents", tags=["documents"]
    )
    app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
    # Debug router removed - CSS service moved to PDF container
    app.include_router(
        syntax_highlighting.router,
        prefix="/highlight",
        tags=["syntax-highlighting"],
    )
    app.include_router(
        custom_dictionary.router, prefix="/dictionary", tags=["custom-dictionary"]
    )
    app.include_router(
        github.router, prefix="/github", tags=["github"]
    )


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    # Create FastAPI app with enhanced configuration
    app = FastAPI(
        title=settings.project_name,
        description=settings.api_description,
        version=settings.api_version,
        openapi_url="/openapi.json",  # Remove v1 prefix
        lifespan=_create_lifespan(),
        debug=settings.debug,
    )

    # Set up middleware
    setup_middleware(app)

    # Set up routers
    setup_routers(app)

    logger.info("FastAPI application created successfully")
    return app

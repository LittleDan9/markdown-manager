"""FastAPI Application Factory."""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.formparsers import MultiPartParser

from app.configs import settings

# Raise python-multipart's per-part size cap to match the platform-wide 50MB
# limit. The default (1MB) is hit when pasting large images as base64 form fields.
MultiPartParser.max_part_size = 50 * 1024 * 1024  # 50MB
MultiPartParser.max_file_size = 50 * 1024 * 1024  # 50MB
from app.configs.environment import EnvironmentConfig
from app.database import create_tables
from app.middleware import (
    ErrorHandlingMiddleware,
    LoggingMiddleware,
    MonitoringMiddleware,
    RequestContextMiddleware,
)
from app.routers import (
    attachments,
    auth,
    categories,
    custom_dictionary,
    default,
    documents,
    github,
    github_settings,
    icons,
    images,
    markdown_lint,
    monitoring,
    pdf,
    public,
    syntax_highlighting,
    third_party_router,
    users,
)
from app.routers.admin import router as admin_router
from app.routers import api_keys
from app.routers import chat
from app.routers import comments
from app.routers import notifications
from app.routers import ws as ws_router

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

        # Auto-seed icon packs from bundled seed files
        from app.services.icons.seeder import IconSeeder
        try:
            await IconSeeder().seed_if_needed()
        except Exception:
            logger.exception("Icon seeding failed — continuing startup")

        # Start background git gc service (runs daily to keep repos compact)
        from app.services.storage.git.maintenance import git_maintenance_service
        await git_maintenance_service.start()

        # Start presence tracking cleanup
        from app.services.presence import presence_manager
        await presence_manager.start()

        # Start collaborative editing session manager
        from app.services.collab import collab_manager
        await collab_manager.start()

        yield

        # Shutdown: notify connected clients about maintenance
        logger.info("Shutting down application — notifying connected clients...")

        from app.services.presence import presence_manager
        try:
            await presence_manager.broadcast_maintenance(retry_seconds=5)
        except Exception:
            logger.exception("Failed to send presence maintenance broadcast")

        from app.services.collab import collab_manager as _collab_mgr
        try:
            await _collab_mgr.broadcast_maintenance(retry_seconds=5)
        except Exception:
            logger.exception("Failed to send collab maintenance broadcast")

        # Shutdown: stop background services
        from app.services.storage.git.maintenance import git_maintenance_service
        git_maintenance_service.stop()

        _collab_mgr.stop()

        presence_manager.stop()
        logger.info("Application shutdown complete.")

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
    app.include_router(admin_router, tags=["admin"])  # Already has /admin prefix
    app.include_router(
        icons.router  # Icon service endpoints - tags already defined in router
    )
    app.include_router(
        images.router, tags=["images"]  # Image management endpoints - nginx handles /api prefix
    )
    app.include_router(
        attachments.router, tags=["attachments"]  # File attachment endpoints
    )
    app.include_router(
        third_party_router.router  # Unified third-party browser endpoints (includes legacy /iconify/* routes)
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
        markdown_lint.router, tags=["markdown-lint"]
    )

    from app.routers import spell_check_settings
    app.include_router(
        spell_check_settings.router, tags=["spell-check-settings"]
    )
    app.include_router(
        github.router, prefix="/github", tags=["github"]
    )
    app.include_router(
        github_settings.router, prefix="/github/settings", tags=["github-settings"]
    )
    app.include_router(api_keys.router)  # /api-keys CRUD for LLM provider keys
    app.include_router(chat.router)  # /chat/ask and /chat/health
    app.include_router(notifications.router)  # /notifications
    app.include_router(comments.router)  # /documents/{id}/comments and /comments/{id}
    app.include_router(ws_router.router)  # WebSocket presence

    # Static file serving
    from .routers import static
    app.include_router(static.router)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    # Create FastAPI app with enhanced configuration
    app = FastAPI(
        title=settings.project_name,
        description=settings.api_description,
        version=settings.api_version,
        openapi_url="/openapi.json",  # Keep relative path
        root_path="/api",  # Set root path for proper URL generation behind proxy
        lifespan=_create_lifespan(),
        debug=settings.debug,
    )

    # Set up middleware
    setup_middleware(app)

    # Set up routers
    setup_routers(app)

    # Static files are now served via the static_router (already included in setup_routers)
    # The old StaticFiles mount didn't work properly with root_path="/api"

    logger.info("FastAPI application created successfully")
    return app

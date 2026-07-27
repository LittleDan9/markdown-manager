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
from app.routers import comments
from app.routers import cross_app
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

        # Publish AI provider state for cross-app sync (non-blocking)
        import asyncio
        asyncio.create_task(_startup_publish_providers())

        # Start background event consumer for cross-app events
        _consumer_task = asyncio.create_task(_run_event_consumer())

        # Start periodic AI usage publisher (every 5 min)
        from app.services.ai_usage_publisher import usage_publish_loop
        _usage_task = asyncio.create_task(usage_publish_loop())

        # Register with Platform AI service (non-blocking, retry with backoff)
        asyncio.create_task(_register_with_platform_ai())

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

        # Stop cross-app event consumer
        if _consumer_task and not _consumer_task.done():
            _consumer_task.cancel()
            try:
                await _consumer_task
            except asyncio.CancelledError:
                pass

        logger.info("Application shutdown complete.")

    return lifespan


async def _startup_publish_providers():
    """Background task: publish all users' AI provider state on startup."""
    from app.database import AsyncSessionLocal
    from app.services.ai_provider_events import publish_all_provider_state
    try:
        async with AsyncSessionLocal() as db:
            await publish_all_provider_state(db)
    except Exception as exc:
        logger.warning("Startup provider state publish failed (non-fatal): %s", exc)


async def _run_event_consumer():
    """Background task: consume Redis Stream events from other apps."""
    from app.services.event_consumer_backend import start_event_consumer
    try:
        await start_event_consumer()
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.error("Event consumer crashed: %s", exc)


async def _register_with_platform_ai():
    """Background task: register agents with Platform AI service (retry with backoff)."""
    import asyncio
    import httpx

    platform_url = getattr(settings, "platform_ai_url", "")
    platform_token = getattr(settings, "platform_ai_token", "")
    if not platform_url or not platform_token:
        logger.info("Platform AI URL/token not configured, skipping registration")
        return

    # Get tool definitions from internal_ai module
    from app.routers.internal_ai import _get_mm_tools

    registration = {
        "app_id": "markdown-manager",
        "agents": [{
            "name": "document_assistant",
            "description": "Tools for searching and retrieving markdown documents",
            "tools": _get_mm_tools(),
            "callback_url": "http://mm-backend:8000/api/internal/ai-tools/execute",
        }],
        "context_provider": {
            "url": "http://mm-backend:8000/api/internal/ai-context",
            "scopes": ["all", "current", "help"],
        },
    }

    headers = {
        "X-Platform-AI-Token": platform_token,
        "X-User-Email": "system@markdown-manager",
        "Content-Type": "application/json",
    }

    backoff = [5, 10, 20, 40, 60]
    for attempt, wait in enumerate(backoff):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{platform_url}/api/agents/register",
                    json=registration,
                    headers=headers,
                )
                if resp.status_code == 200:
                    logger.info("Registered with Platform AI service (attempt %d)", attempt + 1)
                    return
                logger.warning("Platform AI registration returned %d (attempt %d)", resp.status_code, attempt + 1)
        except Exception as exc:
            logger.warning("Platform AI registration failed (attempt %d): %s", attempt + 1, exc)
        await asyncio.sleep(wait)
    logger.warning("Platform AI registration failed after %d attempts", len(backoff))


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
        cross_app.router, prefix="/cross-app", tags=["cross-app"]
    )  # Cross-app service-to-service API (token auth)
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
    app.include_router(notifications.router)  # /notifications

    from app.routers import ai_provider_sync
    app.include_router(ai_provider_sync.router)  # /api/ai-provider-sync/*

    from app.routers import ai_usage
    app.include_router(ai_usage.router)  # /api/ai-usage/*

    from app.routers import internal_ai
    app.include_router(internal_ai.router)  # /api/internal/ai-tools/execute, /api/internal/ai-context

    from app.routers import ai_keys_proxy
    app.include_router(ai_keys_proxy.router)  # /api/platform-keys/* (proxy to platform AI)

    from app.routers import ai_chat_proxy
    app.include_router(ai_chat_proxy.router)  # /api/ai/chat, /api/ai/usage, /api/ai/preferences

    from app.routers import help as help_router
    app.include_router(help_router.router)  # /help/topics
    from app.routers import analytics
    app.include_router(analytics.router, tags=["analytics"])  # Guest/user analytics
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

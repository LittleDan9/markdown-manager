"""Export Service FastAPI Application Factory."""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.services.css_service import css_service

logger = logging.getLogger(__name__)


def _create_lifespan():
    """Create lifespan context manager for startup/shutdown events."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Application lifespan events."""
        # Startup
        logger.info("Initializing Export service...")
        await css_service.initialize()
        logger.info("Export service initialized successfully")

        yield

        # Shutdown
        logger.info("Export service shutting down")

    return lifespan


def setup_middleware(app: FastAPI) -> None:
    """Set up application middleware."""
    # Add any middleware here if needed in the future
    # For now, export service doesn't need the complex middleware stack
    pass


def setup_routers(app: FastAPI) -> None:
    """Set up application routers."""
    # Import routers here to avoid circular imports
    from app.routers import pdf, diagram, default, diagramsnet

    # Include routers with clean endpoint structure
    app.include_router(default.router, tags=["default"])
    app.include_router(pdf.router, prefix="/document", tags=["pdf"])
    app.include_router(diagram.router, prefix="/diagram", tags=["diagram"])
    app.include_router(diagramsnet.router, prefix="/diagram", tags=["diagramsnet"])


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    # Create FastAPI app with configuration
    app = FastAPI(
        title="Export Service",
        description="Service for generating PDFs and exporting diagrams from HTML content using Playwright",
        version="2.0.0",
        openapi_url="/openapi.json",
        lifespan=_create_lifespan(),
    )

    # Set up middleware
    setup_middleware(app)

    # Set up routers
    setup_routers(app)

    logger.info("Export Service FastAPI application created successfully")
    return app
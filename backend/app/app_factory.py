"""FastAPI Application Factory."""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.database import create_tables
from app.routers import (
    auth,
    categories,
    custom_dictionary,
    debug,
    documents,
    health,
    mfa,
    pdf,
    public,
    syntax_highlighting,
    users,
)

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for request/response logging."""

    async def dispatch(self, request: Request, call_next):
        """Log requests and responses."""
        # Skip logging for health checks and static files
        skip_paths = ["/favicon.ico", "/docs", "/openapi.json", "/redoc"]
        if request.url.path in skip_paths:
            return await call_next(request)

        # Log request
        logger.info(f"Request: {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            # Log response
            logger.info(
                f"Response: {response.status_code} for {request.method} {request.url.path}"
            )
            return response
        except Exception as e:
            logger.error(
                f"Error processing request {request.method} {request.url.path}: {str(e)}"
            )
            return JSONResponse(
                status_code=500, content={"detail": "Internal server error"}
            )


class AppFactory:
    """Factory class for creating FastAPI applications."""

    def __init__(self):
        """Initialize the app factory."""
        self.app: FastAPI | None = None

    def _create_lifespan(self):
        """Create lifespan context manager for startup/shutdown events."""

        @asynccontextmanager
        async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
            """Application lifespan events."""
            # Startup: create database tables
            logger.info("Starting up application...")
            await create_tables()
            logger.info("Database tables created/verified")

            yield

            # Shutdown: cleanup if needed
            logger.info("Shutting down application...")

        return lifespan

    def _setup_middleware(self) -> None:
        """Set up application middleware."""
        if not self.app:
            raise ValueError("App not initialized")

        # CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://localhost:3000",  # Frontend development
                "https://littledan.com",  # Production domain
            ],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Custom logging middleware
        self.app.add_middleware(LoggingMiddleware)

    def _setup_routers(self) -> None:
        """Set up application routers."""
        if not self.app:
            raise ValueError("App not initialized")

        # Include routers without v1 prefix - flattened structure
        self.app.include_router(
            public.router, tags=["public"]
        )  # Public routes (no auth required)
        self.app.include_router(health.router, tags=["health"])
        self.app.include_router(auth.router, prefix="/auth", tags=["auth"])
        self.app.include_router(mfa.router, prefix="/mfa", tags=["mfa"])
        self.app.include_router(users.router, prefix="/users", tags=["users"])
        self.app.include_router(
            categories.router, prefix="/categories", tags=["categories"]
        )
        self.app.include_router(
            documents.router, prefix="/documents", tags=["documents"]
        )
        self.app.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
        self.app.include_router(debug.router, prefix="/debug", tags=["debug"])
        self.app.include_router(
            syntax_highlighting.router,
            prefix="/highlight",
            tags=["syntax-highlighting"],
        )
        self.app.include_router(
            custom_dictionary.router, prefix="/dictionary", tags=["custom-dictionary"]
        )

    def _setup_exception_handlers(self) -> None:
        """Set up global exception handlers."""
        if not self.app:
            raise ValueError("App not initialized")

        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(request: Request, exc: HTTPException):
            """Handle HTTP exceptions."""
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )

        @self.app.exception_handler(Exception)
        async def general_exception_handler(request: Request, exc: Exception):
            """Handle general exceptions."""
            logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

    def create_app(self) -> FastAPI:
        """Create and configure FastAPI application."""
        # Create FastAPI app with lifespan
        self.app = FastAPI(
            title=settings.project_name,
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

        # Add root endpoint
        @self.app.get("/")
        async def root() -> dict[str, str]:
            """Root endpoint."""
            return {"message": "Markdown Manager API"}

        logger.info("FastAPI application created successfully")
        return self.app


def create_app() -> FastAPI:
    """Factory function to create FastAPI application."""
    factory = AppFactory()
    return factory.create_app()

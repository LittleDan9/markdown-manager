"""Enhanced logging middleware with request IDs and structured logging."""
import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for request/response logging with structured data."""

    def __init__(self, app, skip_paths: list[str] | None = None):
        """Initialize logging middleware.

        Args:
            app: FastAPI application instance
            skip_paths: List of paths to skip logging for
        """
        super().__init__(app)
        self.skip_paths = skip_paths or [
            "/docs",
            "/openapi.json",
            "/redoc",
            "/health",
            "/_health",
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with enhanced logging."""
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Add request ID to request state for access in handlers
        request.state.request_id = request_id

        # Skip logging for certain paths
        if self._should_skip_logging(request):
            return await call_next(request)

        # Start timing
        start_time = time.time()

        # Extract request information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")

        # Log incoming request with structured data
        logger.info(
            "Incoming request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": str(request.query_params),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "content_length": request.headers.get("content-length"),
            },
        )

        try:
            # Process request
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time

            # Log response with structured data
            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time_ms": round(process_time * 1000, 2),
                    "response_size": response.headers.get("content-length"),
                },
            )

            # Add request ID to response headers for tracing
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as exc:
            # Calculate processing time for errors
            process_time = time.time() - start_time

            # Log error with structured data
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error_type": type(exc).__name__,
                    "error_message": str(exc),
                    "process_time_ms": round(process_time * 1000, 2),
                },
                exc_info=True,
            )

            # Re-raise the exception to be handled by error middleware
            raise

    def _should_skip_logging(self, request: Request) -> bool:
        """Check if request should skip logging."""
        return request.url.path in self.skip_paths

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request headers."""
        # Check for forwarded headers from reverse proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

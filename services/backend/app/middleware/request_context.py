"""Request context middleware for managing request-scoped data."""
import logging
from contextvars import ContextVar
from typing import Any, Callable, Dict, Optional
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Context variables for request-scoped data
request_id_var: ContextVar[str] = ContextVar("request_id", default="")
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
request_context_var: ContextVar[Dict[str, Any]] = ContextVar(
    "request_context", default={}
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware for managing request context and user information."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with context management."""
        # Generate or extract request ID
        request_id = self._get_or_generate_request_id(request)

        # Initialize request context
        context = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "user_agent": request.headers.get("user-agent", ""),
            "client_ip": self._get_client_ip(request),
        }

        # Set context variables
        request_id_token = request_id_var.set(request_id)
        context_token = request_context_var.set(context)
        user_id_token = user_id_var.set(None)  # Will be set by auth middleware

        try:
            # Store context in request state for access in route handlers
            request.state.context = context
            request.state.request_id = request_id

            # Process request
            response = await call_next(request)

            # Add context information to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        finally:
            # Reset context variables
            request_id_var.reset(request_id_token)
            request_context_var.reset(context_token)
            user_id_var.reset(user_id_token)

    def _get_or_generate_request_id(self, request: Request) -> str:
        """Get request ID from headers or generate a new one."""
        # Check for existing request ID in headers
        request_id = request.headers.get("X-Request-ID")
        if request_id:
            return request_id

        # Check if already set in request state (by previous middleware)
        if hasattr(request.state, "request_id"):
            return request.state.request_id

        # Generate new request ID
        return str(uuid4())

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request headers."""
        # Check for forwarded headers from reverse proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"


# Utility functions for accessing context in route handlers
def get_request_id() -> Optional[str]:
    """Get the current request ID."""
    return request_id_var.get()

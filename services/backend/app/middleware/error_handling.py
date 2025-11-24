"""Enhanced error handling middleware with structured error responses."""
import logging
import traceback
from typing import Callable

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware

from .request_context import get_request_id

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Comprehensive error handling middleware with structured responses."""

    def __init__(self, app, include_debug_info: bool = False):
        """Initialize error handling middleware.

        Args:
            app: FastAPI application instance
            include_debug_info: Include debug information in error responses
        """
        super().__init__(app)
        self.include_debug_info = include_debug_info

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with comprehensive error handling."""
        try:
            response = await call_next(request)
            return response

        except HTTPException as exc:
            # FastAPI HTTP exceptions - pass through with enhanced logging
            return await self._handle_http_exception(request, exc)

        except ValidationError as exc:
            # Pydantic validation errors
            return await self._handle_validation_error(request, exc)

        except SQLAlchemyError as exc:
            # Database errors
            return await self._handle_database_error(request, exc)

        except PermissionError as exc:
            # Permission/authorization errors
            return await self._handle_permission_error(request, exc)

        except FileNotFoundError as exc:
            # File operation errors
            return await self._handle_file_not_found_error(request, exc)

        except ValueError as exc:
            # Value/input errors
            return await self._handle_value_error(request, exc)

        except Exception as exc:
            # Unhandled exceptions
            return await self._handle_general_error(request, exc)

    async def _handle_http_exception(
        self, request: Request, exc: HTTPException
    ) -> JSONResponse:
        """Handle FastAPI HTTP exceptions."""
        request_id = get_request_id()

        logger.warning(
            f"HTTP exception: {exc.status_code} - {exc.detail}",
            extra={
                "request_id": request_id,
                "status_code": exc.status_code,
                "detail": exc.detail,
                "path": request.url.path,
                "method": request.method,
            },
        )

        response_data = {
            "error": {
                "type": "http_error",
                "message": exc.detail,
                "status_code": exc.status_code,
                "request_id": request_id,
            }
        }

        if self.include_debug_info:
            response_data["error"]["path"] = request.url.path
            response_data["error"]["method"] = request.method

        return JSONResponse(
            status_code=exc.status_code,
            content=response_data,
            headers=getattr(exc, "headers", None),
        )

    async def _handle_validation_error(
        self, request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        request_id = get_request_id()

        logger.warning(
            f"Validation error: {str(exc)}",
            extra={
                "request_id": request_id,
                "error_count": exc.error_count(),
                "path": request.url.path,
                "method": request.method,
            },
        )

        # Format validation errors for client
        formatted_errors = []
        for error in exc.errors():
            formatted_errors.append(
                {
                    "field": ".".join(str(loc) for loc in error["loc"]),
                    "message": error["msg"],
                    "type": error["type"],
                }
            )

        response_data = {
            "error": {
                "type": "validation_error",
                "message": "Request validation failed",
                "request_id": request_id,
                "details": formatted_errors,
            }
        }

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=response_data,
        )

    async def _handle_database_error(
        self, request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """Handle database errors."""
        request_id = get_request_id()

        logger.error(
            f"Database error: {str(exc)}",
            extra={
                "request_id": request_id,
                "error_type": type(exc).__name__,
                "path": request.url.path,
                "method": request.method,
            },
            exc_info=True,
        )

        response_data = {
            "error": {
                "type": "database_error",
                "message": "A database error occurred",
                "request_id": request_id,
            }
        }

        if self.include_debug_info:
            response_data["error"]["debug_info"] = str(exc)

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_data,
        )

    async def _handle_permission_error(
        self, request: Request, exc: PermissionError
    ) -> JSONResponse:
        """Handle permission/authorization errors."""
        request_id = get_request_id()

        logger.warning(
            f"Permission error: {str(exc)}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )

        response_data = {
            "error": {
                "type": "permission_error",
                "message": "Access denied",
                "request_id": request_id,
            }
        }

        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response_data,
        )

    async def _handle_file_not_found_error(
        self, request: Request, exc: FileNotFoundError
    ) -> JSONResponse:
        """Handle file not found errors."""
        request_id = get_request_id()

        logger.warning(
            f"File not found error: {str(exc)}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )

        response_data = {
            "error": {
                "type": "file_not_found",
                "message": "Requested file not found",
                "request_id": request_id,
            }
        }

        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=response_data,
        )

    async def _handle_value_error(
        self, request: Request, exc: ValueError
    ) -> JSONResponse:
        """Handle value/input errors."""
        request_id = get_request_id()

        logger.warning(
            f"Value error: {str(exc)}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )

        response_data = {
            "error": {
                "type": "value_error",
                "message": "Invalid input value",
                "request_id": request_id,
            }
        }

        if self.include_debug_info:
            response_data["error"]["debug_info"] = str(exc)

        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=response_data,
        )

    async def _handle_general_error(
        self, request: Request, exc: Exception
    ) -> JSONResponse:
        """Handle unhandled exceptions."""
        request_id = get_request_id()

        logger.error(
            f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
            extra={
                "request_id": request_id,
                "error_type": type(exc).__name__,
                "path": request.url.path,
                "method": request.method,
            },
            exc_info=True,
        )

        response_data = {
            "error": {
                "type": "internal_error",
                "message": "An internal server error occurred",
                "request_id": request_id,
            }
        }

        if self.include_debug_info:
            response_data["error"]["debug_info"] = {
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
                "traceback": traceback.format_exc(),
            }

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_data,
        )

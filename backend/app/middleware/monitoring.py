"""Monitoring middleware for performance metrics and health tracking."""
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


@dataclass
class RequestMetrics:
    """Request metrics data structure."""

    total_requests: int = 0
    success_requests: int = 0
    error_requests: int = 0
    total_response_time: float = 0.0
    max_response_time: float = 0.0
    min_response_time: float = float("inf")
    status_codes: Dict[int, int] = field(default_factory=lambda: defaultdict(int))
    recent_response_times: deque = field(default_factory=lambda: deque(maxlen=100))


class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for collecting performance metrics and monitoring data."""

    def __init__(
        self, app, enable_metrics: bool = True, slow_request_threshold: float = 1.0
    ):
        """Initialize monitoring middleware.

        Args:
            app: FastAPI application instance
            enable_metrics: Enable metrics collection
            slow_request_threshold: Threshold in seconds for slow request logging
        """
        super().__init__(app)
        self.enable_metrics = enable_metrics
        self.slow_request_threshold = slow_request_threshold
        self.metrics = RequestMetrics()
        self.start_time = datetime.now()

        # Recent requests for rate limiting and analysis
        self.recent_requests = deque(maxlen=1000)

        # Register this instance globally for monitoring endpoints
        self._register_globally()

    def _register_globally(self):
        """Register this middleware instance for global access."""
        try:
            from app.routers.monitoring import set_monitoring_middleware

            set_monitoring_middleware(self)
        except ImportError:
            # monitoring router not available, skip registration
            pass

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with monitoring."""
        if not self.enable_metrics:
            return await call_next(request)

        start_time = time.time()
        request_timestamp = datetime.now()

        # Add monitoring data to request state
        request.state.start_time = start_time
        request.state.request_timestamp = request_timestamp

        try:
            # Process request
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time

            # Update metrics
            self._update_metrics(
                response.status_code, process_time, request.url.path, request.method
            )

            # Log slow requests
            if process_time > self.slow_request_threshold:
                logger.warning(
                    f"Slow request detected: {request.method} {request.url.path} "
                    f"took {process_time:.2f}s",
                    extra={
                        "request_id": getattr(request.state, "request_id", "unknown"),
                        "method": request.method,
                        "path": request.url.path,
                        "process_time": process_time,
                        "status_code": response.status_code,
                    },
                )

            # Add performance headers
            response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))

            return response

        except Exception as exc:
            # Calculate processing time for errors
            process_time = time.time() - start_time

            # Update metrics for error
            self._update_metrics(500, process_time, request.url.path, request.method)

            # Log error metrics
            logger.error(
                f"Request error: {request.method} {request.url.path} "
                f"failed after {process_time:.2f}s",
                extra={
                    "request_id": getattr(request.state, "request_id", "unknown"),
                    "method": request.method,
                    "path": request.url.path,
                    "process_time": process_time,
                    "error_type": type(exc).__name__,
                },
            )

            # Re-raise the exception
            raise

    def _update_metrics(
        self, status_code: int, process_time: float, path: str, method: str
    ) -> None:
        """Update request metrics."""
        self.metrics.total_requests += 1

        # Update success/error counts
        if 200 <= status_code < 400:
            self.metrics.success_requests += 1
        else:
            self.metrics.error_requests += 1

        # Update response time metrics
        self.metrics.total_response_time += process_time
        self.metrics.max_response_time = max(
            self.metrics.max_response_time, process_time
        )
        self.metrics.min_response_time = min(
            self.metrics.min_response_time, process_time
        )

        # Update status code counts
        self.metrics.status_codes[status_code] += 1

        # Add to recent response times for rolling averages
        self.metrics.recent_response_times.append(process_time)

        # Track recent requests with timestamp
        self.recent_requests.append(
            {
                "timestamp": datetime.now(),
                "method": method,
                "path": path,
                "status_code": status_code,
                "process_time": process_time,
            }
        )

    def get_metrics(self) -> dict:
        """Get current metrics summary."""
        if self.metrics.total_requests == 0:
            return {
                "uptime_seconds": (datetime.now() - self.start_time).total_seconds(),
                "total_requests": 0,
                "requests_per_second": 0.0,
                "average_response_time": 0.0,
                "success_rate": 0.0,
            }

        uptime = (datetime.now() - self.start_time).total_seconds()
        avg_response_time = (
            self.metrics.total_response_time / self.metrics.total_requests
        )
        success_rate = self.metrics.success_requests / self.metrics.total_requests * 100
        requests_per_second = self.metrics.total_requests / max(uptime, 1)

        # Calculate recent average (last 100 requests)
        recent_avg = 0.0
        if self.metrics.recent_response_times:
            recent_avg = sum(self.metrics.recent_response_times) / len(
                self.metrics.recent_response_times
            )

        return {
            "uptime_seconds": uptime,
            "total_requests": self.metrics.total_requests,
            "success_requests": self.metrics.success_requests,
            "error_requests": self.metrics.error_requests,
            "requests_per_second": round(requests_per_second, 2),
            "average_response_time_ms": round(avg_response_time * 1000, 2),
            "recent_average_response_time_ms": round(recent_avg * 1000, 2),
            "max_response_time_ms": round(self.metrics.max_response_time * 1000, 2),
            "min_response_time_ms": round(self.metrics.min_response_time * 1000, 2),
            "success_rate_percent": round(success_rate, 2),
            "status_codes": dict(self.metrics.status_codes),
        }

    def get_recent_requests(self, minutes: int = 5) -> list:
        """Get recent requests within specified time window."""
        cutoff_time = datetime.now() - timedelta(minutes=minutes)
        return [req for req in self.recent_requests if req["timestamp"] > cutoff_time]

    def reset_metrics(self) -> None:
        """Reset all metrics."""
        self.metrics = RequestMetrics()
        self.start_time = datetime.now()
        self.recent_requests.clear()
        logger.info("Monitoring metrics reset")

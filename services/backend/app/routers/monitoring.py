"""Monitoring and health check endpoints."""
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Global monitoring middleware instance (will be set by app factory)
monitoring_middleware = None


def set_monitoring_middleware(middleware):
    """Set the global monitoring middleware instance."""
    global monitoring_middleware
    monitoring_middleware = middleware


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "markdown-manager-api"}


@router.get("/health/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with system information."""
    try:
        import platform
        from datetime import datetime, timezone

        import psutil

        # Basic system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        return {
            "status": "healthy",
            "service": "markdown-manager-api",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_percent": cpu_percent,
                "memory": {
                    "total_mb": round(memory.total / 1024 / 1024, 2),
                    "available_mb": round(memory.available / 1024 / 1024, 2),
                    "percent_used": memory.percent,
                },
                "disk": {
                    "total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
                    "free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
                    "percent_used": round((disk.used / disk.total) * 100, 2),
                },
            },
        }
    except ImportError:
        # psutil not available, return basic health info
        import platform
        from datetime import datetime, timezone

        return {
            "status": "healthy",
            "service": "markdown-manager-api",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "system": {
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "note": "Extended system metrics not available (psutil not installed)",
            },
        }


@router.get("/metrics", response_model=None)
async def get_metrics():
    """Get application performance metrics."""
    if not monitoring_middleware:
        raise HTTPException(status_code=503, detail="Monitoring not available")

    metrics = monitoring_middleware.get_metrics()
    return {
        "status": "ok",
        "metrics": metrics,
    }


@router.get("/metrics/recent-requests", response_model=None)
async def get_recent_requests(minutes: int = 5):
    """Get recent requests within specified time window."""
    if not monitoring_middleware:
        raise HTTPException(status_code=503, detail="Monitoring not available")

    recent_requests = monitoring_middleware.get_recent_requests(minutes)
    return {
        "status": "ok",
        "time_window_minutes": minutes,
        "request_count": len(recent_requests),
        "requests": recent_requests,
    }


@router.post("/metrics/reset", response_model=None)
async def reset_metrics():
    """Reset application metrics (admin endpoint)."""
    if not monitoring_middleware:
        raise HTTPException(status_code=503, detail="Monitoring not available")

    monitoring_middleware.reset_metrics()
    return {"status": "ok", "message": "Metrics reset successfully"}

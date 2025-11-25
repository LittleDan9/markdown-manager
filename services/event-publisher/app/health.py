"""Health check and metrics endpoints for relay service."""

import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .metrics import relay_metrics
from .config import Settings

logger = logging.getLogger(__name__)


def setup_health_endpoints(app: FastAPI, settings: Settings, session_factory):
    """Set up health check and metrics endpoints for relay service."""

    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        """Basic health check endpoint."""
        return {
            "status": "healthy",
            "service": "relay-service",
            "version": "1.0.0"
        }

    @app.get("/health/detailed")
    async def detailed_health_check() -> Dict[str, Any]:
        """Detailed health check with system status."""
        services = {}
        overall_status = "healthy"

        # Check database connection
        try:
            async with session_factory() as session:
                await session.execute(text("SELECT 1"))
                services["database"] = {"status": "healthy", "details": "Connected"}
        except Exception as e:
            services["database"] = {"status": "unhealthy", "details": f"Connection failed: {str(e)}"}
            overall_status = "degraded"

        # Check Redis connection
        try:
            redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            ping_result = await redis_client.ping()

            # Get Redis info
            info = await redis_client.info()
            memory_used_mb = round(info.get('used_memory', 0) / 1024 / 1024, 2)
            aof_enabled = info.get('aof_enabled', 0) == 1

            services["redis"] = {
                "status": "healthy" if ping_result and aof_enabled else "degraded",
                "details": f"PING: {ping_result}, Memory: {memory_used_mb}MB, AOF: {'enabled' if aof_enabled else 'disabled'}"
            }

            if not aof_enabled:
                overall_status = "degraded"

            await redis_client.close()

        except Exception as e:
            services["redis"] = {"status": "unhealthy", "details": f"Connection failed: {str(e)}"}
            overall_status = "degraded"

        # Check outbox backlog (warning if too high)
        try:
            async with session_factory() as session:
                result = await session.execute(text(
                    "SELECT COUNT(*) FROM identity.outbox WHERE published = FALSE"
                ))
                backlog_count = result.scalar()
                relay_metrics.set_outbox_backlog(backlog_count)

                backlog_status = "healthy"
                if backlog_count > 1000:
                    backlog_status = "critical"
                    overall_status = "degraded"
                elif backlog_count > 100:
                    backlog_status = "warning"

                services["outbox"] = {
                    "status": backlog_status,
                    "details": f"Backlog: {backlog_count} unpublished events"
                }

        except Exception as e:
            services["outbox"] = {"status": "unhealthy", "details": f"Backlog check failed: {str(e)}"}
            overall_status = "degraded"

        return {
            "status": overall_status,
            "service": "relay-service",
            "version": "1.0.0",
            "services": services,
            "metrics": relay_metrics.get_metrics()
        }

    @app.get("/metrics")
    async def get_metrics() -> Dict[str, Any]:
        """Get relay service metrics."""
        return {
            "status": "ok",
            "metrics": relay_metrics.get_metrics()
        }

    @app.post("/metrics/reset")
    async def reset_metrics() -> Dict[str, str]:
        """Reset metrics (admin endpoint)."""
        relay_metrics.reset_metrics()
        return {"status": "ok", "message": "Metrics reset successfully"}
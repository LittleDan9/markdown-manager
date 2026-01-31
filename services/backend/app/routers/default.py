"""Default router for root, health, and utility endpoints."""
import httpx
import redis.asyncio as redis
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.database import get_db
from app.services.export_service_client import export_service_client
from app.services.icon_service import IconService

router = APIRouter()


class ServiceHealth(BaseModel):
    """Service health status model."""

    status: str
    details: str | None = None
    consumer_groups: list[dict] | None = None


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    version: str
    services: dict[str, ServiceHealth]


async def _check_http_service(service_url: str, service_name: str) -> ServiceHealth:
    """Check health of an HTTP service."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{service_url}/health")
            if response.status_code == 200:
                return ServiceHealth(status="healthy", details="Responsive")
            else:
                return ServiceHealth(
                    status="unhealthy", details=f"HTTP {response.status_code}"
                )
    except Exception as e:
        return ServiceHealth(
            status="unhealthy", details=f"Health check failed: {str(e)}"
        )


async def _check_consumer_group_health(redis_client, stream: str, group_name: str) -> dict:
    """Check health of a single consumer group."""
    try:
        consumers = await redis_client.execute_command("XINFO", "CONSUMERS", stream, group_name)
        
        active_consumers = 0
        total_consumers = len(consumers)
        consumer_details = []
        
        for consumer_info in consumers:
            consumer_data = dict(zip(consumer_info[::2], consumer_info[1::2]))
            consumer_name = consumer_data.get('name', 'unknown')
            idle_time = int(consumer_data.get('idle', 0))
            pending = int(consumer_data.get('pending', 0))
            
            # Consider healthy if:
            # - Idle < 5 minutes (300000ms) - allows for reasonable processing delays
            # - Pending < 50 - not severely backlogged
            is_healthy = idle_time < 300000 and pending < 50
            
            if is_healthy:
                active_consumers += 1
                
            consumer_details.append({
                'name': consumer_name,
                'idle_minutes': round(idle_time / 60000, 1),
                'pending': pending,
                'healthy': is_healthy
            })
        
        return {
            "stream": stream,
            "group": group_name,
            "total_consumers": total_consumers,
            "active_consumers": active_consumers,
            "healthy": active_consumers > 0,
            "consumers": consumer_details
        }
    except Exception as e:
        return {
            "stream": stream,
            "group": group_name,
            "error": f"Failed to get consumers: {str(e)}",
            "healthy": False
        }


async def _check_event_consumers(redis_client) -> dict:
    """Check health of all event consumers by querying Redis streams."""
    try:
        # Get all streams
        streams = await redis_client.execute_command("SCAN", "0", "MATCH", "*", "TYPE", "stream")
        stream_keys = streams[1] if len(streams) > 1 else []
        
        if not stream_keys:
            return {
                "status": "healthy",
                "details": "No streams found - no consumers expected"
            }
        
        consumer_groups = []
        healthy_groups = 0
        
        for stream in stream_keys:
            try:
                # Get consumer groups for this stream
                groups = await redis_client.execute_command("XINFO", "GROUPS", stream)
                
                for group_info in groups:
                    group_data = dict(zip(group_info[::2], group_info[1::2]))
                    group_name = group_data.get('name', 'unknown')
                    
                    # Check this consumer group
                    group_health = await _check_consumer_group_health(redis_client, stream, group_name)
                    consumer_groups.append(group_health)
                    
                    if group_health.get("healthy", False):
                        healthy_groups += 1
                        
            except Exception:
                # Stream exists but no groups - this is fine
                pass
        
        if not consumer_groups:
            return {
                "status": "healthy",
                "details": "No consumer groups found"
            }
        
        # Calculate totals
        total_consumers = sum(g.get('total_consumers', 0) for g in consumer_groups)
        healthy_consumers = sum(g.get('active_consumers', 0) for g in consumer_groups)
        
        # Determine overall status
        if healthy_groups == 0:
            status = "unhealthy"
        elif healthy_groups < len(consumer_groups):
            status = "degraded"
        else:
            status = "healthy"
            
        # Create descriptive details message
        if len(consumer_groups) == 1:
            group_msg = "1 consumer group"
        else:
            group_msg = f"{healthy_groups}/{len(consumer_groups)} consumer groups"
            
        details = f"{group_msg} operational • {healthy_consumers}/{total_consumers} consumer instances healthy"
        
        return {
            "status": status,
            "details": details,
            "consumer_groups": consumer_groups
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "details": f"Failed to check consumers: {str(e)}"
        }


@router.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Markdown Manager API"}


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """Comprehensive health check endpoint."""
    services = {}
    overall_status = "healthy"

    # Check database health
    try:
        await db.execute(text("SELECT 1"))
        services["database"] = ServiceHealth(status="healthy", details="Connected")
    except Exception as e:
        services["database"] = ServiceHealth(
            status="unhealthy", details=f"Connection failed: {str(e)}"
        )
        overall_status = "degraded"

    # Check export service health
    try:
        export_healthy = await export_service_client.health_check()
        if export_healthy:
            services["export_service"] = ServiceHealth(
                status="healthy", details="Responsive"
            )
        else:
            services["export_service"] = ServiceHealth(
                status="unhealthy", details="Service not responding"
            )
            overall_status = "degraded"
    except Exception as e:
        services["export_service"] = ServiceHealth(
            status="unhealthy", details=f"Health check failed: {str(e)}"
        )
        overall_status = "degraded"

    # Check icon service health
    try:
        icon_service = IconService(db)
        icon_health = await icon_service.health_check()
        services["icon_service"] = ServiceHealth(
            status=icon_health["status"],
            details=icon_health["details"]
        )
        if icon_health["status"] != "healthy":
            overall_status = "degraded"
    except Exception as e:
        services["icon_service"] = ServiceHealth(
            status="unhealthy", details=f"Health check failed: {str(e)}"
        )
        overall_status = "degraded"

    # Check linting service health
    linting_health = await _check_http_service(settings.markdown_lint_service_url, "linting_service")
    services["linting_service"] = linting_health
    if linting_health.status != "healthy":
        overall_status = "degraded"

    # Check spell-check service health
    spell_check_health = await _check_http_service(settings.spell_check_service_url, "spell_check_service")
    services["spell_check_service"] = spell_check_health
    if spell_check_health.status != "healthy":
        overall_status = "degraded"

    # Note: Event publisher is a background service without HTTP endpoints in production
    # so we skip the HTTP health check for now
    # TODO: Consider implementing a different health check mechanism for background services
    services["event_publisher"] = ServiceHealth(
        status="healthy", 
        details="Background service (not HTTP checkable)",
        consumer_groups=None
    )

    # Check Redis health
    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)

        # Test basic connectivity
        ping_result = await redis_client.ping()

        # Get Redis info
        info = await redis_client.info()
        memory_used_mb = round(info.get('used_memory', 0) / 1024 / 1024, 2)
        memory_peak_mb = round(info.get('used_memory_peak', 0) / 1024 / 1024, 2)
        aof_enabled = info.get('aof_enabled', 0) == 1

        # Check if AOF is enabled (required for durability)
        redis_status = "healthy" if ping_result and aof_enabled else "degraded"
        aof_status = "enabled" if aof_enabled else "disabled (WARNING: no persistence)"

        services["redis"] = ServiceHealth(
            status=redis_status,
            details=f"PING: {ping_result}, Memory: {memory_used_mb}MB (peak: {memory_peak_mb}MB), AOF: {aof_status}"
        )

        if redis_status != "healthy":
            overall_status = "degraded"

        # Check event consumers while we have Redis connection
        try:
            consumers_status = await _check_event_consumers(redis_client)
            services["event_consumers"] = ServiceHealth(
                status=consumers_status["status"],
                details=consumers_status["details"],
                consumer_groups=consumers_status.get("consumer_groups")
            )
            if consumers_status["status"] != "healthy":
                overall_status = "degraded"
        except Exception as e:
            services["event_consumers"] = ServiceHealth(
                status="unhealthy", details=f"Consumer check failed: {str(e)}"
            )
            overall_status = "degraded"

        await redis_client.close()

    except Exception as e:
        services["redis"] = ServiceHealth(
            status="unhealthy", details=f"Connection failed: {str(e)}"
        )
        overall_status = "degraded"

    return HealthResponse(status=overall_status, version="1.0.0", services=services)

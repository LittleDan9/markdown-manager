"""Health check endpoint."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.pdf_service_client import pdf_service_client

router = APIRouter()


class ServiceHealth(BaseModel):
    """Service health status model."""

    status: str
    details: str | None = None


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    version: str
    services: dict[str, ServiceHealth]


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

    # Check PDF service health
    try:
        pdf_healthy = await pdf_service_client.health_check()
        if pdf_healthy:
            services["pdf_service"] = ServiceHealth(
                status="healthy", details="Responsive"
            )
        else:
            services["pdf_service"] = ServiceHealth(
                status="unhealthy", details="Service not responding"
            )
            overall_status = "degraded"
    except Exception as e:
        services["pdf_service"] = ServiceHealth(
            status="unhealthy", details=f"Health check failed: {str(e)}"
        )
        overall_status = "degraded"

    return HealthResponse(status=overall_status, version="1.0.0", services=services)

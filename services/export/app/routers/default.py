"""Default router for health and root endpoints."""
import time
import psutil
from fastapi import APIRouter

router = APIRouter()

# Service statistics tracking
service_stats = {
    "start_time": time.time(),
    "requests_processed": 0,
    "successful_exports": 0,
    "failed_exports": 0,
    "pdf_exports": 0,
    "svg_exports": 0, 
    "png_exports": 0,
    "mermaid_diagrams": 0,
    "total_processing_time": 0.0
}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "export-service", "version": "2.0.0"}


@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with service metrics."""
    uptime_seconds = time.time() - service_stats["start_time"]
    memory_info = psutil.Process().memory_info()
    
    return {
        "status": "healthy",
        "service": "export-service", 
        "version": "2.0.0",
        "uptime": {
            "seconds": round(uptime_seconds, 2),
            "minutes": round(uptime_seconds / 60, 2),
            "hours": round(uptime_seconds / 3600, 2)
        },
        "statistics": {
            "total_requests": service_stats["requests_processed"],
            "successful_exports": service_stats["successful_exports"],
            "failed_exports": service_stats["failed_exports"],
            "success_rate": f"{(service_stats['successful_exports'] / max(service_stats['requests_processed'], 1) * 100):.2f}%",
            "average_processing_time": f"{(service_stats['total_processing_time'] / max(service_stats['requests_processed'], 1)):.2f}s"
        },
        "export_breakdown": {
            "pdf_documents": service_stats["pdf_exports"],
            "svg_diagrams": service_stats["svg_exports"],
            "png_diagrams": service_stats["png_exports"],
            "mermaid_diagrams": service_stats["mermaid_diagrams"]
        },
        "system_resources": {
            "memory_usage": {
                "rss": f"{memory_info.rss / 1024 / 1024:.2f} MB",
                "vms": f"{memory_info.vms / 1024 / 1024:.2f} MB"
            },
            "cpu_percent": f"{psutil.Process().cpu_percent()}%"
        },
        "capabilities": {
            "supported_formats": ["PDF", "SVG", "PNG"],
            "diagram_types": ["Mermaid", "PlantUML", "Drawio"],
            "playwright_available": True,
            "css_service_loaded": True
        }
    }


@router.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Export Service",
        "version": "2.0.0",
        "description": "Service for generating PDFs and exporting diagrams using Playwright",
        "endpoints": {
            "document_pdf": "/document/pdf",
            "diagram_svg": "/diagram/svg",
            "diagram_png": "/diagram/png",
            "diagram_diagrams": "/diagram/diagrams",
            "health": "/health"
        },
    }
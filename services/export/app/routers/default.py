"""Default router for health and root endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "export-service", "version": "2.0.0"}


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
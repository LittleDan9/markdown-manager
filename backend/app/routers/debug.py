"""Debug endpoints for development."""
from fastapi import APIRouter

from app.services.css_service import css_service

router = APIRouter()


@router.get("/css-status")
async def get_css_status() -> dict[str, object]:
    """Get CSS service status for debugging."""
    return {
        "prism_version": css_service.get_prism_themes_version(),
        "cached_css_files": list(css_service.css_cache.keys()),
        "css_file_sizes": {
            name: len(content) for name, content in css_service.css_cache.items()
        },
    }


@router.post("/refresh-prism")
async def refresh_prism_css(version: str | None = None) -> dict[str, str]:
    """Refresh Prism.js CSS from CDN."""
    await css_service.refresh_prism_css(version)
    return {
        "message": "Prism CSS refreshed",
        "version": css_service.get_prism_themes_version(),
    }

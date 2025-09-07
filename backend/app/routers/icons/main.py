"""
Main Icon API Router - Combines all icon-related endpoints

This module aggregates all icon API functionality from domain-specific routers:
- Icon pack management
- Icon search and metadata
- Cache management
- Usage statistics

Maintains compatibility with existing API while providing better code organization.
"""

from fastapi import APIRouter, Depends, HTTPException

from ...schemas.icon_schemas import IconMetadataResponse
from .search import get_icon_service
from . import packs, search, cache, statistics, upload

# Create main icon router (no tags to avoid duplication)
router = APIRouter(prefix="/icons")


@router.get(
    "/{icon_id}",
    response_model=IconMetadataResponse,
    summary="Get icon by ID",
    description="Get detailed metadata for a specific icon by its ID",
    tags=["Icons"]
)
async def get_icon(
    icon_id: int,
    icon_service=Depends(get_icon_service)
):
    """Get detailed metadata for a specific icon by its ID."""
    try:
        icon = await icon_service.get_icon_by_id(icon_id)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )
        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon: {str(e)}"
        )


# Include all domain-specific routers
# Note: Order matters! More specific routes should be defined before general ones
router.include_router(packs.router)
router.include_router(search.router)
router.include_router(cache.router)
router.include_router(statistics.router)
router.include_router(upload.router)

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
    "",
    summary="Get icon overview",
    description="Get a summary of available icon packs and total counts",
    tags=["Icons"]
)
async def get_icon_overview(
    icon_service=Depends(get_icon_service)
):
    """Get an overview of available icon packs and statistics."""
    try:
        packs = await icon_service.get_icon_packs()
        total_icons = sum(pack.icon_count for pack in packs)
        total_packs = len(packs)
        
        # Get categories
        categories = sorted(list(set(pack.category for pack in packs if pack.category)))
        
        return {
            "total_packs": total_packs,
            "total_icons": total_icons,
            "categories": categories,
            "recent_packs": packs[:5] if packs else []  # Show 5 most recent
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon overview: {str(e)}"
        )


@router.get(
    "/pack/{pack_name}",
    summary="Get all icons from a specific pack",
    description="Get all icons from a specific icon pack with optional pagination",
    tags=["Icons"]
)
async def get_pack_icons(
    pack_name: str,
    page: int = 0,
    size: int = 50,
    icon_service=Depends(get_icon_service)
):
    """Get all icons from a specific pack."""
    try:
        # Use the search functionality to get icons from a specific pack
        from ...schemas.icon_schemas import IconSearchRequest
        
        search_request = IconSearchRequest(
            q="",  # No text search
            pack=pack_name,
            category="all",
            page=page,
            size=size
        )
        result = await icon_service.search_icons(search_request)
        
        if result.total == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Pack '{pack_name}' not found or has no icons"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack icons: {str(e)}"
        )


# Include all domain-specific routers
# Note: Order matters! More specific routes should be defined before general ones
router.include_router(packs.router)
router.include_router(search.router)
router.include_router(cache.router)
router.include_router(statistics.router)
router.include_router(upload.router)


# Put the generic /{icon_id} route LAST to avoid conflicts
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

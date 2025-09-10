"""
RESTful Icon API Router - Clean, hierarchical endpoint structure

This module implements a proper RESTful API design for icons with:
- Clear resource hierarchies (packs -> icons)
- Consistent HTTP methods and status codes
- Separate search functionality
- Direct raw content serving
- Reference URLs in responses
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import traceback
import logging

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import (
    IconPackResponse,
    IconMetadataResponse,
    IconSearchRequest,
    IconSearchResponse,
)

# Create main router
router = APIRouter(tags=["Icons API"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


# ============================================================================
# ICON PACKS ENDPOINTS - /icons/packs/*
# ============================================================================

@router.get(
    "/packs",
    response_model=List[IconPackResponse],
    summary="List all icon packs",
    description="Get a list of all available icon packs with metadata and icon counts"
)
async def list_icon_packs(
    category: Optional[str] = None,
    icon_service: IconService = Depends(get_icon_service)
):
    """List all icon packs, optionally filtered by category."""
    try:
        packs = await icon_service.get_icon_packs()

        if category and category != "all":
            packs = [pack for pack in packs if pack.category == category]

        # Add reference URLs to each pack
        for pack in packs:
            pack.urls = {
                "self": f"/icons/packs/{pack.name}",
                "icons": f"/icons/packs/{pack.name}",
                "search": f"/icons/search?pack={pack.name}"
            }

        return packs
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list icon packs: {str(e)}"
        )


@router.get(
    "/packs/{pack_name}",
    response_model=IconPackResponse,
    summary="Get specific icon pack",
    description="Get metadata for a specific icon pack by name"
)
async def get_icon_pack(
    pack_name: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get metadata for a specific icon pack."""
    try:
        packs = await icon_service.get_icon_packs()
        pack = next((p for p in packs if p.name == pack_name), None)

        if not pack:
            raise HTTPException(
                status_code=404,
                detail=f"Icon pack '{pack_name}' not found"
            )

        # Add reference URLs
        pack.urls = {
            "self": f"/icons/packs/{pack.name}",
            "icons": f"/icons/packs/{pack.name}",
            "search": f"/icons/search?pack={pack.name}"
        }

        return pack
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon pack: {str(e)}"
        )


@router.get(
    "/packs/{pack_name}",
    summary="List icons in pack",
    description="Get all icons from a specific pack with pagination"
)
async def list_pack_icons(
    pack_name: str,
    page: int = 0,
    size: int = 50,
    icon_service: IconService = Depends(get_icon_service)
):
    """List all icons in a specific pack."""
    try:
        search_request = IconSearchRequest(
            q="",
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

        # Add reference URLs to each icon
        for icon in result.icons:
            icon.urls = {
                "self": f"/icons/packs/{pack_name}/{icon.key}",
                "raw": f"/icons/packs/{pack_name}/{icon.key}/raw",
                "svg": f"/icons/packs/{pack_name}/{icon.key}/svg",
                "pack": f"/icons/packs/{pack_name}"
            }

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list pack icons: {str(e)}"
        )


@router.get(
    "/packs/{pack_name}/{icon_key}",
    response_model=IconMetadataResponse,
    summary="Get specific icon metadata",
    description="Get detailed metadata for a specific icon within a pack"
)
async def get_icon_metadata(
    pack_name: str,
    icon_key: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get metadata for a specific icon."""
    try:
        icon = await icon_service.get_icon_metadata(pack_name, icon_key)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon '{icon_key}' not found in pack '{pack_name}'"
            )

        # Add reference URLs
        icon.urls = {
            "self": f"/icons/packs/{pack_name}/{icon_key}",
            "raw": f"/icons/packs/{pack_name}/{icon_key}/raw",
            "svg": f"/icons/packs/{pack_name}/{icon_key}/svg",
            "pack": f"/icons/packs/{pack_name}"
        }

        return icon
    except HTTPException:
        raise
    except Exception as e:
        # Log the full stack trace for debugging
        logging.error(f"Failed to get icon metadata for {pack_name}:{icon_key}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": f"Failed to get icon metadata: {str(e)}",
                "type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
        )


@router.get(
    "/packs/{pack_name}/{icon_key}/raw",
    summary="Get raw icon content",
    description="Get the raw SVG content for direct browser rendering",
    responses={
        200: {
            "content": {"image/svg+xml": {}},
            "description": "SVG content ready for browser rendering"
        }
    }
)
async def get_icon_raw(
    pack_name: str,
    icon_key: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get raw SVG content for direct browser rendering."""
    try:
        svg_data = await icon_service.get_icon_svg(pack_name, icon_key)
        if not svg_data:
            raise HTTPException(
                status_code=404,
                detail=f"Icon '{icon_key}' not found in pack '{pack_name}'"
            )

        # Return raw SVG with proper headers for browser rendering
        return Response(
            content=svg_data,
            media_type="image/svg+xml",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Disposition": f"inline; filename=\"{pack_name}-{icon_key}.svg\""
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        # Log the full stack trace for debugging
        logging.error(f"Failed to get raw icon for {pack_name}:{icon_key}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": f"Failed to get raw icon: {str(e)}",
                "type": type(e).__name__,
                "traceback": traceback.format_exc()
            }
        )


@router.get(
    "/packs/{pack_name}/{icon_key}/svg",
    summary="Get icon SVG data",
    description="Get SVG content as JSON response with metadata"
)
async def get_icon_svg(
    pack_name: str,
    icon_key: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get SVG content as JSON response with metadata."""
    try:
        svg_data = await icon_service.get_icon_svg(pack_name, icon_key)
        if not svg_data:
            raise HTTPException(
                status_code=404,
                detail=f"Icon '{icon_key}' not found in pack '{pack_name}'"
            )

        return {
            "pack": pack_name,
            "key": icon_key,
            "svg": svg_data,
            "content_type": "image/svg+xml",
            "urls": {
                "raw": f"/icons/packs/{pack_name}/{icon_key}/raw",
                "metadata": f"/icons/packs/{pack_name}/{icon_key}",
                "pack": f"/icons/packs/{pack_name}"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon SVG: {str(e)}"
        )


# ============================================================================
# SEARCH ENDPOINTS - /icons/search
# ============================================================================

@router.get(
    "/search",
    response_model=IconSearchResponse,
    summary="Search icons",
    description="Search for icons across all packs or within specific packs/categories"
)
async def search_icons(
    q: Optional[str] = None,
    pack: str = "all",
    category: str = "all",
    page: int = 0,
    size: int = 24,
    icon_service: IconService = Depends(get_icon_service)
):
    """Search for icons with filtering and pagination."""
    try:
        search_request = IconSearchRequest(
            q=q or "",
            pack=pack,
            category=category,
            page=page,
            size=size
        )
        result = await icon_service.search_icons(search_request)

        # Add reference URLs to each icon in search results
        for icon in result.icons:
            if icon.pack:
                pack_name = icon.pack.name
                icon.urls = {
                    "self": f"/icons/packs/{pack_name}/{icon.key}",
                    "raw": f"/icons/packs/{pack_name}/{icon.key}/raw",
                    "svg": f"/icons/packs/{pack_name}/{icon.key}/svg",
                    "pack": f"/icons/packs/{pack_name}"
                }

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


# ============================================================================
# OVERVIEW AND STATISTICS
# ============================================================================

@router.get(
    "/overview",
    summary="Get system overview",
    description="Get summary statistics and available categories/packs"
)
async def get_icons_overview(
    icon_service: IconService = Depends(get_icon_service)
):
    """Get an overview of the icon system."""
    try:
        packs = await icon_service.get_icon_packs()
        total_icons = sum(pack.icon_count for pack in packs)
        categories = sorted(list(set(pack.category for pack in packs if pack.category)))

        return {
            "total_packs": len(packs),
            "total_icons": total_icons,
            "categories": categories,
            "pack_names": [pack.name for pack in packs],
            "recent_packs": packs[:5] if packs else [],
            "urls": {
                "packs": "/icons/packs",
                "search": "/icons/search",
                "categories": [f"/icons/search?category={cat}" for cat in categories]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get overview: {str(e)}"
        )


# ============================================================================
# LEGACY COMPATIBILITY (Deprecated)
# ============================================================================

@router.get(
    "/{icon_id}",
    response_model=IconMetadataResponse,
    summary="[DEPRECATED] Get icon by ID",
    description="Legacy endpoint - use /packs/{pack}/icons/{key} instead",
    deprecated=True
)
async def get_icon_by_id_legacy(
    icon_id: int,
    icon_service: IconService = Depends(get_icon_service)
):
    """[DEPRECATED] Get icon by ID - use pack/key endpoints instead."""
    try:
        icon = await icon_service.get_icon_by_id(icon_id)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )

        # Add deprecation warning and reference URLs
        if icon.pack:
            pack_name = icon.pack.name
            icon.urls = {
                "recommended": f"/icons/packs/{pack_name}/{icon.key}",
                "raw": f"/icons/packs/{pack_name}/{icon.key}/raw",
                "svg": f"/icons/packs/{pack_name}/{icon.key}/svg",
                "pack": f"/icons/packs/{pack_name}"
            }

        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon: {str(e)}"
        )


# Metadata endpoints for pack attributes
@router.get("/metadata/packs/{metadata_parameter}")
async def get_pack_metadata(
    metadata_parameter: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Get unique values for a specific pack attribute (dynamic metadata endpoint).

    Supported metadata parameters:
    - categories: Get all unique pack categories
    - names: Get all pack names
    - display_names: Get all pack display names
    """
    try:
        # Define allowed metadata parameters for security
        allowed_parameters = {
            "categories": "category",
            "names": "name",
            "display_names": "display_name"
        }

        if metadata_parameter not in allowed_parameters:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid metadata parameter. Allowed: {list(allowed_parameters.keys())}"
            )

        # Get the actual field name from the mapping
        field_name = allowed_parameters[metadata_parameter]

        # Get unique values for the field
        unique_values = await icon_service.get_pack_metadata(field_name)

        return {
            "success": True,
            "metadata_type": metadata_parameter,
            "data": unique_values,
            "count": len(unique_values)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack metadata: {str(e)}"
        )

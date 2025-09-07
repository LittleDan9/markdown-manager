"""
Icon Search Router - Handles icon search and filtering operations
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import (
    IconSearchResponse,
    IconSearchRequest,
    IconMetadataResponse,
    IconMetadataUpdate
)
from .docs import ICON_SEARCH_DOCS, ICON_METADATA_DOCS, ICON_SVG_DOCS

router = APIRouter(prefix="/search", tags=["Icon Search"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "/",
    response_model=IconSearchResponse,
    **ICON_SEARCH_DOCS
)
async def search_icons(
    q: Optional[str] = Query(None, description="Search query for icon names, descriptions, and tags"),
    pack: str = Query("all", description="Filter by specific icon pack"),
    category: str = Query("all", description="Filter by icon category"),
    page: int = Query(0, ge=0, description="Page number (0-based)"),
    size: int = Query(24, ge=1, le=100, description="Number of items per page"),
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Search for icons across all packs with powerful filtering and pagination.
    """
    try:
        search_request = IconSearchRequest(
            q=q or "",
            pack=pack,
            category=category,
            page=page,
            size=size
        )
        result = await icon_service.search_icons(search_request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@router.get(
    "/{pack_name}/{icon_key}",
    response_model=IconMetadataResponse,
    **ICON_METADATA_DOCS
)
async def get_icon_metadata(
    pack_name: str,
    icon_key: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get detailed metadata for a specific icon by pack name and key."""
    try:
        icon = await icon_service.get_icon_metadata(pack_name, icon_key)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon '{icon_key}' not found in pack '{pack_name}'"
            )
        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon metadata: {str(e)}"
        )


@router.get(
    "/{pack_name}/{icon_key}/svg",
    **ICON_SVG_DOCS
)
async def get_icon_svg(
    pack_name: str,
    icon_key: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get SVG content for a specific icon, ready for direct rendering."""
    try:
        svg_data = await icon_service.get_icon_svg(pack_name, icon_key)
        if not svg_data:
            raise HTTPException(
                status_code=404,
                detail=f"SVG for icon '{icon_key}' not found in pack '{pack_name}'"
            )
        return {"svg": svg_data, "content_type": "image/svg+xml"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon SVG: {str(e)}"
        )


@router.patch(
    "/{icon_id}",
    response_model=IconMetadataResponse,
    summary="Update icon metadata",
    description="Update metadata for a specific icon"
)
async def update_icon_metadata(
    icon_id: int,
    metadata: IconMetadataUpdate,
    icon_service: IconService = Depends(get_icon_service)
):
    """Update metadata for a specific icon."""
    try:
        # Convert to dict and exclude None values
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        icon = await icon_service.update_icon_metadata(icon_id, metadata_dict)
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
            detail=f"Failed to update icon metadata: {str(e)}"
        )


@router.delete(
    "/{icon_id}",
    summary="Delete icon",
    description="Delete a specific icon"
)
async def delete_icon(
    icon_id: int,
    icon_service: IconService = Depends(get_icon_service)
):
    """Delete a specific icon."""
    try:
        success = await icon_service.delete_icon(icon_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )
        return {"success": True, "message": f"Icon {icon_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete icon: {str(e)}"
        )

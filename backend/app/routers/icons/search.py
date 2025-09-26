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
from .docs import ICON_SEARCH_DOCS

router = APIRouter(prefix="/search", tags=["Icon Search"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "",
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

        # Add reference URLs to each icon in search results using proper RESTful structure
        for icon in result.icons:
            if hasattr(icon, 'pack') and icon.pack:
                pack_name = getattr(icon.pack, 'name', str(icon.pack))
                icon_key = getattr(icon, 'key', getattr(icon, 'icon_key', 'unknown'))
                setattr(icon, 'urls', {
                    "self": f"/icons/packs/{pack_name}/contents/{icon_key}",
                    "raw": f"/icons/packs/{pack_name}/contents/{icon_key}/raw",
                    "svg": f"/icons/packs/{pack_name}/contents/{icon_key}/svg",
                    "pack": f"/icons/packs/{pack_name}"
                })

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


# Admin operations moved to /admin/icons/ endpoints
# Update and delete operations should use admin endpoints with proper authentication

@router.patch(
    "/{icon_id}",
    response_model=IconMetadataResponse,
    summary="[MOVED] Update icon metadata",
    description="This endpoint has been moved to /admin/icons/{icon_id} for proper authentication",
    deprecated=True
)
async def update_icon_metadata_deprecated(
    icon_id: int,
    metadata: IconMetadataUpdate,
    icon_service: IconService = Depends(get_icon_service)
):
    """[DEPRECATED] Use /admin/icons/{icon_id} instead."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "This endpoint has been moved",
            "new_endpoint": f"/admin/icons/{icon_id}",
            "message": "Use the admin API for icon updates"
        }
    )


@router.delete(
    "/{icon_id}",
    summary="[MOVED] Delete icon",
    description="This endpoint has been moved to /admin/icons/{icon_id} for proper authentication",
    deprecated=True
)
async def delete_icon_deprecated(
    icon_id: int,
    icon_service: IconService = Depends(get_icon_service)
):
    """[DEPRECATED] Use /admin/icons/{icon_id} instead."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "This endpoint has been moved",
            "new_endpoint": f"/admin/icons/{icon_id}",
            "message": "Use the admin API for icon deletion"
        }
    )

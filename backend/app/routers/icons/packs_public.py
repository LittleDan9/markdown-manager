"""
Icon Packs Public Router - Public endpoints only (admin endpoints moved to admin router)
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import IconPackResponse

router = APIRouter(prefix="/packs", tags=["Icon Packs"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "",
    response_model=List[IconPackResponse],
    summary="List all icon packs",
    description="Get a list of all available icon packs with metadata and icon counts."
)
async def get_icon_packs(
    icon_service: IconService = Depends(get_icon_service)
):
    """Get all available icon packs."""
    try:
        packs = await icon_service.get_icon_packs()
        return packs
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon packs: {str(e)}"
        )


@router.get(
    "/{pack_name}",
    response_model=IconPackResponse,
    summary="Get specific icon pack",
    description="Get metadata for a specific icon pack by name"
)
async def get_icon_pack_details(
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
            "contents": f"/icons/packs/{pack.name}/contents",
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
    "/{pack_name}/contents",
    summary="List contents of pack",
    description="Get all icons from a specific pack with pagination"
)
async def list_pack_contents(
    pack_name: str,
    page: int = 0,
    size: int = 50,
    icon_service: IconService = Depends(get_icon_service)
):
    """List all icons in a specific pack with pagination."""
    try:
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
            detail=f"Failed to list pack icons: {str(e)}"
        )

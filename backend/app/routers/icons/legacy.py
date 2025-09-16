"""
Legacy Compatibility Router - Deprecated endpoints for backward compatibility
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import IconMetadataResponse

router = APIRouter(tags=["Legacy Compatibility"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


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

        # Add migration suggestion in response
        if hasattr(icon, 'pack') and icon.pack and hasattr(icon, 'key'):
            pack_name = getattr(icon.pack, 'name', 'unknown')
            icon_key = getattr(icon, 'key', 'unknown')
            setattr(icon, 'urls', {
                "recommended": f"/icons/packs/{pack_name}/icons/{icon_key}",
                "raw": f"/icons/packs/{pack_name}/icons/{icon_key}/raw",
                "svg": f"/icons/packs/{pack_name}/icons/{icon_key}/svg",
                "pack": f"/icons/packs/{pack_name}"
            })

        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon by ID: {str(e)}"
        )

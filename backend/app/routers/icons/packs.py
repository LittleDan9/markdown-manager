"""
Icon Pack Management Router - Handles pack CRUD operations
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import IconPackResponse, IconPackInstallRequest, IconPackDeleteResponse
from .docs import ICON_PACKS_DOCS

router = APIRouter(prefix="/packs", tags=["Icon Packs"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "/",
    response_model=List[IconPackResponse],
    **ICON_PACKS_DOCS["get"]
)
async def get_icon_packs(icon_service: IconService = Depends(get_icon_service)):
    """Get all available icon packs."""
    packs = await icon_service.get_icon_packs()
    return packs


@router.post(
    "/",
    response_model=IconPackResponse,
    **ICON_PACKS_DOCS["post"]
)
async def install_icon_pack(
    pack_request: IconPackInstallRequest,
    icon_service: IconService = Depends(get_icon_service)
):
    """Install a new icon pack with flexible data mapping."""
    try:
        return await icon_service.install_icon_pack(
            pack_data=pack_request.pack_data,
            mapping_config=pack_request.mapping_config,
            package_type=pack_request.package_type
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to install icon pack: {str(e)}"
        )


@router.put(
    "/{pack_name}",
    response_model=IconPackResponse,
    **ICON_PACKS_DOCS["put"]
)
async def update_icon_pack(
    pack_name: str,
    pack_request: IconPackInstallRequest,
    icon_service: IconService = Depends(get_icon_service)
):
    """Update an existing icon pack with new data or configuration."""
    try:
        return await icon_service.update_icon_pack(
            pack_name=pack_name,
            pack_data=pack_request.pack_data,
            mapping_config=pack_request.mapping_config,
            package_type=pack_request.package_type
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack: {str(e)}"
        )


@router.delete(
    "/{pack_name}",
    response_model=IconPackDeleteResponse,
    **ICON_PACKS_DOCS["delete"]
)
async def delete_icon_pack(
    pack_name: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """Permanently delete an icon pack and all its associated icons."""
    try:
        success = await icon_service.delete_icon_pack(pack_name)
        if success:
            return IconPackDeleteResponse(
                success=True,
                message=f"Pack '{pack_name}' deleted successfully"
            )
        else:
            return IconPackDeleteResponse(
                success=False,
                message=f"Pack '{pack_name}' not found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete icon pack: {str(e)}"
        )

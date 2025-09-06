"""
Icon Pack Management Router - Handles pack CRUD operations (Standardized Iconify format only)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ...database import get_db
from ...services.standardized_icon_installer import StandardizedIconPackInstaller
from ...schemas.icon_schemas import IconPackResponse, IconPackInstallRequest, IconPackDeleteResponse
from ...services.icon_service import IconService
from ...core.auth import get_admin_user
from ...models.user import User
from .docs import ICON_PACKS_DOCS

router = APIRouter(prefix="/packs", tags=["Icon Packs"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


async def get_standardized_installer(db: AsyncSession = Depends(get_db)) -> StandardizedIconPackInstaller:
    """Dependency to get StandardizedIconPackInstaller instance."""
    return StandardizedIconPackInstaller(db)


@router.get(
    "/",
    response_model=List[IconPackResponse],
    **ICON_PACKS_DOCS["get"]
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
    "/categories",
    summary="Get all unique categories from icon packs",
    description="Retrieve a sorted list of all unique categories used by icon packs."
)
async def get_icon_categories(
    icon_service: IconService = Depends(get_icon_service)
):
    """Get all unique categories from existing icon packs."""
    try:
        packs = await icon_service.get_icon_packs()
        categories = sorted(list(set(pack.category for pack in packs if pack.category)))
        
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon categories: {str(e)}"
        )


@router.get(
    "/names",
    summary="Get all unique pack names from icon packs",
    description="Retrieve a sorted list of all unique pack names."
)
async def get_icon_pack_names(
    icon_service: IconService = Depends(get_icon_service)
):
    """Get all unique pack names from existing icon packs."""
    try:
        packs = await icon_service.get_icon_packs()
        pack_names = sorted(list(set(pack.name for pack in packs if pack.name)))
        
        return {"pack_names": pack_names}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack names: {str(e)}"
        )


@router.post(
    "/",
    response_model=IconPackResponse,
    **ICON_PACKS_DOCS["post"]
)
async def install_icon_pack(
    pack_request: IconPackInstallRequest,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Install a new icon pack in standardized Iconify format."""
    try:
        return await installer.install_pack(pack_request.pack_data)
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
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Update an existing icon pack with new data in standardized Iconify format."""
    try:
        return await installer.update_pack(pack_name, pack_request.pack_data)
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
    current_user: User = Depends(get_admin_user),
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

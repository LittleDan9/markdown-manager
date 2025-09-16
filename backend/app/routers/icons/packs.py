"""
Icon Pack Management Router - Handles pack CRUD operations (Standardized Iconify format only)
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import logging
import traceback

from ...database import get_db
from ...services.standardized_icon_installer import StandardizedIconPackInstaller
from ...schemas.icon_schemas import (
    IconPackResponse,
    IconPackInstallRequest,
    IconPackDeleteResponse,
    IconPackMetadataUpdate,
    IconMetadataResponse
)
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
    "",
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


@router.post(
    "",
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


@router.patch(
    "/{pack_name}",
    response_model=IconPackResponse,
    summary="Update icon pack metadata",
    description="Update metadata (name, display_name, category, description) without affecting icons"
)
async def update_icon_pack_metadata(
    pack_name: str,
    metadata: IconPackMetadataUpdate,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Update only the metadata of an existing icon pack without touching icons."""
    try:
        # Convert to dict and exclude None values
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        return await installer.update_pack_metadata(pack_name, metadata_dict)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack metadata: {str(e)}"
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


# ============================================================================
# PACK DETAIL AND ICON ACCESS ROUTES
# ============================================================================

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
            "icons": f"/icons/packs/{pack.name}/icons",
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
    "/{pack_name}/icons",
    summary="List icons in pack",
    description="Get all icons from a specific pack with pagination"
)
async def list_pack_icons(
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


@router.get(
    "/{pack_name}/icons/{icon_key}",
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
            "self": f"/icons/packs/{pack_name}/icons/{icon_key}",
            "raw": f"/icons/packs/{pack_name}/icons/{icon_key}/raw",
            "svg": f"/icons/packs/{pack_name}/icons/{icon_key}/svg",
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
    "/{pack_name}/icons/{icon_key}/raw",
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
    "/{pack_name}/icons/{icon_key}/svg",
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
                "raw": f"/icons/packs/{pack_name}/icons/{icon_key}/raw",
                "metadata": f"/icons/packs/{pack_name}/icons/{icon_key}",
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

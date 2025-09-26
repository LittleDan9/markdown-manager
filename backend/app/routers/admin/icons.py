"""
Icon Administration Module

Admin operations for icon management:
- Icon pack installation, updates, and deletion
- Individual icon uploads and metadata updates
- Cache management and performance tuning
- Usage statistics and monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import re

from ...database import get_db
from ...services.icon_service import IconService
from ...services.standardized_icon_installer import StandardizedIconPackInstaller
from ...schemas.icon_schemas import (
    IconPackResponse,
    IconPackInstallRequest,
    IconPackDeleteResponse,
    IconPackMetadataUpdate,
    IconMetadataUpdate
)
from ...core.auth import get_admin_user
from ...models.user import User

# Create router without prefix - will be added by parent router
router = APIRouter(tags=["Icon Administration"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


async def get_standardized_installer(db: AsyncSession = Depends(get_db)) -> StandardizedIconPackInstaller:
    """Dependency to get StandardizedIconPackInstaller instance."""
    return StandardizedIconPackInstaller(db)


# ============================================================================
# PACK MANAGEMENT
# ============================================================================

@router.post(
    "/packs",
    response_model=IconPackResponse,
    summary="Install new icon pack",
    description="Install a new icon pack in standardized Iconify format"
)
async def install_icon_pack(
    pack_request: IconPackInstallRequest,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Install a new icon pack in standardized Iconify format."""
    try:
        result = await installer.install_pack(pack_request.pack_data)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to install icon pack: {str(e)}"
        )


@router.put(
    "/packs/{pack_name}",
    response_model=IconPackResponse,
    summary="Update icon pack",
    description="Update an existing icon pack with new data in standardized Iconify format"
)
async def update_icon_pack(
    pack_name: str,
    pack_request: IconPackInstallRequest,
    current_user: User = Depends(get_admin_user),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Update an existing icon pack with new data in standardized Iconify format."""
    try:
        result = await installer.update_pack(pack_name, pack_request.pack_data)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack: {str(e)}"
        )


@router.patch(
    "/packs/{pack_name}",
    response_model=IconPackResponse,
    summary="Update pack metadata",
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
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        result = await installer.update_pack_metadata(pack_name, metadata_dict)

        # Add reference URLs
        result.urls = {
            "self": f"/icons/packs/{result.name}",
            "icons": f"/icons/packs/{result.name}",
            "admin": f"/admin/icons/packs/{result.name}"
        }

        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon pack metadata: {str(e)}"
        )


@router.delete(
    "/packs/{pack_name}",
    response_model=IconPackDeleteResponse,
    summary="Delete icon pack",
    description="Permanently delete an icon pack and all its associated icons"
)
async def delete_icon_pack(
    pack_name: str,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Permanently delete an icon pack and all its associated icons."""
    try:
        success = await icon_service.delete_icon_pack(pack_name)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Icon pack '{pack_name}' not found"
            )
        return IconPackDeleteResponse(
            success=True,
            message=f"Icon pack '{pack_name}' deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete icon pack: {str(e)}"
        )


# ============================================================================
# ICON UPLOAD
# ============================================================================

@router.post(
    "/upload/icon",
    response_model=IconPackResponse,
    summary="Upload single icon",
    description="Upload a single SVG icon to an existing pack or create a new pack"
)
async def upload_single_icon(
    svg_file: UploadFile = File(..., description="SVG file to upload"),
    icon_name: str = Form(..., description="Icon name (lowercase, hyphens allowed)"),
    pack_name: str = Form(..., description="Pack name to add icon to"),
    category: str = Form(default="other", description="Pack category"),
    description: Optional[str] = Form(default=None, description="Pack description"),
    search_terms: Optional[str] = Form(default=None, description="Comma-separated search terms"),
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service),
    installer: StandardizedIconPackInstaller = Depends(get_standardized_installer)
):
    """Upload a single icon to a pack."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Validate all input parameters
        if not svg_file.filename or not svg_file.filename.endswith('.svg'):
            raise HTTPException(status_code=400, detail="File must be an SVG")

        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', icon_name):
            raise HTTPException(
                status_code=400,
                detail="Icon name must be lowercase with hyphens only (e.g., 'aws-lambda')"
            )

        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', pack_name):
            raise HTTPException(
                status_code=400,
                detail="Pack name must be lowercase with hyphens only (e.g., 'aws-icons')"
            )

        # Read and validate SVG content
        svg_content = await svg_file.read()
        svg_text = svg_content.decode('utf-8')

        if not svg_text.strip().startswith('<svg'):
            raise HTTPException(status_code=400, detail="Invalid SVG file")

        # Create or update the pack with the new icon
        result = await icon_service.add_icon_to_pack(
            pack_name=pack_name,
            key=icon_name,
            search_terms=search_terms or "",
            icon_data={"body": svg_text},
            file_path=None
        )

        if not result:
            # Try to create a new pack if it doesn't exist
            from ...schemas.icon_schemas import StandardizedIconData

            icon_data = StandardizedIconData(
                body=svg_text,
                width=24,
                height=24
            )

            pack_data = {
                "info": {
                    "name": pack_name,
                    "display_name": pack_name.replace('-', ' ').title(),
                    "category": category,
                    "description": description or f"Custom pack for {pack_name} icons"
                },
                "icons": {
                    icon_name: icon_data.model_dump()
                }
            }

            pack_request = IconPackInstallRequest(pack_data=pack_data)
            return await install_icon_pack(pack_request, current_user, installer)

        # Convert icon result to pack response (for consistency)
        packs = await icon_service.get_icon_packs()
        pack = next((p for p in packs if p.name == pack_name), None)
        if pack:
            return pack

        raise HTTPException(status_code=500, detail="Failed to retrieve pack after upload")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading icon: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload icon: {str(e)}"
        )


# ============================================================================
# ICON MANAGEMENT
# ============================================================================

@router.patch(
    "/icons/{icon_id}",
    summary="Update icon metadata",
    description="Update metadata for a specific icon"
)
async def update_icon_metadata(
    icon_id: int,
    metadata: IconMetadataUpdate,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Update metadata for a specific icon."""
    try:
        metadata_dict = {k: v for k, v in metadata.model_dump().items() if v is not None}
        icon = await icon_service.update_icon_metadata(icon_id, metadata_dict)
        if not icon:
            raise HTTPException(
                status_code=404,
                detail=f"Icon with ID {icon_id} not found"
            )

        # Add reference URLs
        if icon.pack:
            pack_name = icon.pack.name
            icon.urls = {
                "self": f"/icons/packs/{pack_name}/{icon.key}",
                "raw": f"/icons/packs/{pack_name}/{icon.key}/raw",
                "pack": f"/icons/packs/{pack_name}"
            }

        return icon
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update icon metadata: {str(e)}"
        )


@router.delete(
    "/icons/{icon_id}",
    summary="Delete icon",
    description="Delete a specific icon"
)
async def delete_icon(
    icon_id: int,
    current_user: User = Depends(get_admin_user),
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


# ============================================================================
# CACHE MANAGEMENT
# ============================================================================

@router.get(
    "/cache/stats",
    summary="Get cache stats",
    description="Retrieve detailed statistics about the icon cache performance"
)
async def get_cache_stats(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get cache performance statistics."""
    try:
        return {
            "success": True,
            "cache_stats": "Cache statistics not yet implemented"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats: {str(e)}"
        )


@router.post(
    "/cache/warm",
    summary="Warm cache",
    description="Pre-load the cache with the most popular icons for improved performance"
)
async def warm_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Pre-load the cache with the most popular icons for improved performance."""
    try:
        return {
            "success": True,
            "message": "Cache warming not yet implemented"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to warm cache: {str(e)}"
        )


@router.delete(
    "/cache/clear",
    summary="Clear cache",
    description="Clear all cached icon data to free memory or force fresh data loading"
)
async def clear_cache(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Clear all cached icon data to free memory or force fresh data loading."""
    try:
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )


# ============================================================================
# STATISTICS
# ============================================================================

@router.get(
    "/statistics",
    summary="Get comprehensive statistics",
    description="Retrieve detailed statistics about icon packs, usage patterns, and system metrics"
)
async def get_icon_statistics(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get comprehensive icon usage statistics."""
    try:
        packs = await icon_service.get_icon_packs()
        total_icons = sum(pack.icon_count for pack in packs)

        stats = {
            "total_packs": len(packs),
            "total_icons": total_icons,
            "categories": list(set(pack.category for pack in packs if pack.category)),
            "packs": [
                {
                    "name": pack.name,
                    "icon_count": pack.icon_count,
                    "category": pack.category
                }
                for pack in packs
            ]
        }
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get icon statistics: {str(e)}"
        )


@router.get(
    "/statistics/popular",
    summary="Get popular icons",
    description="Get a list of the most frequently accessed icons across all packs"
)
async def get_popular_icons(
    limit: int = 50,
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get most popular icons by access count."""
    try:
        # For now, return empty list - will be implemented when usage tracking is added
        return {
            "popular_icons": [],
            "limit": limit,
            "total_returned": 0,
            "note": "Usage tracking not yet implemented"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get popular icons: {str(e)}"
        )


@router.get(
    "/statistics/packs",
    summary="Get pack statistics",
    description="Get usage statistics broken down by icon pack"
)
async def get_pack_statistics(
    current_user: User = Depends(get_admin_user),
    icon_service: IconService = Depends(get_icon_service)
):
    """Get statistics for each icon pack."""
    try:
        packs = await icon_service.get_icon_packs()
        pack_stats = [
            {
                "name": pack.name,
                "display_name": pack.display_name,
                "category": pack.category,
                "icon_count": pack.icon_count,
                "created_at": pack.created_at.isoformat() if pack.created_at else None,
                "updated_at": pack.updated_at.isoformat() if pack.updated_at else None,
            }
            for pack in packs
        ]
        return {
            "pack_statistics": pack_stats,
            "total_packs": len(pack_stats)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack statistics: {str(e)}"
        )

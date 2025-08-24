"""Icon API routes for icon service operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.icon_schemas import (
    IconBatchRequest,
    IconBatchResponse,
    IconMetadataResponse,
    IconPackDeleteResponse,
    IconPackInstallRequest,
    IconPackListResponse,
    IconPackResponse,
    IconPackStatisticsResponse,
    IconPackUpdateRequest,
    IconSearchRequest,
    IconSearchResponse,
    IconSVGResponse,
    IconUsageTrackingRequest,
    MappingConfigExample,
)
from app.services.icon_service import IconService

router = APIRouter(prefix="/icons", tags=["icons"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get icon service."""
    return IconService(db)


@router.get("/packs", response_model=IconPackListResponse)
async def get_icon_packs(
    icon_service: IconService = Depends(get_icon_service)
) -> IconPackListResponse:
    """Get all icon packs."""
    packs = await icon_service.get_icon_packs()
    return IconPackListResponse(packs=packs, total=len(packs))


@router.post("/packs", response_model=IconPackResponse)
async def install_icon_pack(
    request: IconPackInstallRequest,
    icon_service: IconService = Depends(get_icon_service)
) -> IconPackResponse:
    """Install a new icon pack with flexible data mapping."""
    try:
        return await icon_service.install_icon_pack(
            request.pack_data,
            request.mapping_config,
            request.package_type
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to install icon pack: {str(e)}"
        )


@router.put("/packs/{pack_name}", response_model=IconPackResponse)
async def update_icon_pack(
    pack_name: str,
    request: IconPackUpdateRequest,
    icon_service: IconService = Depends(get_icon_service)
) -> IconPackResponse:
    """Update an existing icon pack."""
    try:
        return await icon_service.update_icon_pack(
            pack_name,
            request.pack_data,
            request.mapping_config,
            request.package_type
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update icon pack: {str(e)}"
        )


@router.delete("/packs/{pack_name}", response_model=IconPackDeleteResponse)
async def delete_icon_pack(
    pack_name: str,
    icon_service: IconService = Depends(get_icon_service)
) -> IconPackDeleteResponse:
    """Delete an icon pack and all its icons."""
    try:
        success = await icon_service.delete_icon_pack(pack_name)
        if success:
            return IconPackDeleteResponse(
                success=True,
                message=f"Icon pack '{pack_name}' deleted successfully"
            )
        else:
            return IconPackDeleteResponse(
                success=False,
                message=f"Icon pack '{pack_name}' not found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete icon pack: {str(e)}"
        )


@router.get("/search", response_model=IconSearchResponse)
async def search_icons(
    q: str = "",
    pack: str = "all",
    category: str = "all",
    page: int = 0,
    size: int = 24,
    icon_service: IconService = Depends(get_icon_service)
) -> IconSearchResponse:
    """Search icons with pagination and filtering."""
    search_request = IconSearchRequest(
        q=q, pack=pack, category=category, page=page, size=size
    )
    return await icon_service.search_icons(search_request)


@router.get("/{pack_name}/{key}", response_model=IconMetadataResponse)
async def get_icon_metadata(
    pack_name: str,
    key: str,
    icon_service: IconService = Depends(get_icon_service)
) -> IconMetadataResponse:
    """Get specific icon metadata."""
    icon = await icon_service.get_icon_metadata(pack_name, key)
    if not icon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Icon '{pack_name}:{key}' not found"
        )
    return icon


@router.get("/{pack_name}/{key}/svg", response_model=IconSVGResponse)
async def get_icon_svg(
    pack_name: str,
    key: str,
    icon_service: IconService = Depends(get_icon_service)
) -> IconSVGResponse:
    """Get SVG content for an icon."""
    svg_content = await icon_service.get_icon_svg(pack_name, key)
    if not svg_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SVG content for icon '{pack_name}:{key}' not found"
        )

    return IconSVGResponse(
        content=svg_content,
        content_type="image/svg+xml",
        cache_control="public, max-age=3600"
    )


@router.post("/batch", response_model=IconBatchResponse)
async def batch_get_icons(
    request: IconBatchRequest,
    icon_service: IconService = Depends(get_icon_service)
) -> IconBatchResponse:
    """Batch get icons by full keys."""
    found_icons, not_found = await icon_service.batch_get_icons(request.icon_keys)
    return IconBatchResponse(icons=found_icons, not_found=not_found)


@router.post("/track-usage")
async def track_icon_usage(
    request: IconUsageTrackingRequest,
    icon_service: IconService = Depends(get_icon_service)
) -> dict:
    """Track icon usage."""
    await icon_service.track_usage(request.pack, request.key, request.user_id)
    return {"message": "Usage tracked successfully"}


@router.get("/statistics", response_model=IconPackStatisticsResponse)
async def get_icon_statistics(
    icon_service: IconService = Depends(get_icon_service)
) -> IconPackStatisticsResponse:
    """Get statistics about icon packs and usage."""
    stats = await icon_service.get_pack_statistics()
    return IconPackStatisticsResponse(**stats)


@router.get("/cache-stats")
async def get_cache_statistics(
    icon_service: IconService = Depends(get_icon_service)
) -> dict:
    """Get cache performance statistics."""
    return icon_service.get_cache_statistics()


@router.post("/cache-warm")
async def warm_cache(
    icon_service: IconService = Depends(get_icon_service)
) -> dict:
    """Warm cache with popular icons."""
    return await icon_service.warm_cache()


@router.post("/cache-clear")
async def clear_cache(
    icon_service: IconService = Depends(get_icon_service)
) -> dict:
    """Clear all cache entries."""
    icon_service.clear_cache()
    return {"message": "Cache cleared successfully"}


@router.get("/mapping-examples", response_model=MappingConfigExample)
async def get_mapping_examples() -> MappingConfigExample:
    """Get example mapping configurations for different package types."""
    return MappingConfigExample()

"""
Icon Search Router - Handles icon search and filtering operations
"""
import logging

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List, Optional

from ...database import get_db
from ...models.icon_models import IconMetadata, IconPack
from ...services.icon_service import IconService
from ...services.icons.embedding import IconEmbeddingService
from ...services.search.embedding_client import EmbeddingClient
from ...schemas.icon_schemas import (
    IconSearchResponse,
    IconSearchRequest,
    IconMetadataResponse,
    IconMetadataUpdate,
    IconPackReference,
)
from .docs import ICON_SEARCH_DOCS

logger = logging.getLogger(__name__)

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
    packs: Optional[str] = Query(None, description="Comma-separated list of pack names to filter by"),
    category: str = Query("all", description="Filter by icon category"),
    page: int = Query(0, ge=0, description="Page number (0-based)"),
    size: int = Query(24, ge=1, le=100, description="Number of items per page"),
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Search for icons across all packs with powerful filtering and pagination.
    """
    try:
        packs_list = [p.strip() for p in packs.split(",") if p.strip()] if packs else None

        search_request = IconSearchRequest(
            q=q or "",
            pack=pack,
            packs=packs_list,
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


@router.get(
    "/frequently-used",
    response_model=List[IconMetadataResponse],
    summary="Get frequently used icons",
    description="Returns the top icons by access count, ordered by most used first"
)
async def get_frequently_used_icons(
    limit: int = Query(20, ge=1, le=50, description="Number of icons to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get the most frequently accessed icons."""
    query = (
        select(IconMetadata)
        .options(selectinload(IconMetadata.pack))
        .join(IconPack)
        .where(IconMetadata.access_count > 0)
        .order_by(desc(IconMetadata.access_count))
        .limit(limit)
    )

    result = await db.execute(query)
    icons = result.scalars().all()

    responses = []
    for icon in icons:
        metadata = IconMetadataResponse.model_validate(icon)
        if icon.pack:
            metadata.pack = IconPackReference.model_validate(icon.pack)
        metadata.urls = None
        responses.append(metadata)

    return responses


@router.post(
    "/track-usage",
    summary="Track icon usage",
    description="Increment access count for an icon (fire-and-forget)"
)
async def track_icon_usage(
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    """Increment access_count for the specified icon."""
    pack_name = body.get("pack")
    key = body.get("key")

    if not pack_name or not key:
        raise HTTPException(status_code=400, detail="pack and key are required")

    stmt = (
        update(IconMetadata)
        .where(
            IconMetadata.pack_id == select(IconPack.id).where(IconPack.name == pack_name).scalar_subquery(),
            IconMetadata.key == key,
        )
        .values(access_count=IconMetadata.access_count + 1)
    )
    await db.execute(stmt)
    await db.commit()

    return {"status": "ok"}


@router.get(
    "/semantic",
    response_model=List[IconMetadataResponse],
    summary="Semantic icon search",
    description="Search icons using natural language via embedding similarity"
)
async def semantic_search_icons(
    q: str = Query(..., description="Natural language search query"),
    packs: Optional[str] = Query(None, description="Comma-separated pack names to filter"),
    limit: int = Query(20, ge=1, le=50, description="Number of results"),
    db: AsyncSession = Depends(get_db)
):
    """Semantic search for icons using embedding similarity."""
    try:
        client = EmbeddingClient()
        service = IconEmbeddingService(client)

        packs_list = [p.strip() for p in packs.split(",") if p.strip()] if packs else None
        results = await service.search(db, query=q, limit=limit, packs=packs_list)

        responses = []
        for r in results:
            metadata = IconMetadataResponse.model_validate(r.icon)
            if r.icon.pack:
                metadata.pack = IconPackReference.model_validate(r.icon.pack)
            metadata.urls = None
            responses.append(metadata)

        return responses
    except Exception as e:
        logger.warning("Semantic search failed, falling back to ILIKE: %s", e)
        # Fallback to keyword search
        search_request = IconSearchRequest(q=q, size=limit)
        icon_service = IconService(db)
        result = await icon_service.search_icons(search_request)
        return result.icons


@router.post(
    "/reindex-embeddings",
    summary="Reindex all icon embeddings",
    description="Regenerate embeddings for all icons (admin operation)"
)
async def reindex_icon_embeddings(
    db: AsyncSession = Depends(get_db)
):
    """Reindex all icon embeddings."""
    try:
        client = EmbeddingClient()
        service = IconEmbeddingService(client)
        stats = await service.bulk_reindex(db)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(e)}")


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

"""
Icon Statistics Router - Handles analytics and usage statistics
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService
from ...core.auth import get_current_user
from ...models.user import User

router = APIRouter(prefix="/statistics", tags=["Icon Statistics"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "/health",
    summary="Icon service health check",
    description="Perform a health check on the icon service and its dependencies."
)
async def health_check(icon_service: IconService = Depends(get_icon_service)):
    """Perform a health check on the icon service."""
    try:
        return await icon_service.health_check()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )


@router.get(
    "",
    summary="Get comprehensive icon usage statistics",
    description="""
    Retrieve detailed statistics about icon packs, usage patterns, and system metrics.

    **Statistics Include:**
    - Pack overview and category breakdown
    - Popular icons with access counts
    - Document usage analysis (if user authenticated)
    - Mermaid diagram integration statistics
    """
)
async def get_icon_statistics(
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive icon usage statistics with document analysis."""
    try:
        # Include user-specific document analysis for authenticated users
        return await icon_service.get_pack_statistics(user_id=current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.get(
    "/public",
    summary="Get public icon statistics",
    description="Get icon statistics without user-specific document analysis."
)
async def get_public_icon_statistics(icon_service: IconService = Depends(get_icon_service)):
    """Get public icon statistics without document analysis."""
    try:
        return await icon_service.get_pack_statistics(user_id=None)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get public statistics: {str(e)}"
        )


@router.get(
    "/packs/{pack_name}/usage",
    summary="Get pack document usage details",
    description="Get detailed document usage statistics for a specific icon pack."
)
async def get_pack_document_usage(
    pack_name: str,
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Get detailed document usage for a specific pack."""
    try:
        return await icon_service.get_pack_document_usage(pack_name, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack usage: {str(e)}"
        )


@router.get(
    "/documents/{document_id}/analysis",
    summary="Analyze icon usage in a specific document",
    description="Get detailed analysis of icon usage within a specific document."
)
async def get_document_icon_analysis(
    document_id: int,
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Analyze icon usage in a specific document."""
    try:
        return await icon_service.get_document_icon_analysis(document_id, current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze document: {str(e)}"
        )


@router.get(
    "/trends",
    summary="Get usage trends over time",
    description="Get icon usage trends and patterns over a specified time period."
)
async def get_usage_trends(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze"),
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Get icon usage trends over time."""
    try:
        return await icon_service.get_usage_trends(current_user.id, days)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get usage trends: {str(e)}"
        )


@router.get(
    "/popular",
    summary="Get most popular icons",
    description="Get a list of the most frequently accessed icons across all packs."
)
async def get_popular_icons(
    limit: int = Query(default=50, ge=1, le=200, description="Number of popular icons to return"),
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Get most popular icons by access count and document usage."""
    try:
        # Get comprehensive statistics which includes popular icons
        stats = await icon_service.get_pack_statistics(user_id=current_user.id)

        popular_icons = stats.get('top_icons', [])
        doc_popular = stats.get('document_usage', {}).get('most_used_in_documents', [])

        return {
            "api_popular_icons": popular_icons[:limit],
            "document_popular_icons": doc_popular[:limit],
            "total_api_accesses": sum(icon.get('access_count', 0) for icon in popular_icons),
            "document_usage_summary": stats.get('document_usage', {})
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get popular icons: {str(e)}"
        )


@router.get(
    "/packs",
    summary="Get pack-level statistics",
    description="Get usage statistics broken down by icon pack."
)
async def get_pack_statistics(
    icon_service: IconService = Depends(get_icon_service),
    current_user: User = Depends(get_current_user)
):
    """Get statistics for each icon pack."""
    try:
        stats = await icon_service.get_pack_statistics(user_id=current_user.id)

        # Transform the data for pack-specific view
        pack_stats = []
        by_category = stats.get('by_category', {})
        document_usage = stats.get('document_usage', {}).get('packs_used', {})

        for category, category_data in by_category.items():
            for pack_name, pack_usage in document_usage.items():
                if pack_usage.get('category') == category:
                    pack_stats.append({
                        "pack_name": pack_name,
                        "display_name": pack_usage.get('display_name', pack_name),
                        "category": category,
                        "total_icons": category_data.get('icons', 0),
                        "documents_using_pack": pack_usage.get('documents_count', 0),
                        "total_document_references": pack_usage.get('total_references', 0),
                        "unique_icons_used": pack_usage.get('unique_icons_used', 0)
                    })

        return {
            "pack_stats": pack_stats,
            "summary": stats.get('summary', {}),
            "document_analysis": stats.get('document_usage', {})
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack statistics: {str(e)}"
        )

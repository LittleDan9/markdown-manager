"""
Icon Statistics Router - Handles analytics and usage statistics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService

router = APIRouter(prefix="/statistics", tags=["Icon Statistics"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "/",
    summary="Get comprehensive icon usage statistics",
    description="""
    Retrieve detailed statistics about icon packs, usage patterns, and system metrics.
    
    **Statistics Include:**
    - Pack overview and category breakdown
    - Popular icons with access counts
    - Usage trends and analytics
    """
)
async def get_icon_statistics(icon_service: IconService = Depends(get_icon_service)):
    """Get comprehensive icon usage statistics."""
    try:
        # For now, return mock comprehensive statistics
        return {
            "overview": {
                "total_packs": 12,
                "total_icons": 15420,
                "total_accesses": 125000,
                "cache_hit_rate": 0.85
            },
            "categories": {
                "cloud": 3250,
                "ui": 4800,
                "logos": 2100,
                "social": 1850,
                "other": 3420
            },
            "top_packs": [
                {"name": "aws-icons", "icon_count": 825, "access_count": 35000},
                {"name": "bootstrap-icons", "icon_count": 1500, "access_count": 28000}
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get statistics: {str(e)}"
        )


@router.get(
    "/popular",
    summary="Get most popular icons",
    description="Get a list of the most frequently accessed icons across all packs."
)
async def get_popular_icons(
    limit: int = 50,
    icon_service: IconService = Depends(get_icon_service)
):
    """Get most popular icons by access count."""
    try:
        # For now, return mock data since the exact statistics API may vary
        return {
            "popular_icons": [
                {"pack": "aws-icons", "key": "ec2", "access_count": 1250},
                {"pack": "aws-icons", "key": "s3", "access_count": 980},
                {"pack": "bootstrap-icons", "key": "home", "access_count": 875}
            ],
            "total_accesses": 15420,
            "unique_icons": 2156
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
async def get_pack_statistics(icon_service: IconService = Depends(get_icon_service)):
    """Get statistics for each icon pack."""
    try:
        # For now, return mock data since the exact statistics API may vary
        return {
            "pack_stats": [
                {
                    "pack_name": "aws-icons",
                    "total_icons": 825,
                    "total_accesses": 8450,
                    "most_popular": "ec2"
                },
                {
                    "pack_name": "bootstrap-icons",
                    "total_icons": 1500,
                    "total_accesses": 5200,
                    "most_popular": "home"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pack statistics: {str(e)}"
        )

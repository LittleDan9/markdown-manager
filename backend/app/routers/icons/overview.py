"""
Icon Overview Router - System overview and statistics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService

router = APIRouter(prefix="/overview", tags=["Icon Overview"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.get(
    "",
    summary="Get system overview",
    description="Get summary statistics and available categories/packs"
)
async def get_icons_overview(
    icon_service: IconService = Depends(get_icon_service)
):
    """Get an overview of the icon system."""
    try:
        packs = await icon_service.get_icon_packs()
        total_icons = sum(pack.icon_count for pack in packs)
        categories = sorted(list(set(pack.category for pack in packs if pack.category)))

        return {
            "total_packs": len(packs),
            "total_icons": total_icons,
            "categories": categories,
            "pack_names": [pack.name for pack in packs],
            "recent_packs": packs[:5] if packs else [],
            "urls": {
                "packs": "/icons/packs",
                "search": "/icons/search",
                "metadata": "/icons/metadata/packs",
                "categories": [f"/icons/search?category={cat}" for cat in categories]
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get overview: {str(e)}"
        )

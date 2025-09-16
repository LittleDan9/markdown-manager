"""
Iconify Browser Router
Provides API endpoints for browsing and installing Iconify icon collections
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.icons.third_party.iconify import IconifyCollectionBrowser as IconifyBrowserService
from app.services.standardized_icon_installer import StandardizedIconPackInstaller
from app.schemas.icon_schemas import StandardizedIconPackRequest

router = APIRouter(prefix="/iconify", tags=["iconify"])


@router.get("/collections")
async def get_iconify_collections(
    query: Optional[str] = Query(None, description="Search query for collections"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, description="Number of collections to return", ge=1, le=200),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """Get available Iconify collections with search and filtering"""

    try:
        browser_service = IconifyBrowserService()

        if query or category:
            result = await browser_service.search_collections(
                query=query or "",
                category=category or "",
                limit=limit,
                offset=offset
            )
        else:
            collections = await browser_service.get_collections()
            # Apply pagination to all collections
            items = list(collections.items())
            total = len(items)
            paginated_items = items[offset:offset + limit]

            result = {
                "collections": dict(paginated_items),
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total
            }

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch collections: {str(e)}")


@router.get("/collections/{prefix}/icons")
async def get_collection_icons(
    prefix: str,
    page: int = Query(0, description="Page number", ge=0),
    page_size: int = Query(50, description="Number of icons per page", ge=1, le=200),
    search: Optional[str] = Query(None, description="Search for specific icons")
):
    """Get icons from a specific Iconify collection"""

    try:
        browser_service = IconifyBrowserService()
        result = await browser_service.get_collection_icons(
            prefix=prefix,
            page=page,
            page_size=page_size,
            search=search or ""
        )

        return {
            "success": True,
            "data": result
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch icons: {str(e)}")


@router.post("/collections/{prefix}/install")
async def install_iconify_collection(
    prefix: str,
    request_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Install selected icons from an Iconify collection"""

    try:
        # Extract parameters from request
        icon_names = request_data.get("icon_names", [])
        pack_name = request_data.get("pack_name", prefix)
        category = request_data.get("category", "iconify")
        description = request_data.get("description", "")

        if not icon_names:
            raise HTTPException(status_code=400, detail="No icons selected for installation")

        # Get icon data from Iconify
        browser_service = IconifyBrowserService()
        pack_data = await browser_service.get_icon_data_for_install(prefix, icon_names)

        # Override pack metadata if provided
        if pack_name != prefix:
            pack_data["info"]["name"] = pack_name
            pack_data["info"]["displayName"] = pack_name.replace("-", " ").title()

        if category != "iconify":
            pack_data["info"]["category"] = category

        if description:
            pack_data["info"]["description"] = description

        # Convert to StandardizedIconPackRequest
        pack_request = StandardizedIconPackRequest(**pack_data)

        # Install the pack
        installer = StandardizedIconPackInstaller(db)
        result = await installer.install_pack(pack_request)

        return {
            "success": True,
            "data": result,
            "message": f"Successfully installed {len(icon_names)} icons from {prefix}"
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install collection: {str(e)}")


@router.get("/categories")
async def get_iconify_categories():
    """Get unique categories from all Iconify collections"""

    try:
        browser_service = IconifyBrowserService()
        categories = await browser_service.get_collection_categories()

        return {
            "success": True,
            "data": {
                "categories": categories
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


@router.post("/collections/refresh")
async def refresh_collections_cache():
    """Refresh the collections cache (admin function)"""

    try:
        browser_service = IconifyBrowserService()
        collections = await browser_service.get_collections(refresh=True)

        return {
            "success": True,
            "data": {
                "total_collections": len(collections),
                "message": "Collections cache refreshed successfully"
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")

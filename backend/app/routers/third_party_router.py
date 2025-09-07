"""
Third-Party Browser Router
Provides unified API endpoints for browsing and installing icons from multiple sources
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services.third_party_browser_service import ThirdPartyBrowserService, ThirdPartySource
from app.services.standardized_icon_installer import StandardizedIconPackInstaller
from app.schemas.icon_schemas import StandardizedIconPackRequest

router = APIRouter(prefix="/third-party", tags=["third-party"])


@router.get("/sources")
async def get_available_sources():
    """Get information about all available third-party sources"""
    try:
        browser_service = ThirdPartyBrowserService()
        sources = await browser_service.get_available_sources()
        
        return {
            "success": True,
            "data": {
                "sources": sources
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch sources: {str(e)}")


@router.get("/sources/{source}/collections")
async def get_collections(
    source: ThirdPartySource = Path(..., description="Source to browse (iconify, svgl)"),
    query: Optional[str] = Query(None, description="Search query for collections"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, description="Number of collections to return", ge=1, le=200),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """Get available collections from the specified third-party source"""
    try:
        browser_service = ThirdPartyBrowserService()
        result = await browser_service.search_collections(
            source=source,
            query=query or "",
            category=category or "",
            limit=limit,
            offset=offset
        )

        return {
            "success": True,
            "data": result
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch collections: {str(e)}")


@router.get("/sources/{source}/collections/{prefix}/icons")
async def get_collection_icons(
    source: ThirdPartySource = Path(..., description="Source to browse (iconify, svgl)"),
    prefix: str = Path(..., description="Collection prefix or category name"),
    page: int = Query(0, description="Page number", ge=0),
    page_size: int = Query(50, description="Number of icons per page", ge=1, le=200),
    search: Optional[str] = Query(None, description="Search for specific icons")
):
    """Get icons from a specific collection"""
    try:
        browser_service = ThirdPartyBrowserService()
        result = await browser_service.get_collection_icons(
            source=source,
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


@router.post("/sources/{source}/collections/{prefix}/install")
async def install_collection(
    request_data: dict,
    source: ThirdPartySource = Path(..., description="Source to install from (iconify, svgl)"),
    prefix: str = Path(..., description="Collection prefix or category name"),
    db: AsyncSession = Depends(get_db)
):
    """Install selected icons from a third-party collection"""
    try:
        # Extract parameters from request
        icon_names = request_data.get("icon_names", [])
        install_all = request_data.get("install_all", False)
        pack_name = request_data.get("pack_name", f"{source}-{prefix}")
        category = request_data.get("category", str(source))
        description = request_data.get("description", "")

        if not install_all and not icon_names:
            raise HTTPException(status_code=400, detail="No icons selected for installation")

        # Get icon data from the specified source
        browser_service = ThirdPartyBrowserService()
        
        if install_all:
            # For install_all, we need to get all icons in the collection first
            all_icons_result = await browser_service.get_collection_icons(
                source=source,
                prefix=prefix,
                page=0,
                page_size=1000,  # Get a large batch
                search=""
            )
            
            # Extract icon names from the result
            icon_names = [icon["name"] for icon in all_icons_result.get("icons", [])]
            
            if not icon_names:
                raise HTTPException(status_code=404, detail="No icons found in collection")

        pack_data = await browser_service.get_icon_data_for_install(
            source=source,
            prefix=prefix,
            icon_names=icon_names
        )

        # Override pack metadata if provided
        if pack_name != f"{source}-{prefix}":
            pack_data["info"]["name"] = pack_name
            pack_data["info"]["displayName"] = pack_name.replace("-", " ").title()

        if category != str(source):
            pack_data["info"]["category"] = category

        if description:
            pack_data["info"]["description"] = description

        # Convert to StandardizedIconPackRequest
        pack_request = StandardizedIconPackRequest(**pack_data)

        # Install the pack
        installer = StandardizedIconPackInstaller(db)
        result = await installer.install_pack(pack_request)

        action_text = "entire collection" if install_all else f"{len(icon_names)} icons"
        return {
            "success": True,
            "data": result,
            "message": f"Successfully installed {action_text} from {source}:{prefix}"
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install collection: {str(e)}")


@router.get("/sources/{source}/categories")
async def get_categories(
    source: ThirdPartySource = Path(..., description="Source to get categories from (iconify, svgl)")
):
    """Get unique categories from the specified source"""
    try:
        browser_service = ThirdPartyBrowserService()
        categories = await browser_service.get_collection_categories(source)

        return {
            "success": True,
            "data": {
                "categories": categories,
                "source": source
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


@router.post("/refresh-cache")
async def refresh_cache(
    source: Optional[ThirdPartySource] = Query(
        None,
        description="Source to refresh (optional, refreshes all if not specified)"
    )
):
    """Refresh the cache for specified source or all sources"""
    try:
        browser_service = ThirdPartyBrowserService()
        await browser_service.refresh_cache(source)

        message = f"Cache refreshed for {source}" if source else "Cache refreshed for all sources"
        return {
            "success": True,
            "data": {
                "message": message
            }
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh cache: {str(e)}")


# Legacy Iconify endpoints for backward compatibility
@router.get("/iconify/collections")
async def get_iconify_collections_legacy(
    query: Optional[str] = Query(None, description="Search query for collections"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, description="Number of collections to return", ge=1, le=200),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """Legacy Iconify collections endpoint for backward compatibility"""
    return await get_collections(
        source=ThirdPartySource.ICONIFY,
        query=query,
        category=category,
        limit=limit,
        offset=offset
    )


@router.get("/iconify/collections/{prefix}/icons")
async def get_iconify_collection_icons_legacy(
    prefix: str,
    page: int = Query(0, description="Page number", ge=0),
    page_size: int = Query(50, description="Number of icons per page", ge=1, le=200),
    search: Optional[str] = Query(None, description="Search for specific icons")
):
    """Legacy Iconify collection icons endpoint for backward compatibility"""
    return await get_collection_icons(
        source=ThirdPartySource.ICONIFY,
        prefix=prefix,
        page=page,
        page_size=page_size,
        search=search
    )


@router.post("/iconify/collections/{prefix}/install")
async def install_iconify_collection_legacy(
    request_data: dict,
    prefix: str,
    db: AsyncSession = Depends(get_db)
):
    """Legacy Iconify install endpoint for backward compatibility"""
    return await install_collection(
        source=ThirdPartySource.ICONIFY,
        prefix=prefix,
        request_data=request_data,
        db=db
    )


@router.get("/iconify/categories")
async def get_iconify_categories_legacy():
    """Legacy Iconify categories endpoint for backward compatibility"""
    return await get_categories(source=ThirdPartySource.ICONIFY)

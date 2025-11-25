"""
Icon Batch Router - Handles bulk icon operations for efficient loading
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ...database import get_db
from ...services.icon_service import IconService
from ...schemas.icon_schemas import (
    IconBatchRequest,
    IconBatchResponse
)

router = APIRouter(prefix="/batch", tags=["Icon Batch Operations"])


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


@router.post(
    "",
    response_model=IconBatchResponse,
    summary="Batch get icons",
    description="Efficiently retrieve multiple icons by their full keys (pack:key format). "
                "Uses optimized bulk database queries and caching for better performance than individual requests.",
    responses={
        200: {
            "description": "Successfully retrieved icons",
            "content": {
                "application/json": {
                    "example": {
                        "icons": [
                            {
                                "id": 1,
                                "pack_id": 1,
                                "key": "EC2",
                                "full_key": "awssvg:EC2",
                                "search_terms": "ec2 compute instance virtual machine",
                                "icon_data": {
                                    "body": "<path d='...'/>",
                                    "viewBox": "0 0 24 24",
                                    "width": 24,
                                    "height": 24
                                },
                                "access_count": 42,
                                "created_at": "2025-09-20T10:00:00Z",
                                "pack": {
                                    "id": 1,
                                    "name": "awssvg",
                                    "display_name": "AWS Services",
                                    "category": "cloud"
                                }
                            }
                        ],
                        "not_found": ["awssvg:NonExistentIcon"]
                    }
                }
            }
        },
        400: {"description": "Invalid request format"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)
async def batch_get_icons(
    request: IconBatchRequest,
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Batch retrieve icons by their full keys for efficient bulk loading.

    This endpoint is optimized for scenarios like:
    - Mermaid diagram rendering with multiple icons
    - Icon browser pagination
    - Bulk icon validation

    Features:
    - Single optimized database query instead of N individual queries
    - Automatic caching of results
    - Graceful handling of missing icons
    - Fallback to individual queries if bulk query fails
    """
    try:
        if not request.icon_keys:
            return IconBatchResponse(icons=[], not_found=[])

        # Validate icon keys format
        invalid_keys = []
        valid_keys = []

        for key in request.icon_keys:
            if ':' not in key or len(key.split(':', 1)) != 2:
                invalid_keys.append(key)
            else:
                pack_name, icon_key = key.split(':', 1)
                if not pack_name.strip() or not icon_key.strip():
                    invalid_keys.append(key)
                else:
                    valid_keys.append(key)

        # Get icons using optimized batch service
        found_icons, not_found_keys = await icon_service.batch_get_icons(valid_keys)

        # Add invalid keys to not found
        not_found_keys.extend(invalid_keys)

        # Add reference URLs for better API navigation
        for icon in found_icons:
            if hasattr(icon, 'pack') and icon.pack and hasattr(icon, 'key'):
                pack_name = getattr(icon.pack, 'name', 'unknown')
                icon_key = getattr(icon, 'key', 'unknown')
                setattr(icon, 'urls', {
                    "self": f"/icons/packs/{pack_name}/contents/{icon_key}",
                    "raw": f"/icons/packs/{pack_name}/contents/{icon_key}/raw",
                    "svg": f"/icons/packs/{pack_name}/contents/{icon_key}/svg",
                    "pack": f"/icons/packs/{pack_name}"
                })

        return IconBatchResponse(
            icons=found_icons,
            not_found=not_found_keys
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch icon retrieval failed: {str(e)}"
        )


@router.get(
    "/validate",
    summary="Validate icon keys",
    description="Validate a list of icon keys without retrieving full metadata. "
                "Useful for checking if icons exist before attempting to load them.",
    responses={
        200: {
            "description": "Validation results",
            "content": {
                "application/json": {
                    "example": {
                        "valid": ["aws-icons:Alert", "devicon:amazonwebservices"],
                        "invalid": ["aws-icons:NonExistent", "invalid-format"],
                        "summary": {
                            "total": 4,
                            "valid_count": 2,
                            "invalid_count": 2
                        }
                    }
                }
            }
        }
    }
)
async def validate_icon_keys(
    icon_keys: List[str] = Query(..., description="List of icon keys to validate"),
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Validate icon keys without retrieving full metadata.

    This is a lightweight endpoint for checking if icons exist,
    useful for validation before bulk operations.
    """
    try:
        valid_keys = []
        invalid_keys = []

        # Basic format validation
        format_valid = []
        format_invalid = []

        for key in icon_keys:
            if ':' in key and len(key.split(':', 1)) == 2:
                pack_name, icon_key = key.split(':', 1)
                if pack_name.strip() and icon_key.strip():
                    format_valid.append(key)
                else:
                    format_invalid.append(key)
            else:
                format_invalid.append(key)

        # Check existence for format-valid keys
        if format_valid:
            found_icons, not_found_keys = await icon_service.batch_get_icons(format_valid)
            found_keys = {icon.full_key for icon in found_icons}

            valid_keys = [key for key in format_valid if key in found_keys]
            invalid_keys.extend(not_found_keys)

        # Add format-invalid keys
        invalid_keys.extend(format_invalid)

        return {
            "valid": valid_keys,
            "invalid": invalid_keys,
            "summary": {
                "total": len(icon_keys),
                "valid_count": len(valid_keys),
                "invalid_count": len(invalid_keys)
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Icon validation failed: {str(e)}"
        )

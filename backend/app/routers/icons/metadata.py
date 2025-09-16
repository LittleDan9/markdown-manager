"""Dynamic metadata endpoints for icon packs."""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...services.icon_service import IconService

router = APIRouter(prefix="/metadata")


async def get_icon_service(db: AsyncSession = Depends(get_db)) -> IconService:
    """Dependency to get IconService instance."""
    return IconService(db)


# Whitelist of allowed metadata fields to prevent exposure of sensitive data
ALLOWED_METADATA_FIELDS = {
    "categories": "category",
    "names": "name",
    "display_names": "display_name",
    "descriptions": "description",
}


@router.get("/packs/{metadata_parameter}")
async def get_pack_metadata(
    metadata_parameter: str,
    icon_service: IconService = Depends(get_icon_service)
):
    """
    Get unique values for a specific metadata field from all icon packs.

    Args:
        metadata_parameter: The metadata field to retrieve (e.g., 'categories', 'names')
        icon_service: Icon service dependency

    Returns:
        Dict with unique values for the specified field

    Examples:
        GET /metadata/packs/categories -> {"values": ["aws", "iconify", "logos"], "count": 3}
        GET /metadata/packs/names -> {"values": ["aws-services", "feather", "heroicons"], "count": 3}
    """
    # Validate metadata parameter
    if metadata_parameter not in ALLOWED_METADATA_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metadata parameter. Allowed values: {list(ALLOWED_METADATA_FIELDS.keys())}"
        )

    try:
        # Get all icon packs using the existing service method
        packs = await icon_service.get_icon_packs()

        # Get the field name to extract
        field_name = ALLOWED_METADATA_FIELDS[metadata_parameter]

        # Extract unique values, filtering out None/empty values
        values = set()
        for pack in packs:
            # Handle both dict and object responses
            if hasattr(pack, field_name):
                value = getattr(pack, field_name, None)
            elif isinstance(pack, dict):
                value = pack.get(field_name, None)
            else:
                continue

            if value and str(value).strip():
                values.add(str(value).strip())

        # Sort the values
        sorted_values = sorted(list(values))

        return {
            "values": sorted_values,
            "count": len(sorted_values),
            "metadata_type": metadata_parameter
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve {metadata_parameter}: {str(e)}"
        )


@router.get("/packs")
async def get_available_metadata_fields():
    """
    Get list of available metadata fields that can be queried.

    Returns:
        Dict with available metadata field names and examples
    """
    return {
        "fields": list(ALLOWED_METADATA_FIELDS.keys()),
        "count": len(ALLOWED_METADATA_FIELDS),
        "examples": [
            "/metadata/packs/categories",
            "/metadata/packs/names",
            "/metadata/packs/display_names",
            "/metadata/packs/descriptions"
        ]
    }

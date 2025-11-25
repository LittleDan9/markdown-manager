"""Icon search service."""
from sqlalchemy import desc, func, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconSearchRequest, IconSearchResponse, IconMetadataResponse, IconPackReference
from .base import BaseIconService


class IconSearchService(BaseIconService):
    """Service for icon search operations."""

    async def search_icons(self, search_request: IconSearchRequest) -> IconSearchResponse:
        """Search for icons based on the given criteria."""
        query = select(IconMetadata).options(selectinload(IconMetadata.pack))

        # Add pack filter
        if search_request.pack != "all":
            query = query.join(IconPack).where(IconPack.name == search_request.pack)
        else:
            query = query.join(IconPack)

        # Add category filter
        if search_request.category != "all":
            query = query.where(IconPack.category == search_request.category)

        # Add search term filter
        if search_request.q:
            search_term = f"%{search_request.q.lower()}%"
            query = query.where(IconMetadata.search_terms.ilike(search_term))

        # Count total results before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(desc(IconMetadata.access_count), IconMetadata.key)
        query = query.offset(search_request.page * search_request.size).limit(search_request.size)

        # Execute query
        result = await self.db.execute(query)
        icons = result.scalars().all()

        # Convert to response objects
        icon_responses = []
        for icon in icons:
            metadata = IconMetadataResponse.model_validate(icon)

            # Override pack with IconPackReference if pack exists
            if icon.pack:
                metadata.pack = IconPackReference.model_validate(icon.pack)

            metadata.urls = None  # URLs will be set by router if needed
            icon_responses.append(metadata)

        # Calculate pagination metadata
        pages = (total + search_request.size - 1) // search_request.size
        has_next = search_request.page < pages - 1
        has_prev = search_request.page > 0

        return IconSearchResponse(
            icons=icon_responses,
            total=total,
            page=search_request.page,
            size=search_request.size,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )

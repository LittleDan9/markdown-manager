"""Icon service for managing icon packs and metadata."""
import os
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import (
    IconSearchRequest,
    IconSearchResponse,
    IconMetadataResponse,
    IconPackResponse,
)
from app.services.icon_cache import get_icon_cache


class IconService:
    """Service for managing icon operations."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the icon service with database session."""
        self.db = db_session
        self.cache = get_icon_cache()

    async def search_icons(
        self,
        search_request: IconSearchRequest
    ) -> IconSearchResponse:
        """Search icons with pagination and filtering."""
        # Base query with pack relationship and icons for count computation
        query = select(IconMetadata).options(
            selectinload(IconMetadata.pack).selectinload(IconPack.icons)
        )
        
        # Apply filters
        if search_request.q:
            query = query.where(IconMetadata.search_terms.ilike(f"%{search_request.q}%"))
        
        if search_request.pack != "all":
            query = query.join(IconPack).where(IconPack.name == search_request.pack)
        
        if search_request.category != "all":
            query = query.join(IconPack).where(IconPack.category == search_request.category)
        
        # Order by popularity (access_count) and then by key
        query = query.order_by(desc(IconMetadata.access_count), IconMetadata.key)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0
        
        # Apply pagination and execute
        offset = search_request.page * search_request.size
        query = query.offset(offset).limit(search_request.size)
        result = await self.db.execute(query)
        icons = result.scalars().all()
        
        # Calculate pagination info
        pages = (total + search_request.size - 1) // search_request.size  # Ceiling division
        has_next = search_request.page < pages - 1
        has_prev = search_request.page > 0
        
        return IconSearchResponse(
            icons=[IconMetadataResponse.model_validate(icon) for icon in icons],
            total=total,
            page=search_request.page,
            size=search_request.size,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )

    async def get_icon_metadata(self, pack_name: str, key: str) -> Optional[IconMetadataResponse]:
        """Get icon metadata by pack and key."""
        full_key = f"{pack_name}:{key}"

        # Try cache first
        cached_metadata = self.cache.get_icon_metadata(full_key)
        if cached_metadata:
            return cached_metadata

        # If not in cache, fetch from database
        query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .join(IconPack)
            .where(and_(IconPack.name == pack_name, IconMetadata.key == key))
        )

        result = await self.db.execute(query)
        icon = result.scalar_one_or_none()

        if icon:
            metadata = IconMetadataResponse.model_validate(icon)
            # Cache the result
            self.cache.put_icon_metadata(full_key, metadata)
            return metadata
        return None

    async def get_icon_by_id(self, icon_id: int) -> Optional[IconMetadataResponse]:
        """Get icon metadata by ID."""
        query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .where(IconMetadata.id == icon_id)
        )

        result = await self.db.execute(query)
        icon = result.scalar_one_or_none()

        if icon:
            # Access the pack within the async context to avoid greenlet issues
            pack_data = None
            if icon.pack:
                # Get icon count for the pack in a separate query to avoid relationship access issues
                icon_count_query = select(func.count(IconMetadata.id)).where(IconMetadata.pack_id == icon.pack.id)
                icon_count_result = await self.db.execute(icon_count_query)
                icon_count = icon_count_result.scalar() or 0
                
                # Manually construct pack data to avoid Pydantic model validation issues
                pack_data = IconPackResponse(
                    id=icon.pack.id,
                    name=icon.pack.name,
                    display_name=icon.pack.display_name,
                    category=icon.pack.category,
                    description=icon.pack.description,
                    icon_count=icon_count,
                    created_at=icon.pack.created_at,
                    updated_at=icon.pack.updated_at
                )
            
            # Manually construct the response to avoid Pydantic relationship access issues
            return IconMetadataResponse(
                id=icon.id,
                key=icon.key,
                search_terms=icon.search_terms,
                icon_data=icon.icon_data,
                file_path=icon.file_path,
                pack_id=icon.pack_id,
                full_key=icon.full_key,
                access_count=icon.access_count,
                created_at=icon.created_at,
                updated_at=icon.updated_at,
                pack=pack_data
            )
        return None

    async def get_icon_svg(self, pack_name: str, key: str) -> Optional[str]:
        """Get SVG content for an icon."""
        full_key = f"{pack_name}:{key}"

        # Try cache first
        cached_svg = self.cache.get_icon_svg(full_key)
        if cached_svg:
            # Still track usage for cached content
            await self.track_usage(pack_name, key)
            return cached_svg

        # If not in cache, get metadata and generate SVG
        icon = await self.get_icon_metadata(pack_name, key)
        if not icon:
            return None

        # Track usage
        await self.track_usage(pack_name, key)

        svg_content = None

        # Return SVG content from icon_data or file_path
        if icon.icon_data:
            # Check for full SVG content
            if "svg" in icon.icon_data:
                svg_content = icon.icon_data["svg"]
            # Check for Iconify-style body content
            elif "body" in icon.icon_data:
                body = icon.icon_data["body"]
                width = icon.icon_data.get("width", 24)
                height = icon.icon_data.get("height", 24)
                viewBox = icon.icon_data.get("viewBox", f"0 0 {width} {height}")
                svg_content = (
                    f'<svg xmlns="http://www.w3.org/2000/svg" '
                    f'width="{width}" height="{height}" viewBox="{viewBox}">'
                    f'{body}</svg>'
                )
        elif icon.file_path and os.path.exists(icon.file_path):
            with open(icon.file_path, "r", encoding="utf-8") as f:
                svg_content = f.read()

        # Cache the SVG content if we found it
        if svg_content:
            self.cache.put_icon_svg(full_key, svg_content)

        return svg_content

    async def get_icon_packs(self) -> List[IconPackResponse]:
        """Get all icon packs with automatic icon count computation."""
        query = (
            select(IconPack)
            .options(selectinload(IconPack.icons))
            .order_by(IconPack.category, IconPack.display_name)
        )
        result = await self.db.execute(query)
        packs = result.scalars().all()

        return [IconPackResponse.model_validate(pack) for pack in packs]

    async def track_usage(self, pack_name: str, key: str, user_id: Optional[int] = None) -> None:
        """Track icon usage by incrementing access count."""
        query = (
            select(IconMetadata)
            .join(IconPack)
            .where(and_(IconPack.name == pack_name, IconMetadata.key == key))
        )

        result = await self.db.execute(query)
        icon = result.scalar_one_or_none()

        if icon:
            icon.access_count += 1
            await self.db.commit()

    async def batch_get_icons(self, icon_keys: List[str]) -> Tuple[List[IconMetadataResponse], List[str]]:
        """Batch get icons by full keys (pack:key format)."""
        found_icons = []
        not_found = []

        for full_key in icon_keys:
            if ":" not in full_key:
                not_found.append(full_key)
                continue

            pack_name, key = full_key.split(":", 1)
            icon = await self.get_icon_metadata(pack_name, key)

            if icon:
                found_icons.append(icon)
            else:
                not_found.append(full_key)

        return found_icons, not_found

    async def install_icon_pack(
        self,
        pack_data: Dict[str, Any],
        mapping_config: Dict[str, str],
        package_type: str = "json"
    ) -> IconPackResponse:
        """Install a new icon pack with flexible data mapping."""
        from .icon_pack_installer import IconPackInstaller

        installer = IconPackInstaller(self.db)
        result = await installer.install_pack(pack_data, mapping_config, package_type)

        # No need to invalidate cache for new pack
        return result

    async def update_icon_pack(
        self,
        pack_name: str,
        pack_data: Dict[str, Any],
        mapping_config: Dict[str, str],
        package_type: str = "json"
    ) -> IconPackResponse:
        """Update an existing icon pack."""
        from .icon_pack_installer import IconPackInstaller

        installer = IconPackInstaller(self.db)
        result = await installer.update_pack(pack_name, pack_data, mapping_config, package_type)

        # Invalidate cache for updated pack
        self.cache.invalidate_pack(pack_name)

        return result

    async def delete_icon_pack(self, pack_name: str) -> bool:
        """Delete an icon pack and all its icons."""
        query = select(IconPack).where(IconPack.name == pack_name)
        result = await self.db.execute(query)
        pack = result.scalar_one_or_none()

        if pack:
            await self.db.delete(pack)
            await self.db.commit()

            # Invalidate cache for deleted pack
            self.cache.invalidate_pack(pack_name)

            return True

        return False

    async def add_icon_to_pack(
        self,
        pack_id: int,
        icon_name: str,
        icon_data: Dict[str, Any]
    ) -> IconMetadataResponse:
        """Add a single icon to an existing pack.
        
        Args:
            pack_id: ID of the existing pack
            icon_name: Name/key of the icon
            icon_data: Icon data with body, width, height, viewBox
            
        Returns:
            IconMetadataResponse: The created icon metadata
            
        Raises:
            ValueError: If pack doesn't exist or icon already exists
        """
        # Check if pack exists
        pack_query = select(IconPack).where(IconPack.id == pack_id)
        pack_result = await self.db.execute(pack_query)
        pack = pack_result.scalar_one_or_none()
        
        if not pack:
            raise ValueError(f"Pack with ID {pack_id} not found")
        
        # Check if icon already exists in this pack
        existing_query = select(IconMetadata).where(
            and_(IconMetadata.pack_id == pack_id, IconMetadata.key == icon_name)
        )
        existing_result = await self.db.execute(existing_query)
        existing_icon = existing_result.scalar_one_or_none()
        
        if existing_icon:
            raise ValueError(f"Icon '{icon_name}' already exists in pack '{pack.name}'")
        
        # Create new icon metadata
        full_key = f"{pack.name}:{icon_name}"
        search_terms = f"{pack.name} {icon_name} {icon_name.replace('-', ' ')}"
        
        icon_metadata = IconMetadata(
            pack_id=pack_id,
            key=icon_name,
            full_key=full_key,
            search_terms=search_terms,
            icon_data=icon_data
        )
        
        self.db.add(icon_metadata)
        await self.db.commit()
        await self.db.refresh(icon_metadata)
        
        # Update pack's updated_at timestamp
        pack.updated_at = func.now()
        await self.db.commit()
        
        # Invalidate cache for the pack
        self.cache.invalidate_pack(pack.name)
        
        # Return the created icon metadata as response (without pack relationship to avoid greenlet issues)
        return IconMetadataResponse(
            id=icon_metadata.id,
            key=icon_metadata.key,
            search_terms=icon_metadata.search_terms,
            icon_data=icon_metadata.icon_data,
            file_path=icon_metadata.file_path,
            pack_id=icon_metadata.pack_id,
            full_key=icon_metadata.full_key,
            access_count=icon_metadata.access_count,
            created_at=icon_metadata.created_at,
            updated_at=icon_metadata.updated_at,
            pack=None  # Exclude pack relationship to avoid async issues
        )

    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self.cache.get_cache_stats()

    def clear_cache(self) -> None:
        """Clear all cache entries."""
        self.cache.clear_all()

    async def warm_cache(self) -> Dict[str, Any]:
        """Warm cache with popular icons."""
        # Get most popular icons
        popular_icons_query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .order_by(desc(IconMetadata.access_count))
            .limit(100)  # Top 100 popular icons
        )

        result = await self.db.execute(popular_icons_query)
        popular_icons = result.scalars().all()

        # Prepare data for cache warming
        warm_data = []
        for icon in popular_icons:
            metadata = IconMetadataResponse.model_validate(icon)

            # Try to get SVG content
            svg_content = None
            if icon.icon_data:
                if "svg" in icon.icon_data:
                    svg_content = icon.icon_data["svg"]
                elif "body" in icon.icon_data:
                    body = icon.icon_data["body"]
                    width = icon.icon_data.get("width", 24)
                    height = icon.icon_data.get("height", 24)
                    svg_content = (
                        f'<svg xmlns="http://www.w3.org/2000/svg" '
                        f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
                        f'{body}</svg>'
                    )
            elif icon.file_path and os.path.exists(icon.file_path):
                try:
                    with open(icon.file_path, "r", encoding="utf-8") as f:
                        svg_content = f.read()
                except Exception:
                    pass  # Skip files that can't be read

            warm_data.append((icon.full_key, metadata, svg_content))

        # Warm the cache
        warmed_count = self.cache.warm_cache(warm_data)

        return {
            "warmed_icons": warmed_count,
            "cache_stats": self.get_cache_statistics()
        }

    async def get_pack_statistics(self) -> Dict[str, Any]:
        """Get statistics about icon packs."""
        # Get total counts
        pack_count_query = select(func.count(IconPack.id))
        icon_count_query = select(func.count(IconMetadata.id))

        pack_count_result = await self.db.execute(pack_count_query)
        icon_count_result = await self.db.execute(icon_count_query)

        total_packs = pack_count_result.scalar() or 0
        total_icons = icon_count_result.scalar() or 0

        # Get pack breakdown
        pack_breakdown_query = (
            select(IconPack.category, func.count(IconPack.id).label("pack_count"))
            .group_by(IconPack.category)
            .order_by(IconPack.category)
        )

        pack_breakdown_result = await self.db.execute(pack_breakdown_query)
        pack_breakdown = {row.category: row.pack_count for row in pack_breakdown_result}

        # Get most popular icons
        popular_icons_query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .order_by(desc(IconMetadata.access_count))
            .limit(10)
        )

        popular_icons_result = await self.db.execute(popular_icons_query)
        popular_icons = [
            {
                "full_key": icon.full_key,
                "access_count": icon.access_count,
                "pack": icon.pack.display_name
            }
            for icon in popular_icons_result.scalars().all()
        ]

        return {
            "total_packs": total_packs,
            "total_icons": total_icons,
            "pack_breakdown": pack_breakdown,
            "popular_icons": popular_icons,
        }

    async def health_check(self) -> Dict[str, Any]:
        """Check icon service health."""
        try:
            # Check database connectivity by counting packs
            result = await self.db.execute(select(func.count(IconPack.id)))
            pack_count = result.scalar() or 0
            
            # Check cache connectivity
            cache_healthy = self.cache is not None
            
            return {
                "status": "healthy",
                "details": f"{pack_count} icon packs available",
                "cache_status": "healthy" if cache_healthy else "unavailable"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "details": f"Service check failed: {str(e)}",
                "cache_status": "unknown"
            }

    async def update_icon_metadata(self, icon_id: int, metadata: Dict[str, Any]) -> Optional[IconMetadataResponse]:
        """Update metadata for a specific icon."""
        try:
            # Get the icon
            query = select(IconMetadata).options(selectinload(IconMetadata.pack)).where(IconMetadata.id == icon_id)
            result = await self.db.execute(query)
            icon = result.scalar_one_or_none()
            
            if not icon:
                return None
            
            # Access pack name and old key in async context before updates
            pack_name = icon.pack.name if icon.pack else None
            old_icon_key = icon.key
            
            # Update fields
            key_changed = False
            if 'key' in metadata:
                # Update the key and full_key
                new_key = metadata['key']
                if new_key != old_icon_key:
                    key_changed = True
                    icon.key = new_key
                    if pack_name:
                        icon.full_key = f"{pack_name}:{new_key}"
            
            if 'search_terms' in metadata:
                icon.search_terms = metadata['search_terms']
            
            # Note: Individual icons don't have categories - they inherit from pack
            # If needed, we could add this as a custom field later
            
            await self.db.commit()
            await self.db.refresh(icon)
            
            # Update documents if icon key changed
            if key_changed and pack_name:
                from .document_icon_updater import DocumentIconUpdater
                document_updater = DocumentIconUpdater(self.db)
                await document_updater.update_icon_key_references(pack_name, old_icon_key, icon.key)
            
            # Manually construct the response to avoid Pydantic relationship access issues
            pack_data = None
            if icon.pack:
                # Get icon count for the pack in a separate query to avoid relationship access issues
                icon_count_query = select(func.count(IconMetadata.id)).where(IconMetadata.pack_id == icon.pack.id)
                icon_count_result = await self.db.execute(icon_count_query)
                icon_count = icon_count_result.scalar() or 0
                
                pack_data = IconPackResponse(
                    id=icon.pack.id,
                    name=icon.pack.name,
                    display_name=icon.pack.display_name,
                    category=icon.pack.category,
                    description=icon.pack.description,
                    icon_count=icon_count,
                    created_at=icon.pack.created_at,
                    updated_at=icon.pack.updated_at
                )
            
            return IconMetadataResponse(
                id=icon.id,
                key=icon.key,
                search_terms=icon.search_terms,
                icon_data=icon.icon_data,
                file_path=icon.file_path,
                pack_id=icon.pack_id,
                full_key=icon.full_key,
                access_count=icon.access_count,
                created_at=icon.created_at,
                updated_at=icon.updated_at,
                pack=pack_data
            )
        except Exception as e:
            await self.db.rollback()
            raise e

    async def delete_icon(self, icon_id: int) -> bool:
        """Delete a specific icon."""
        try:
            # Get the icon
            query = select(IconMetadata).where(IconMetadata.id == icon_id)
            result = await self.db.execute(query)
            icon = result.scalar_one_or_none()
            
            if not icon:
                return False
            
            # Delete the icon
            await self.db.delete(icon)
            await self.db.commit()
            
            return True
        except Exception as e:
            await self.db.rollback()
            raise e

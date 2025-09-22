"""Icon metadata and retrieval service."""
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconMetadataResponse, IconPackReference
from .base import BaseIconService

logger = logging.getLogger(__name__)


class IconMetadataService(BaseIconService):
    """Service for icon metadata operations."""

    async def get_icon_metadata(self, pack_name: str, key: str) -> Optional[IconMetadataResponse]:
        """Get metadata for a specific icon by pack name and key."""
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
            # Create pack reference if available - let SQLAlchemy handle the relationship
            pack_response = None
            if icon.pack:
                pack_response = IconPackReference.model_validate(icon.pack)

            # Let SQLAlchemy handle the icon data as well
            metadata = IconMetadataResponse.model_validate(icon)
            metadata.pack = pack_response
            metadata.urls = None  # Will be set by caller if needed

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
            # Let SQLAlchemy handle the relationships automatically
            metadata = IconMetadataResponse.model_validate(icon)

            # Override pack with IconPackReference if pack exists
            if icon.pack:
                metadata.pack = IconPackReference.model_validate(icon.pack)

            metadata.urls = None  # URLs will be added by the router layer
            return metadata
        return None

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

            # Track if key is changing for document updates
            key_changed = False
            if 'key' in metadata and metadata['key'] != icon.key:
                key_changed = True

            # Update the icon metadata
            for field, value in metadata.items():
                if hasattr(icon, field):
                    setattr(icon, field, value)

            # Commit the changes
            await self.db.commit()
            await self.db.refresh(icon)

            # Update documents if icon key changed
            # Note: For metadata updates, we skip document updates to avoid user context issues
            # Document updates should be handled separately when user context is available
            if key_changed and pack_name:
                logger.info(f"Icon key changed from {old_icon_key} to {icon.key} in pack {pack_name}. "
                            f"Document updates should be handled separately with proper user context.")

            # Let SQLAlchemy handle the relationships automatically
            response = IconMetadataResponse.model_validate(icon)

            # Override pack with IconPackReference if pack exists
            if icon.pack:
                response.pack = IconPackReference.model_validate(icon.pack)

            response.urls = None  # URLs will be added by the router layer
            return response

        except Exception as e:
            await self.db.rollback()
            raise e

    async def delete_icon(self, icon_id: int) -> bool:
        """Delete an icon by ID."""
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

    async def batch_get_icons(self, icon_keys: List[str]) -> Tuple[List[IconMetadataResponse], List[str]]:
        """Get multiple icons by their full keys using efficient bulk query."""
        if not icon_keys:
            return [], []

        # Validate keys and separate valid/invalid
        valid_keys, not_found_keys = self._validate_icon_keys(icon_keys)
        if not valid_keys:
            return [], not_found_keys

        # Check cache first
        cached_icons, uncached_keys = self._get_cached_icons(valid_keys)
        if not uncached_keys:
            return cached_icons, not_found_keys

        # Bulk query for uncached icons
        found_icons = await self._bulk_query_icons(uncached_keys)
        found_icons.extend(cached_icons)

        # Determine not found keys
        found_keys = {icon.full_key for icon in found_icons}
        not_found_keys.extend([key for key in valid_keys if key not in found_keys])

        return found_icons, not_found_keys

    def _validate_icon_keys(self, icon_keys: List[str]) -> Tuple[List[str], List[str]]:
        """Validate icon keys and return valid/invalid lists."""
        valid_keys = []
        invalid_keys = []

        for full_key in icon_keys:
            try:
                pack_name, key = full_key.split(':', 1)
                if pack_name and key:
                    valid_keys.append(full_key)
                else:
                    invalid_keys.append(full_key)
            except ValueError:
                invalid_keys.append(full_key)

        return valid_keys, invalid_keys

    def _get_cached_icons(self, valid_keys: List[str]) -> Tuple[List[IconMetadataResponse], List[str]]:
        """Get cached icons and return cached/uncached lists."""
        cached_icons = []
        uncached_keys = []

        for full_key in valid_keys:
            cached_metadata = self.cache.get_icon_metadata(full_key)
            if cached_metadata:
                cached_icons.append(cached_metadata)
            else:
                uncached_keys.append(full_key)

        return cached_icons, uncached_keys

    async def _bulk_query_icons(self, uncached_keys: List[str]) -> List[IconMetadataResponse]:
        """Perform bulk database query for uncached icons."""
        found_icons = []

        try:
            query = (
                select(IconMetadata)
                .options(selectinload(IconMetadata.pack))
                .where(IconMetadata.full_key.in_(uncached_keys))
            )

            result = await self.db.execute(query)
            db_icons = result.scalars().all()

            # Convert to response objects and cache them
            for icon in db_icons:
                metadata = self._create_icon_response(icon)
                self.cache.put_icon_metadata(icon.full_key, metadata)
                found_icons.append(metadata)

        except Exception as e:
            logger.warning(f"Bulk query failed, falling back to individual queries: {e}")
            # Fallback to individual queries
            for full_key in uncached_keys:
                try:
                    pack_name, key = full_key.split(':', 1)
                    icon_metadata = await self.get_icon_metadata(pack_name, key)
                    if icon_metadata:
                        found_icons.append(icon_metadata)
                except Exception:
                    pass  # Icon will be marked as not found

        return found_icons

    def _create_icon_response(self, icon: IconMetadata) -> IconMetadataResponse:
        """Create IconMetadataResponse from database model."""
        pack_response = None
        if icon.pack:
            pack_response = IconPackReference.model_validate(icon.pack)

        metadata = IconMetadataResponse.model_validate(icon)
        metadata.pack = pack_response
        metadata.urls = None  # Will be set by caller if needed
        return metadata

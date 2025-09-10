"""Icon metadata and retrieval service."""
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconMetadataResponse, IconPackReference
from .base import BaseIconService


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
            if key_changed and pack_name:
                from ..document_icon_updater import DocumentIconUpdater
                document_updater = DocumentIconUpdater(self.db)
                await document_updater.update_icon_key_references(pack_name, old_icon_key, icon.key)

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
        """Get multiple icons by their full keys."""
        found_icons = []
        not_found_keys = []

        for full_key in icon_keys:
            try:
                pack_name, key = full_key.split(':', 1)
                icon_metadata = await self.get_icon_metadata(pack_name, key)
                if icon_metadata:
                    found_icons.append(icon_metadata)
                else:
                    not_found_keys.append(full_key)
            except ValueError:
                # Invalid key format
                not_found_keys.append(full_key)

        return found_icons, not_found_keys

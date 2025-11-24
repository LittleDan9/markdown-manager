"""Icon creation and installation service."""
from typing import Any, Dict, Optional

from sqlalchemy import select

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconMetadataResponse, IconPackReference
from .base import BaseIconService


class IconCreationService(BaseIconService):
    """Service for creating and installing icons."""

    async def add_icon_to_pack(
        self,
        pack_name: str,
        key: str,
        search_terms: str,
        icon_data: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None
    ) -> Optional[IconMetadataResponse]:
        """Add a new icon to an existing pack."""
        try:
            # Get the pack
            pack_query = select(IconPack).where(IconPack.name == pack_name)
            pack_result = await self.db.execute(pack_query)
            pack = pack_result.scalar_one_or_none()

            if not pack:
                return None

            # Check if icon already exists
            existing_query = select(IconMetadata).where(
                IconMetadata.pack_id == pack.id,
                IconMetadata.key == key
            )
            existing_result = await self.db.execute(existing_query)
            existing_icon = existing_result.scalar_one_or_none()

            if existing_icon:
                # Update existing icon
                existing_icon.search_terms = search_terms
                existing_icon.icon_data = icon_data
                existing_icon.file_path = file_path
                # Note: full_key is computed automatically from pack.name and key

                await self.db.commit()
                await self.db.refresh(existing_icon)

                # Create response
                response = IconMetadataResponse.model_validate(existing_icon)
                response.pack = IconPackReference.model_validate(pack)
                response.urls = None
                return response
            else:
                # Create new icon
                new_icon = IconMetadata(
                    pack_id=pack.id,
                    key=key,
                    search_terms=search_terms,
                    icon_data=icon_data,
                    file_path=file_path,
                    access_count=0
                    # Note: full_key is computed automatically from pack.name and key
                )

                self.db.add(new_icon)
                await self.db.commit()
                await self.db.refresh(new_icon)

                # Create response
                response = IconMetadataResponse.model_validate(new_icon)
                response.pack = IconPackReference.model_validate(pack)
                response.urls = None
                return response

        except Exception as e:
            await self.db.rollback()
            raise e

"""Icon pack management service."""
from typing import List, Optional

from sqlalchemy import func, select

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconPackResponse
from .base import BaseIconService


class IconPackService(BaseIconService):
    """Service for icon pack management operations."""

    async def get_icon_packs(self) -> List[IconPackResponse]:
        """Get all icon packs with their icon counts."""
        query = (
            select(
                IconPack,
                func.count(IconMetadata.id).label('icon_count')
            )
            .outerjoin(IconMetadata, IconPack.id == IconMetadata.pack_id)
            .group_by(IconPack.id)
            .order_by(IconPack.display_name)
        )

        result = await self.db.execute(query)
        pack_rows = result.all()

        pack_responses = []
        for pack_row in pack_rows:
            pack, icon_count = pack_row
            pack_response = IconPackResponse.model_validate(pack)
            pack_response.icon_count = icon_count or 0
            pack_responses.append(pack_response)

        return pack_responses

    async def install_icon_pack(
        self,
        pack_name: str,
        display_name: str,
        category: str,
        description: Optional[str] = None
    ) -> IconPackResponse:
        """Create a new icon pack."""
        new_pack = IconPack(
            name=pack_name,
            display_name=display_name,
            category=category,
            description=description
        )

        self.db.add(new_pack)
        await self.db.commit()
        await self.db.refresh(new_pack)

        pack_response = IconPackResponse.model_validate(new_pack)
        pack_response.icon_count = 0
        return pack_response

    async def update_icon_pack(
        self,
        pack_name: str,
        display_name: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[IconPackResponse]:
        """Update an existing icon pack."""
        query = select(IconPack).where(IconPack.name == pack_name)
        result = await self.db.execute(query)
        pack = result.scalar_one_or_none()

        if not pack:
            return None

        if display_name is not None:
            pack.display_name = display_name
        if category is not None:
            pack.category = category
        if description is not None:
            pack.description = description

        await self.db.commit()
        await self.db.refresh(pack)

        # Get icon count
        icon_count = await self.get_pack_icon_count(pack.id)

        pack_response = IconPackResponse.model_validate(pack)
        pack_response.icon_count = icon_count
        return pack_response

    async def delete_icon_pack(self, pack_name: str) -> bool:
        """Delete an icon pack and all its icons."""
        try:
            query = select(IconPack).where(IconPack.name == pack_name)
            result = await self.db.execute(query)
            pack = result.scalar_one_or_none()

            if not pack:
                return False

            await self.db.delete(pack)
            await self.db.commit()
            return True

        except Exception as e:
            await self.db.rollback()
            raise e

    async def get_pack_icon_count(self, pack_id: int) -> int:
        """Get the count of icons in a pack using simple SQL."""
        query = select(func.count(IconMetadata.id)).where(IconMetadata.pack_id == pack_id)
        result = await self.db.execute(query)
        return result.scalar() or 0

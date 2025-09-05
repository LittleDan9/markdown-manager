"""Standardized icon pack installer service - Iconify format only."""
from typing import Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.icon_models import IconMetadata, IconPack
from app.schemas.icon_schemas import IconPackResponse, StandardizedIconPackRequest, IconifyIconData


class StandardizedIconPackInstaller:
    """Service for installing icon packs in standardized Iconify format only."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the installer with database session."""
        self.db = db_session

    async def install_pack(self, pack_request: StandardizedIconPackRequest) -> IconPackResponse:
        """Install a new icon pack in standardized Iconify format.

        Args:
            pack_request: Validated standardized icon pack data

        Returns:
            IconPackResponse: The created icon pack
        """
        pack_info = pack_request.info
        
        # Check if pack already exists
        existing_pack = await self._get_existing_pack(pack_info["name"])
        if existing_pack:
            raise ValueError(f"Icon pack '{pack_info['name']}' already exists")

        # Create the icon pack
        icon_pack = IconPack(
            name=pack_info["name"],
            display_name=pack_info["displayName"],
            category=pack_info["category"],
            description=pack_info.get("description"),
            icon_count=0
        )

        self.db.add(icon_pack)
        await self.db.flush()  # Get the ID

        # Install icons in standardized format
        icon_count = await self._install_icons(icon_pack.id, pack_request.icons, pack_info["name"])

        # Update icon count
        icon_pack.icon_count = icon_count
        await self.db.commit()

        return IconPackResponse.model_validate(icon_pack)

    async def update_pack(self, pack_name: str, pack_request: StandardizedIconPackRequest) -> IconPackResponse:
        """Update an existing icon pack."""
        # Get existing pack
        existing_pack = await self._get_existing_pack(pack_name)
        if not existing_pack:
            raise ValueError(f"Icon pack '{pack_name}' not found")

        pack_info = pack_request.info

        # Update pack metadata
        existing_pack.display_name = pack_info["displayName"]
        existing_pack.category = pack_info["category"]
        existing_pack.description = pack_info.get("description")

        # Delete existing icons
        delete_query = select(IconMetadata).where(IconMetadata.pack_id == existing_pack.id)
        result = await self.db.execute(delete_query)
        icons_to_delete = result.scalars().all()

        for icon in icons_to_delete:
            await self.db.delete(icon)

        await self.db.flush()  # Ensure deletions are committed before inserting new ones

        # Install new icons
        icon_count = await self._install_icons(existing_pack.id, pack_request.icons, pack_name)

        # Update icon count
        existing_pack.icon_count = icon_count
        await self.db.commit()

        return IconPackResponse.model_validate(existing_pack)

    async def _get_existing_pack(self, pack_name: str) -> IconPack:
        """Get existing icon pack by name."""
        query = select(IconPack).where(IconPack.name == pack_name)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _install_icons(
        self,
        pack_id: int,
        icons_data: Dict[str, Dict],
        pack_name: str
    ) -> int:
        """Install icons from standardized format.
        
        Args:
            pack_id: The pack ID
            icons_data: Dictionary of {icon_key: IconifyIconData}
            pack_name: Pack name for generating full_key
            
        Returns:
            Number of icons installed
        """
        import logging
        logger = logging.getLogger(__name__)
        
        installed_count = 0
        
        for icon_key, icon_data in icons_data.items():
            # Generate search terms from icon key
            search_terms = self._generate_search_terms(icon_key)
            
            # Create icon metadata with standardized data
            icon_metadata = IconMetadata(
                pack_id=pack_id,
                key=icon_key,
                full_key=f"{pack_name}:{icon_key}",
                search_terms=search_terms,
                icon_data={
                    "body": icon_data.body,
                    "width": icon_data.width,
                    "height": icon_data.height,
                    "viewBox": icon_data.viewBox
                },
                file_path=None,
                access_count=0
            )
            
            self.db.add(icon_metadata)
            installed_count += 1
            
            if installed_count % 100 == 0:
                logger.info(f"Installed {installed_count} icons...")

        logger.info(f"Installed {installed_count} icons total")
        return installed_count

    def _generate_search_terms(self, icon_key: str) -> str:
        """Generate search terms from an icon key."""
        # Convert kebab-case, snake_case, and camelCase to space-separated terms
        import re
        
        # Replace hyphens and underscores with spaces
        terms = re.sub(r'[-_]', ' ', icon_key)
        
        # Split camelCase
        terms = re.sub(r'([a-z])([A-Z])', r'\1 \2', terms)
        
        # Convert to lowercase and normalize spaces
        terms = re.sub(r'\s+', ' ', terms.lower()).strip()
        
        # Include the original key as well
        all_terms = f"{icon_key} {terms}".strip()
        
        return all_terms

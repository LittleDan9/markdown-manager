"""Icon SVG and file operations service."""
import os
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from .base import BaseIconService


class IconSVGService(BaseIconService):
    """Service for icon SVG operations."""

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
        metadata = await self._get_icon_metadata_for_svg(pack_name, key)
        if not metadata:
            return None

        # Track usage
        await self.track_usage(pack_name, key)

        # Generate SVG based on icon type
        svg_content = None
        if metadata.icon_data:
            # Handle Iconify-style data
            if isinstance(metadata.icon_data, dict) and 'body' in metadata.icon_data:
                width = metadata.icon_data.get('width', 24)
                height = metadata.icon_data.get('height', 24)
                viewbox = metadata.icon_data.get('viewBox', f'0 0 {width} {height}')
                body = metadata.icon_data['body']

                svg_content = (
                    f'<svg width="{width}" height="{height}" viewBox="{viewbox}" '
                    f'xmlns="http://www.w3.org/2000/svg">{body}</svg>'
                )

        elif metadata.file_path:
            # Handle file-based SVG (like AWS)
            if os.path.exists(metadata.file_path):
                try:
                    with open(metadata.file_path, 'r', encoding='utf-8') as f:
                        svg_content = f.read()
                except Exception:
                    # Handle file read errors gracefully
                    svg_content = None

        # Cache the SVG content if we found it
        if svg_content:
            self.cache.put_icon_svg(full_key, svg_content)

        return svg_content

    async def _get_icon_metadata_for_svg(self, pack_name: str, key: str):
        """Get icon metadata specifically for SVG generation (internal method)."""
        query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .join(IconPack)
            .where(and_(IconPack.name == pack_name, IconMetadata.key == key))
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def track_usage(self, pack_name: str, key: str, user_id: Optional[int] = None) -> None:
        """Track usage of an icon."""
        try:
            query = (
                select(IconMetadata)
                .join(IconPack)
                .where(and_(IconPack.name == pack_name, IconMetadata.key == key))
            )
            result = await self.db.execute(query)
            icon = result.scalar_one_or_none()

            if icon:
                icon.access_count = icon.access_count + 1
                await self.db.commit()

        except Exception:
            # Don't let usage tracking failures break the main operation
            await self.db.rollback()

"""Icon SVG and file operations service."""
import os
import re
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from .base import BaseIconService


class IconSVGService(BaseIconService):
    """Service for icon SVG operations."""

    @staticmethod
    def clean_body_for_mermaid(body: str) -> str:
        """Clean SVG body content for Mermaid use by removing namespaces.

        Mermaid needs clean SVG content without namespace prefixes since
        it wraps the content in its own SVG element without namespace declarations.
        """
        if not body:
            return body

        # Remove namespace declarations from body
        body = re.sub(r'xmlns:[^=\s]+="[^"]*"', '', body)

        # Remove namespace prefixes from element names
        # e.g., <ns0:path> becomes <path>, <ns1:g> becomes <g>
        body = re.sub(r'<(/?)ns\d+:', r'<\1', body)

        # Remove namespace prefixes from attributes
        # e.g., ns1:pageshadow="2" becomes pageshadow="2"
        body = re.sub(r'\sns\d+:', ' ', body)

        # Clean up any extra whitespace
        body = re.sub(r'\s+', ' ', body).strip()

        return body

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
            # Handle full SVG storage (for complex SVGs)
            if isinstance(metadata.icon_data, dict) and 'full_svg' in metadata.icon_data:
                svg_content = metadata.icon_data['full_svg']
            # Handle Iconify-style data
            elif isinstance(metadata.icon_data, dict) and 'body' in metadata.icon_data:
                width = metadata.icon_data.get('width', 24)
                height = metadata.icon_data.get('height', 24)
                viewbox = metadata.icon_data.get('viewBox', f'0 0 {width} {height}')
                body = metadata.icon_data['body']

                # Fix dimension mismatches: if width/height don't match viewBox, extract from viewBox
                try:
                    if viewbox != f'0 0 {width} {height}':
                        vb_parts = viewbox.split()
                        if len(vb_parts) == 4:
                            vb_width = float(vb_parts[2])
                            vb_height = float(vb_parts[3])
                            # Use viewBox dimensions if they're significantly different from stored dimensions
                            if abs(vb_width - float(width)) > 1 or abs(vb_height - float(height)) > 1:
                                width = int(vb_width) if vb_width.is_integer() else vb_width
                                height = int(vb_height) if vb_height.is_integer() else vb_height
                except (ValueError, IndexError):
                    # Keep original dimensions if viewBox parsing fails
                    pass

                # Extract namespace declarations from body and move to root SVG
                namespaces = {}
                namespace_pattern = r'xmlns:([^=\s]+)="([^"]*)"'

                # Find all namespace declarations in the body
                for match in re.finditer(namespace_pattern, body):
                    prefix, uri = match.groups()
                    namespaces[prefix] = uri

                # Remove namespace declarations from body to avoid duplication
                cleaned_body = re.sub(namespace_pattern, '', body)

                # Build namespace declarations for root SVG
                xmlns_attrs = 'xmlns="http://www.w3.org/2000/svg"'
                for prefix, uri in namespaces.items():
                    xmlns_attrs += f' xmlns:{prefix}="{uri}"'

                svg_content = (
                    f'<svg width="{width}" height="{height}" viewBox="{viewbox}" '
                    f'{xmlns_attrs}>{cleaned_body}</svg>'
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

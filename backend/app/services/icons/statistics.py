"""Icon statistics and monitoring service."""
from typing import Any, Dict

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from .base import BaseIconService


class IconStatisticsService(BaseIconService):
    """Service for icon statistics and monitoring operations."""

    async def get_pack_statistics(self) -> Dict[str, Any]:
        """Get comprehensive icon pack statistics."""
        # Get total counts
        total_packs_query = select(func.count(IconPack.id))
        total_icons_query = select(func.count(IconMetadata.id))

        total_packs_result = await self.db.execute(total_packs_query)
        total_icons_result = await self.db.execute(total_icons_query)

        total_packs = total_packs_result.scalar() or 0
        total_icons = total_icons_result.scalar() or 0

        # Get pack distribution
        pack_distribution_query = (
            select(
                IconPack.category,
                func.count(IconPack.id).label('pack_count'),
                func.count(IconMetadata.id).label('icon_count')
            )
            .outerjoin(IconMetadata, IconPack.id == IconMetadata.pack_id)
            .group_by(IconPack.category)
            .order_by(IconPack.category)
        )

        pack_distribution_result = await self.db.execute(pack_distribution_query)
        pack_distribution = {}

        for row in pack_distribution_result:
            pack_distribution[row.category] = {
                'packs': row.pack_count,
                'icons': row.icon_count or 0
            }

        # Get most used icons
        top_icons_query = (
            select(IconMetadata, IconPack.name.label('pack_name'))
            .join(IconPack)
            .order_by(IconMetadata.access_count.desc())
            .limit(10)
        )

        top_icons_result = await self.db.execute(top_icons_query)
        top_icons = []

        for row in top_icons_result:
            icon, pack_name = row
            top_icons.append({
                'pack': pack_name,
                'key': icon.key,
                'access_count': icon.access_count
            })

        return {
            'summary': {
                'total_packs': total_packs,
                'total_icons': total_icons,
                'categories': len(pack_distribution)
            },
            'by_category': pack_distribution,
            'top_icons': top_icons,
            'cache_stats': self.cache.get_cache_stats()
        }

    async def warm_cache(self) -> Dict[str, Any]:
        """Warm the cache with popular icons."""
        # Get top 50 most accessed icons
        query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .order_by(IconMetadata.access_count.desc())
            .limit(50)
        )

        result = await self.db.execute(query)
        popular_icons = result.scalars().all()

        warmed_count = 0
        for icon in popular_icons:
            if icon.pack:
                # This will trigger caching if not already cached
                try:
                    from .metadata import IconMetadataService
                    metadata_service = IconMetadataService(self.db)
                    await metadata_service.get_icon_metadata(icon.pack.name, icon.key)
                    warmed_count += 1
                except Exception:
                    # Skip failed cache warming attempts
                    continue

        return {
            'success': True,
            'warmed_icons': warmed_count,
            'total_popular_icons': len(popular_icons),
            'cache_stats': self.cache.get_cache_stats()
        }

    async def health_check(self) -> Dict[str, Any]:
        """Perform a health check on the icon service."""
        try:
            # Test database connectivity
            test_query = select(func.count(IconPack.id))
            result = await self.db.execute(test_query)
            pack_count = result.scalar()

            # Test cache
            cache_stats = self.cache.get_cache_stats()

            return {
                'status': 'healthy',
                'details': 'Icon service is operational',
                'database': {
                    'connected': True,
                    'pack_count': pack_count
                },
                'cache': cache_stats
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'details': f'Icon service error: {str(e)}',
                'error': str(e),
                'database': {
                    'connected': False
                }
            }

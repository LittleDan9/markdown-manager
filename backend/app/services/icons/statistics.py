"""Icon statistics and monitoring service."""
import re
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import func, select, and_, desc
from sqlalchemy.orm import selectinload

from app.models.icon_models import IconMetadata, IconPack
from app.models.document import Document
from app.services.document_icon_updater import DocumentIconUpdater
from .base import BaseIconService


class IconStatisticsService(BaseIconService):
    """Service for icon statistics and monitoring operations."""

    def __init__(self, db_session):
        """Initialize the statistics service with document updater integration."""
        super().__init__(db_session)
        self.document_updater = DocumentIconUpdater(db_session)

    async def get_pack_statistics(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get comprehensive icon pack statistics with document usage analysis."""
        # Get total counts
        total_packs_query = select(func.count(IconPack.id))
        total_icons_query = select(func.count(IconMetadata.id))

        total_packs_result = await self.db.execute(total_packs_query)
        total_icons_result = await self.db.execute(total_icons_query)

        total_packs = total_packs_result.scalar() or 0
        total_icons = total_icons_result.scalar() or 0

        # Get pack distribution with icon counts
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

        # Get most used icons (by API access count)
        top_icons_query = (
            select(IconMetadata, IconPack.name.label('pack_name'))
            .join(IconPack)
            .order_by(desc(IconMetadata.access_count))
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

        # Document usage analysis (if user_id provided)
        document_usage = {}
        if user_id:
            document_usage = await self._analyze_document_usage(user_id)

        return {
            'summary': {
                'total_packs': total_packs,
                'total_icons': total_icons,
                'categories': len(pack_distribution)
            },
            'by_category': pack_distribution,
            'top_icons': top_icons,
            'document_usage': document_usage,
            'cache_stats': self.cache.get_cache_stats()
        }

    async def _analyze_document_usage(self, user_id: int) -> Dict[str, Any]:
        """Analyze icon usage in user documents by scanning content."""
        try:
            # Get all icon packs for analysis
            packs_query = select(IconPack)
            packs_result = await self.db.execute(packs_query)
            packs = packs_result.scalars().all()

            document_stats = {
                'documents_analyzed': 0,
                'documents_with_icons': 0,
                'total_icon_references': 0,
                'packs_used': {},
                'mermaid_diagrams': 0,
                'most_used_in_documents': []
            }

            # Get all user documents for analysis
            docs_query = select(Document).where(Document.user_id == user_id)
            docs_result = await self.db.execute(docs_query)
            documents = docs_result.scalars().all()

            document_stats['documents_analyzed'] = len(documents)

            icon_usage_counter = {}
            documents_with_icons_set = set()

            # Analyze each pack for document usage
            for pack in packs:
                pack_stats = await self.document_updater.get_icon_usage_stats(pack.name, user_id)

                if pack_stats['documents_count'] > 0:
                    document_stats['packs_used'][pack.name] = {
                        'display_name': pack.display_name,
                        'category': pack.category,
                        'documents_count': pack_stats['documents_count'],
                        'total_references': pack_stats['total_references'],
                        'unique_icons_used': pack_stats['unique_icons_used'],
                        'icons_used': pack_stats['icon_names']
                    }

                    # Track documents with icons
                    documents_with_icons_set.update(range(pack_stats['documents_count']))

                    # Count icon usage for most used list
                    for icon_name in pack_stats['icon_names']:
                        full_key = f"{pack.name}:{icon_name}"
                        icon_usage_counter[full_key] = icon_usage_counter.get(full_key, 0) + pack_stats['total_references']

            document_stats['documents_with_icons'] = len(documents_with_icons_set)
            document_stats['total_icon_references'] = sum(
                pack_data['total_references'] for pack_data in document_stats['packs_used'].values()
            )

            # Get most used icons in documents (top 10)
            most_used = sorted(icon_usage_counter.items(), key=lambda x: x[1], reverse=True)[:10]
            document_stats['most_used_in_documents'] = [
                {'icon': icon, 'usage_count': count} for icon, count in most_used
            ]

            # Analyze Mermaid diagrams
            mermaid_count = await self._count_mermaid_diagrams(user_id)
            document_stats['mermaid_diagrams'] = mermaid_count

            return document_stats

        except Exception as e:
            # Return basic stats if analysis fails
            return {
                'error': f"Document analysis failed: {str(e)}",
                'documents_analyzed': 0,
                'documents_with_icons': 0,
                'total_icon_references': 0,
                'packs_used': {},
                'mermaid_diagrams': 0,
                'most_used_in_documents': []
            }

    async def _count_mermaid_diagrams(self, user_id: int) -> int:
        """Count Mermaid diagrams in user documents."""
        try:
            docs_query = select(Document).where(Document.user_id == user_id)
            docs_result = await self.db.execute(docs_query)
            documents = docs_result.scalars().all()

            mermaid_count = 0
            mermaid_pattern = re.compile(r'```mermaid\s', re.IGNORECASE | re.MULTILINE)

            for doc in documents:
                content = await self.document_updater._load_document_content(doc, user_id)
                matches = mermaid_pattern.findall(content)
                mermaid_count += len(matches)

            return mermaid_count

        except Exception:
            return 0

    async def get_pack_document_usage(self, pack_name: str, user_id: int) -> Dict[str, Any]:
        """Get detailed document usage statistics for a specific pack."""
        try:
            pack_stats = await self.document_updater.get_icon_usage_stats(pack_name, user_id)

            # Get pack metadata
            pack_query = select(IconPack).where(IconPack.name == pack_name)
            pack_result = await self.db.execute(pack_query)
            pack = pack_result.scalar_one_or_none()

            if not pack:
                return {'error': f'Pack {pack_name} not found'}

            # Get documents that use this pack
            docs_using_pack = await self.document_updater.find_documents_using_pack(pack_name, user_id)

            # Get detailed icon usage within documents
            icon_details = {}
            for icon_name in pack_stats['icon_names']:
                docs_with_icon = await self.document_updater.find_documents_using_icon(
                    pack_name, icon_name, user_id
                )
                icon_details[icon_name] = {
                    'documents_count': len(docs_with_icon),
                    'documents': [{'id': doc_id, 'name': doc_name} for doc_id, doc_name in docs_with_icon]
                }

            return {
                'pack_name': pack_name,
                'display_name': pack.display_name,
                'category': pack.category,
                'description': pack.description,
                'summary': pack_stats,
                'documents_using_pack': [
                    {'id': doc_id, 'name': doc_name} for doc_id, doc_name in docs_using_pack
                ],
                'icon_usage_details': icon_details
            }

        except Exception as e:
            return {'error': f'Failed to analyze pack usage: {str(e)}'}

    async def get_document_icon_analysis(self, document_id: int, user_id: int) -> Dict[str, Any]:
        """Analyze icon usage in a specific document."""
        try:
            # Get document
            doc_query = select(Document).where(
                and_(Document.id == document_id, Document.user_id == user_id)
            )
            doc_result = await self.db.execute(doc_query)
            document = doc_result.scalar_one_or_none()

            if not document:
                return {'error': 'Document not found'}

            # Load document content
            content = await self.document_updater._load_document_content(document, user_id)

            # Extract all icon references
            icon_pattern = re.compile(r'([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)', re.MULTILINE)
            matches = icon_pattern.findall(content)

            # Count Mermaid diagrams
            mermaid_pattern = re.compile(r'```mermaid\s', re.IGNORECASE | re.MULTILINE)
            mermaid_matches = mermaid_pattern.findall(content)

            # Organize by pack
            packs_used = {}
            total_references = 0

            for pack_name, icon_name in matches:
                if pack_name not in packs_used:
                    packs_used[pack_name] = {
                        'icons': {},
                        'total_count': 0
                    }

                if icon_name not in packs_used[pack_name]['icons']:
                    packs_used[pack_name]['icons'][icon_name] = 0

                packs_used[pack_name]['icons'][icon_name] += 1
                packs_used[pack_name]['total_count'] += 1
                total_references += 1

            return {
                'document_id': document_id,
                'document_name': document.name,
                'folder_path': document.folder_path,
                'total_icon_references': total_references,
                'mermaid_diagrams_count': len(mermaid_matches),
                'packs_used': packs_used,
                'unique_packs_count': len(packs_used),
                'analysis_timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'error': f'Failed to analyze document: {str(e)}'}

    async def get_usage_trends(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """Get icon usage trends over time (placeholder for future enhancement)."""
        # This would require tracking usage over time in a separate table
        # For now, return current statistics with timestamp
        current_stats = await self._analyze_document_usage(user_id)

        return {
            'period_days': days,
            'current_snapshot': current_stats,
            'trends': {
                'note': 'Historical trend analysis requires usage tracking enhancement',
                'recommendation': 'Consider implementing time-based usage logging'
            },
            'snapshot_timestamp': datetime.now().isoformat()
        }

    async def warm_cache(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Warm the cache with popular icons from both API usage and document analysis."""
        try:
            # Get popular icons from API usage
            warmed_count = await self._warm_api_popular_icons()

            # Add document popular icons if user provided
            doc_warmed = 0
            if user_id:
                doc_warmed = await self._warm_document_popular_icons(user_id)

            return {
                'success': True,
                'warmed_icons': warmed_count + doc_warmed,
                'api_popular_icons': warmed_count,
                'document_popular_icons': doc_warmed,
                'cache_stats': self.cache.get_cache_stats()
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'warmed_icons': 0,
                'cache_stats': self.cache.get_cache_stats()
            }

    async def _warm_api_popular_icons(self) -> int:
        """Warm cache with API popular icons."""
        query = (
            select(IconMetadata)
            .options(selectinload(IconMetadata.pack))
            .order_by(desc(IconMetadata.access_count))
            .limit(25)
        )

        result = await self.db.execute(query)
        popular_icons = result.scalars().all()

        warmed_count = 0
        for icon in popular_icons:
            if icon.pack:
                try:
                    from .metadata import IconMetadataService
                    metadata_service = IconMetadataService(self.db)
                    await metadata_service.get_icon_metadata(icon.pack.name, icon.key)
                    warmed_count += 1
                except Exception:
                    continue

        return warmed_count

    async def _warm_document_popular_icons(self, user_id: int) -> int:
        """Warm cache with document popular icons."""
        try:
            doc_usage = await self._analyze_document_usage(user_id)
            document_popular = doc_usage.get('most_used_in_documents', [])

            warmed_count = 0
            for item in document_popular[:15]:
                icon_ref = item['icon']
                if ':' in icon_ref:
                    pack_name, icon_key = icon_ref.split(':', 1)
                    try:
                        from .metadata import IconMetadataService
                        metadata_service = IconMetadataService(self.db)
                        await metadata_service.get_icon_metadata(pack_name, icon_key)
                        warmed_count += 1
                    except Exception:
                        continue

            return warmed_count
        except Exception:
            return 0

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

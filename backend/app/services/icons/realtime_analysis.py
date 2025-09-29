"""Real-time document analysis service for Phase 4 implementation."""
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.icon_models import IconPack
from app.services.document_icon_updater import DocumentIconUpdater
from .base import BaseIconService


class RealtimeDocumentAnalyzer(BaseIconService):
    """Service for real-time document analysis and usage insights."""

    def __init__(self, db_session: AsyncSession):
        """Initialize the real-time analyzer."""
        super().__init__(db_session)
        self.document_updater = DocumentIconUpdater(db_session)
        self._analysis_cache = {}
        self._cache_ttl = 300  # 5 minutes

    async def analyze_document_realtime(self, document_id: int, user_id: int) -> Dict[str, Any]:
        """
        Perform real-time analysis of a single document.

        Args:
            document_id: ID of the document to analyze
            user_id: User ID for access control

        Returns:
            Dictionary with real-time analysis results
        """
        cache_key = f"doc_analysis_{document_id}_{user_id}"

        # Check cache first
        if cache_key in self._analysis_cache:
            cached_result, timestamp = self._analysis_cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self._cache_ttl):
                return cached_result

        # Get document
        doc_query = select(Document).where(
            and_(Document.id == document_id, Document.user_id == user_id)
        )
        doc_result = await self.db.execute(doc_query)
        document = doc_result.scalar_one_or_none()

        if not document:
            return {"error": "Document not found"}

        # Load document content
        content = await self.document_updater._load_document_content(document, user_id)

        # Perform comprehensive analysis
        analysis = await self._analyze_content_comprehensive(content, document, user_id)

        # Cache the result
        self._analysis_cache[cache_key] = (analysis, datetime.now())

        return analysis

    async def _analyze_content_comprehensive(
        self,
        content: str,
        document: Document,
        user_id: int
    ) -> Dict[str, Any]:
        """Perform comprehensive content analysis."""

        # Extract icon references
        icon_pattern = re.compile(r'([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)', re.MULTILINE)
        icon_matches = icon_pattern.findall(content)

        # Extract Mermaid diagrams
        mermaid_pattern = re.compile(r'```mermaid\s+(.*?)```', re.DOTALL | re.IGNORECASE)
        mermaid_matches = mermaid_pattern.findall(content)

        # Extract markdown images with icons
        image_pattern = re.compile(r'!\[([^\]]*)\]\(([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\)')
        image_matches = image_pattern.findall(content)

        # Organize icon usage by pack
        packs_used = {}
        total_icon_references = 0
        context_usage = {
            "mermaid_diagrams": 0,
            "markdown_images": 0,
            "direct_references": 0
        }

        # Process direct icon references
        for pack_name, icon_name in icon_matches:
            if pack_name not in packs_used:
                packs_used[pack_name] = {
                    "icons": {},
                    "total_count": 0,
                    "contexts": set()
                }

            if icon_name not in packs_used[pack_name]["icons"]:
                packs_used[pack_name]["icons"][icon_name] = 0

            packs_used[pack_name]["icons"][icon_name] += 1
            packs_used[pack_name]["total_count"] += 1
            packs_used[pack_name]["contexts"].add("direct")
            total_icon_references += 1
            context_usage["direct_references"] += 1

        # Process Mermaid diagram context
        for mermaid_content in mermaid_matches:
            context_usage["mermaid_diagrams"] += 1
            # Look for icons within mermaid content
            mermaid_icons = icon_pattern.findall(mermaid_content)
            for pack_name, icon_name in mermaid_icons:
                if pack_name in packs_used:
                    packs_used[pack_name]["contexts"].add("mermaid")

        # Process markdown image context
        for alt_text, pack_name, icon_name in image_matches:
            context_usage["markdown_images"] += 1
            if pack_name in packs_used:
                packs_used[pack_name]["contexts"].add("markdown_image")

        # Convert sets to lists for JSON serialization
        for pack_name in packs_used:
            packs_used[pack_name]["contexts"] = list(packs_used[pack_name]["contexts"])

        # Get pack metadata for additional insights
        pack_metadata = await self._get_pack_metadata(list(packs_used.keys()))

        # Analyze usage patterns
        usage_patterns = await self._analyze_usage_patterns(packs_used, content)

        # Calculate readability and maintenance metrics
        maintenance_metrics = self._calculate_maintenance_metrics(
            content, total_icon_references, len(packs_used)
        )

        return {
            "document_id": document.id,
            "document_name": document.name,
            "folder_path": document.folder_path,
            "analysis_timestamp": datetime.now().isoformat(),
            "content_analysis": {
                "total_lines": len(content.split('\n')),
                "total_characters": len(content),
                "total_words": len(content.split())
            },
            "icon_usage": {
                "total_icon_references": total_icon_references,
                "unique_packs_used": len(packs_used),
                "unique_icons_used": sum(len(pack_data["icons"]) for pack_data in packs_used.values()),
                "packs_used": packs_used,
                "context_breakdown": context_usage
            },
            "mermaid_analysis": {
                "diagrams_count": len(mermaid_matches),
                "total_diagram_lines": sum(len(m.split('\n')) for m in mermaid_matches),
                "icons_in_diagrams": context_usage["mermaid_diagrams"] > 0
            },
            "pack_metadata": pack_metadata,
            "usage_patterns": usage_patterns,
            "maintenance_metrics": maintenance_metrics,
            "recommendations": await self._generate_recommendations(packs_used, context_usage, document)
        }

    async def _get_pack_metadata(self, pack_names: List[str]) -> Dict[str, Any]:
        """Get metadata for the used icon packs."""
        if not pack_names:
            return {}

        pack_query = select(IconPack).where(IconPack.name.in_(pack_names))
        pack_result = await self.db.execute(pack_query)
        packs = pack_result.scalars().all()

        metadata = {}
        for pack in packs:
            metadata[pack.name] = {
                "display_name": pack.display_name,
                "category": pack.category,
                "description": pack.description
            }

        return metadata

    async def _analyze_usage_patterns(
        self,
        packs_used: Dict[str, Any],
        content: str
    ) -> Dict[str, Any]:
        """Analyze usage patterns in the document."""

        patterns = {
            "icon_density": 0,  # icons per 100 words
            "pack_diversity": len(packs_used),
            "most_used_pack": None,
            "most_used_icon": None,
            "context_preferences": {},
            "clustering": "distributed"  # distributed, clustered, mixed
        }

        if not packs_used:
            return patterns

        # Calculate icon density
        word_count = len(content.split())
        total_icons = sum(pack_data["total_count"] for pack_data in packs_used.values())
        patterns["icon_density"] = round((total_icons / max(word_count, 1)) * 100, 2)

        # Find most used pack
        most_used_pack = max(packs_used.items(), key=lambda x: x[1]["total_count"])
        patterns["most_used_pack"] = {
            "name": most_used_pack[0],
            "usage_count": most_used_pack[1]["total_count"]
        }

        # Find most used icon across all packs
        all_icons = []
        for pack_name, pack_data in packs_used.items():
            for icon_name, count in pack_data["icons"].items():
                all_icons.append((f"{pack_name}:{icon_name}", count))

        if all_icons:
            most_used_icon = max(all_icons, key=lambda x: x[1])
            patterns["most_used_icon"] = {
                "name": most_used_icon[0],
                "usage_count": most_used_icon[1]
            }

        # Analyze context preferences
        context_counts = {}
        for pack_data in packs_used.values():
            for context in pack_data["contexts"]:
                context_counts[context] = context_counts.get(context, 0) + 1

        patterns["context_preferences"] = context_counts

        return patterns

    def _calculate_maintenance_metrics(
        self,
        content: str,
        total_icons: int,
        pack_count: int
    ) -> Dict[str, Any]:
        """Calculate metrics related to document maintenance."""

        lines = content.split('\n')

        return {
            "icon_to_content_ratio": round(total_icons / max(len(lines), 1), 3),
            "pack_consolidation_score": round(1 / max(pack_count, 1), 3),  # Higher = fewer packs
            "complexity_score": min(pack_count * 0.2 + (total_icons / max(len(lines), 1)) * 10, 10),
            "maintainability": "high" if pack_count <= 3 and total_icons <= 20 else
                               "medium" if pack_count <= 6 and total_icons <= 50 else "low"
        }

    async def _generate_recommendations(
        self,
        packs_used: Dict[str, Any],
        context_usage: Dict[str, int],
        document: Document
    ) -> List[Dict[str, str]]:
        """Generate actionable recommendations for the document."""

        recommendations = []

        # Pack consolidation recommendations
        if len(packs_used) > 5:
            recommendations.append({
                "type": "pack_consolidation",
                "priority": "medium",
                "title": "Consider Pack Consolidation",
                "description": f"Document uses {len(packs_used)} different icon packs. Consider using fewer packs for consistency.",
                "action": "Review if some packs can be replaced with icons from your primary packs"
            })

        # Context-specific recommendations
        if context_usage["mermaid_diagrams"] > 0:
            recommendations.append({
                "type": "mermaid_optimization",
                "priority": "low",
                "title": "Mermaid Diagram Enhancement",
                "description": "Icons detected in Mermaid diagrams. Ensure they render correctly.",
                "action": "Test diagram rendering and consider icon size adjustments"
            })

        # Heavy usage recommendations
        total_icons = sum(pack_data["total_count"] for pack_data in packs_used.values())
        if total_icons > 30:
            recommendations.append({
                "type": "icon_density",
                "priority": "medium",
                "title": "High Icon Density",
                "description": f"Document contains {total_icons} icon references. Consider if all are necessary.",
                "action": "Review icon usage for essential vs. decorative purposes"
            })

        # Performance recommendations
        if len(packs_used) > 3:
            recommendations.append({
                "type": "performance",
                "priority": "low",
                "title": "Loading Performance",
                "description": "Multiple icon packs may affect loading performance.",
                "action": "Consider caching or optimizing icon pack loading"
            })

        return recommendations

    async def get_usage_trends_realtime(
        self,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get real-time usage trends for the user over a specified period.

        Args:
            user_id: User ID to analyze
            days: Number of days to analyze

        Returns:
            Dictionary with trend analysis
        """
        # Get all user documents modified in the specified period
        since_date = datetime.now() - timedelta(days=days)

        docs_query = select(Document).where(
            and_(
                Document.user_id == user_id,
                Document.updated_at >= since_date
            )
        ).order_by(desc(Document.updated_at))

        docs_result = await self.db.execute(docs_query)
        documents = docs_result.scalars().all()

        # Analyze each document for trends
        daily_usage = {}
        pack_popularity = {}
        icon_popularity = {}
        context_trends = {
            "mermaid_usage": [],
            "markdown_image_usage": [],
            "direct_reference_usage": []
        }

        for doc in documents:
            doc_date = doc.updated_at.date()
            day_key = doc_date.isoformat()

            if day_key not in daily_usage:
                daily_usage[day_key] = {
                    "documents_updated": 0,
                    "total_icons": 0,
                    "packs_used": set(),
                    "new_icons": set()
                }

            # Analyze document content
            content = await self.document_updater._load_document_content(doc, user_id)
            analysis = await self._analyze_content_comprehensive(content, doc, user_id)

            daily_usage[day_key]["documents_updated"] += 1
            daily_usage[day_key]["total_icons"] += analysis["icon_usage"]["total_icon_references"]

            # Track pack and icon usage
            for pack_name, pack_data in analysis["icon_usage"]["packs_used"].items():
                daily_usage[day_key]["packs_used"].add(pack_name)
                pack_popularity[pack_name] = pack_popularity.get(pack_name, 0) + pack_data["total_count"]

                for icon_name in pack_data["icons"]:
                    full_icon = f"{pack_name}:{icon_name}"
                    daily_usage[day_key]["new_icons"].add(full_icon)
                    icon_popularity[full_icon] = icon_popularity.get(full_icon, 0) + pack_data["icons"][icon_name]

            # Track context trends
            context_breakdown = analysis["icon_usage"]["context_breakdown"]
            context_trends["mermaid_usage"].append({
                "date": day_key,
                "count": context_breakdown["mermaid_diagrams"]
            })
            context_trends["markdown_image_usage"].append({
                "date": day_key,
                "count": context_breakdown["markdown_images"]
            })
            context_trends["direct_reference_usage"].append({
                "date": day_key,
                "count": context_breakdown["direct_references"]
            })

        # Convert sets to counts for JSON serialization
        for day_data in daily_usage.values():
            day_data["unique_packs"] = len(day_data["packs_used"])
            day_data["unique_icons"] = len(day_data["new_icons"])
            del day_data["packs_used"]
            del day_data["new_icons"]

        # Generate trend insights
        trend_insights = self._generate_trend_insights(
            daily_usage, pack_popularity, icon_popularity, context_trends
        )

        return {
            "analysis_period": {
                "days": days,
                "start_date": since_date.date().isoformat(),
                "end_date": datetime.now().date().isoformat()
            },
            "daily_usage": daily_usage,
            "pack_popularity": dict(sorted(pack_popularity.items(), key=lambda x: x[1], reverse=True)[:10]),
            "icon_popularity": dict(sorted(icon_popularity.items(), key=lambda x: x[1], reverse=True)[:20]),
            "context_trends": context_trends,
            "insights": trend_insights,
            "summary": {
                "total_documents_analyzed": len(documents),
                "total_icon_references": sum(day_data["total_icons"] for day_data in daily_usage.values()),
                "most_active_day": max(daily_usage.items(), key=lambda x: x[1]["documents_updated"])[0] if daily_usage else None,
                "trend_direction": "increasing" if self._calculate_trend_direction(daily_usage) > 0 else "decreasing"
            }
        }

    async def _get_cached_analysis(self, document_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Get cached analysis for a document."""
        cache_key = f"doc_analysis_{document_id}_{user_id}"
        if cache_key in self._analysis_cache:
            cached_result, timestamp = self._analysis_cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self._cache_ttl):
                return cached_result
        return None

    def _generate_trend_insights(
        self,
        daily_usage: Dict,
        pack_popularity: Dict,
        icon_popularity: Dict,
        context_trends: Dict
    ) -> List[Dict[str, str]]:
        """Generate insights from trend analysis."""

        insights = []

        # Most popular pack insight
        if pack_popularity:
            top_pack = max(pack_popularity.items(), key=lambda x: x[1])
            insights.append({
                "type": "pack_preference",
                "title": "Primary Icon Pack",
                "description": f"'{top_pack[0]}' is your most used icon pack with {top_pack[1]} references",
                "recommendation": "Consider standardizing on this pack for consistency"
            })

        # Usage frequency insight
        if daily_usage:
            avg_daily_icons = sum(day["total_icons"] for day in daily_usage.values()) / len(daily_usage)
            if avg_daily_icons > 10:
                insights.append({
                    "type": "usage_frequency",
                    "title": "High Icon Usage",
                    "description": f"Average {avg_daily_icons:.1f} icons per active day",
                    "recommendation": "Consider creating reusable icon templates"
                })

        # Context preference insight
        mermaid_total = sum(item["count"] for item in context_trends["mermaid_usage"])
        direct_total = sum(item["count"] for item in context_trends["direct_reference_usage"])

        if mermaid_total > direct_total:
            insights.append({
                "type": "context_preference",
                "title": "Diagram-Heavy Usage",
                "description": "Most icons are used in Mermaid diagrams",
                "recommendation": "Optimize icon loading for diagram rendering"
            })

        return insights

    def _calculate_trend_direction(self, daily_usage: Dict) -> float:
        """Calculate if usage is trending up or down."""
        if len(daily_usage) < 2:
            return 0

        dates = sorted(daily_usage.keys())
        early_period = dates[:len(dates)//2]
        late_period = dates[len(dates)//2:]

        early_avg = sum(daily_usage[date]["total_icons"] for date in early_period) / len(early_period)
        late_avg = sum(daily_usage[date]["total_icons"] for date in late_period) / len(late_period)

        return late_avg - early_avg

    async def clear_cache(self) -> int:
        """Clear the analysis cache and return number of entries cleared."""
        cleared_count = len(self._analysis_cache)
        self._analysis_cache.clear()
        return cleared_count

    async def warm_analysis_cache(self, user_id: int, document_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Warm the analysis cache for frequently accessed documents.

        Args:
            user_id: User ID to warm cache for
            document_ids: Optional list of specific document IDs, or None for all recent docs

        Returns:
            Dictionary with warming results
        """
        if document_ids is None:
            # Get recently updated documents
            recent_docs_query = select(Document).where(
                Document.user_id == user_id
            ).order_by(desc(Document.updated_at)).limit(10)

            result = await self.db.execute(recent_docs_query)
            documents = result.scalars().all()
            document_ids = [doc.id for doc in documents]

        warmed_count = 0
        errors = []

        for doc_id in document_ids:
            try:
                await self.analyze_document_realtime(doc_id, user_id)
                warmed_count += 1
            except Exception as e:
                errors.append(f"Document {doc_id}: {str(e)}")

        return {
            "warmed_documents": warmed_count,
            "total_requested": len(document_ids),
            "errors": errors,
            "cache_size": len(self._analysis_cache)
        }
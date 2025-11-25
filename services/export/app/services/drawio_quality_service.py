"""
Draw.io quality assessment service for evaluating conversion quality.

This service provides:
- Quality scoring algorithms based on structural fidelity, visual quality, and icon success rate
- Heuristics calculations for different quality metrics
- Quality message generation based on score thresholds
- Detailed quality assessment breakdown
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class DrawioQualityInfo:
    """Quality assessment information for Draw.io conversions."""

    def __init__(self, score: float, message: str, details: Dict[str, Any]):
        self.score = score
        self.message = message
        self.details = details
        self.structural_fidelity = details.get('structural_fidelity', 0.0)
        self.visual_quality = details.get('visual_quality', 0.0)
        self.icon_success_rate = details.get('icon_success_rate', 0.0)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "score": self.score,
            "message": self.message,
            "details": self.details,
            "structural_fidelity": self.structural_fidelity,
            "visual_quality": self.visual_quality,
            "icon_success_rate": self.icon_success_rate
        }


class DrawioQualityService:
    """Service for assessing Draw.io conversion quality."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.drawio-quality")

    async def assess_conversion_quality(
        self,
        original_nodes: Dict[str, Any],
        converted_nodes: int,
        original_edges: int,
        converted_edges: int,
        icons_attempted: int,
        icons_successful: int,
        positioning_accuracy: Optional[float] = None
    ) -> DrawioQualityInfo:
        """
        Assess the overall quality of a Draw.io conversion.

        Args:
            original_nodes: Dictionary of original nodes from Mermaid source
            converted_nodes: Number of nodes in the converted Draw.io XML
            original_edges: Number of edges in the original Mermaid
            converted_edges: Number of edges in the converted Draw.io XML
            icons_attempted: Number of icons attempted to fetch
            icons_successful: Number of icons successfully fetched and embedded
            positioning_accuracy: Optional positioning accuracy score (0-100)

        Returns:
            DrawioQualityInfo with comprehensive quality assessment
        """
        try:
            self.logger.info("Starting Draw.io conversion quality assessment")

            # Calculate individual quality components
            structural_fidelity = await self.calculate_structural_fidelity(
                len(original_nodes), converted_nodes, original_edges, converted_edges
            )

            visual_quality = await self.calculate_visual_quality(
                original_nodes, positioning_accuracy
            )

            icon_success_rate = await self.calculate_icon_success_rate(
                icons_attempted, icons_successful
            )

            # Calculate overall score with weighted components
            overall_score = (structural_fidelity * 0.4  # 40% weight for structural preservation
                             + visual_quality * 0.3      # 30% weight for visual quality
                             + icon_success_rate * 0.3)  # 30% weight for icon success

            # Generate quality message
            message = await self.generate_quality_message(overall_score)

            # Prepare detailed breakdown
            details = {
                'structural_fidelity': structural_fidelity,
                'visual_quality': visual_quality,
                'icon_success_rate': icon_success_rate,
                'node_preservation': self._calculate_preservation_rate(len(original_nodes), converted_nodes),
                'edge_preservation': self._calculate_preservation_rate(original_edges, converted_edges),
                'icons_attempted': icons_attempted,
                'icons_successful': icons_successful,
                'positioning_accuracy': positioning_accuracy or 85.0,  # Default assumption
                'conversion_method': 'mermaid_enhanced'
            }

            quality_info = DrawioQualityInfo(
                score=overall_score,
                message=message,
                details=details
            )

            self.logger.info(f"Quality assessment completed: {overall_score:.1f}%")
            return quality_info

        except Exception as e:
            self.logger.error(f"Quality assessment failed: {str(e)}")
            return DrawioQualityInfo(
                score=50.0,
                message="Quality assessment failed - manual review recommended",
                details={"error": str(e)}
            )

    async def calculate_structural_fidelity(
        self,
        original_nodes: int,
        converted_nodes: int,
        original_edges: int,
        converted_edges: int
    ) -> float:
        """
        Calculate structural fidelity based on node and edge preservation.

        Args:
            original_nodes: Number of nodes in original Mermaid
            converted_nodes: Number of nodes in converted Draw.io
            original_edges: Number of edges in original Mermaid
            converted_edges: Number of edges in converted Draw.io

        Returns:
            Structural fidelity score (0-100)
        """
        try:
            # Calculate node preservation rate
            node_preservation = self._calculate_preservation_rate(original_nodes, converted_nodes)

            # Calculate edge preservation rate
            edge_preservation = self._calculate_preservation_rate(original_edges, converted_edges)

            # Weighted average (nodes are slightly more important)
            structural_score = (node_preservation * 0.6) + (edge_preservation * 0.4)

            # Apply penalty only for significant structural loss
            if node_preservation < 70 or edge_preservation < 70:
                structural_score *= 0.85  # 15% penalty for major loss
            elif node_preservation < 85 or edge_preservation < 85:
                structural_score *= 0.95  # 5% penalty for minor loss

            self.logger.debug(f"Structural fidelity: {structural_score:.1f}% "
                              f"(nodes: {node_preservation:.1f}%, edges: {edge_preservation:.1f}%)")

            return min(structural_score, 100.0)

        except Exception as e:
            self.logger.error(f"Failed to calculate structural fidelity: {str(e)}")
            return 50.0

    async def calculate_visual_quality(
        self,
        original_nodes: Dict[str, Any],
        positioning_accuracy: Optional[float] = None
    ) -> float:
        """
        Calculate visual quality based on styling and layout preservation.

        Args:
            original_nodes: Dictionary of original nodes with styling information
            positioning_accuracy: Optional positioning accuracy score

        Returns:
            Visual quality score (0-100)
        """
        try:
            base_score = 90.0  # Higher base visual quality for successful conversions

            # Bonus for nodes with icon information (better visual representation)
            nodes_with_icons = sum(1 for node in original_nodes.values() if node.get('hasIcon', False))
            if nodes_with_icons > 0:
                icon_bonus = min(5.0, (nodes_with_icons / len(original_nodes)) * 8.0)
                base_score += icon_bonus

            # Factor in positioning accuracy if provided, otherwise assume good positioning
            positioning_accuracy = positioning_accuracy or 90.0  # Better default assumption
            position_factor = positioning_accuracy / 100.0
            base_score = base_score * (0.8 + 0.2 * position_factor)  # 80% base, 20% positioning

            # Bonus for having labeled nodes (better than auto-generated IDs)
            if len(original_nodes) > 0:
                labeled_nodes = sum(1 for node in original_nodes.values()
                                    if node.get('label', '') != node.get('id', ''))
                if labeled_nodes > 0:
                    label_bonus = min(3.0, (labeled_nodes / len(original_nodes)) * 5.0)
                    base_score += label_bonus

            visual_score = min(base_score, 100.0)

            self.logger.debug(f"Visual quality: {visual_score:.1f}% "
                              f"(icons: {nodes_with_icons}, labels: {labeled_nodes})")

            return visual_score

        except Exception as e:
            self.logger.error(f"Failed to calculate visual quality: {str(e)}")
            return 75.0

    async def calculate_icon_success_rate(self, icons_attempted: int, icons_successful: int) -> float:
        """
        Calculate icon success rate based on fetching and embedding success.

        Args:
            icons_attempted: Number of icons attempted to fetch
            icons_successful: Number of icons successfully fetched and embedded

        Returns:
            Icon success rate (0-100)
        """
        try:
            if icons_attempted == 0:
                # No icons to process - perfect score
                return 100.0

            success_rate = (icons_successful / icons_attempted) * 100.0

            # Apply bonus for high success rates and penalize low success
            if success_rate >= 95:
                success_rate = min(success_rate + 3.0, 100.0)  # 3% bonus for 95%+ success
            elif success_rate >= 80:
                success_rate = min(success_rate + 1.0, 100.0)  # 1% bonus for 80%+ success
            elif success_rate < 50:
                success_rate *= 0.9  # 10% penalty for low success rate

            self.logger.debug(f"Icon success rate: {success_rate:.1f}% "
                              f"({icons_successful}/{icons_attempted})")

            return success_rate

        except Exception as e:
            self.logger.error(f"Failed to calculate icon success rate: {str(e)}")
            return 50.0

    def _calculate_preservation_rate(self, original_count: int, converted_count: int) -> float:
        """Calculate preservation rate for nodes or edges."""
        if original_count == 0:
            return 100.0 if converted_count == 0 else 0.0

        # Perfect preservation
        if converted_count == original_count:
            return 100.0

        # More elements converted than original (might include auto-generated)
        if converted_count > original_count:
            # Slight penalty for over-generation, but still good
            return min(95.0, (original_count / converted_count) * 100.0)

        # Fewer elements converted (loss of information)
        return (converted_count / original_count) * 100.0

    async def generate_quality_message(self, score: float) -> str:
        """
        Generate human-readable quality message based on score.

        Args:
            score: Quality score (0-100)

        Returns:
            Human-readable quality assessment message
        """
        try:
            if score >= 90:
                return f"Excellent conversion quality ({score:.1f}%) - Ready for immediate use"
            elif score >= 75:
                return f"Good conversion quality ({score:.1f}%) - Minor adjustments may be needed"
            elif score >= 60:
                return f"Fair conversion quality ({score:.1f}%) - Review recommended"
            else:
                return f"Poor conversion quality ({score:.1f}%) - Consider alternative formats"

        except Exception as e:
            self.logger.error(f"Failed to generate quality message: {str(e)}")
            return f"Quality assessment completed ({score:.1f}%) - Manual review recommended"

    async def validate_quality_threshold(self, quality_info: DrawioQualityInfo, threshold: float = 60.0) -> bool:
        """
        Validate if quality meets the minimum threshold.

        Args:
            quality_info: Quality assessment information
            threshold: Minimum quality threshold (default: 60.0)

        Returns:
            True if quality meets threshold, False otherwise
        """
        try:
            meets_threshold = quality_info.score >= threshold

            if not meets_threshold:
                self.logger.warning(f"Quality score {quality_info.score:.1f}% below threshold {threshold}%")
            else:
                self.logger.info(f"Quality score {quality_info.score:.1f}% meets threshold {threshold}%")

            return meets_threshold

        except Exception as e:
            self.logger.error(f"Failed to validate quality threshold: {str(e)}")
            return False

    async def get_quality_recommendations(self, quality_info: DrawioQualityInfo) -> Dict[str, Any]:
        """
        Get recommendations for improving conversion quality.

        Args:
            quality_info: Quality assessment information

        Returns:
            Dictionary with improvement recommendations
        """
        try:
            recommendations = {
                "overall_score": quality_info.score,
                "recommendations": []
            }

            # Structural fidelity recommendations
            if quality_info.structural_fidelity < 80:
                recommendations["recommendations"].append({
                    "category": "structural",
                    "issue": "Low structural fidelity",
                    "suggestion": "Check Mermaid syntax for missing nodes or edges",
                    "priority": "high"
                })

            # Visual quality recommendations
            if quality_info.visual_quality < 75:
                recommendations["recommendations"].append({
                    "category": "visual",
                    "issue": "Visual quality could be improved",
                    "suggestion": "Consider adding more descriptive labels or styling",
                    "priority": "medium"
                })

            # Icon success rate recommendations
            if quality_info.icon_success_rate < 80:
                recommendations["recommendations"].append({
                    "category": "icons",
                    "issue": "Icon fetching issues detected",
                    "suggestion": "Verify icon service URL and icon references",
                    "priority": "medium"
                })

            # Overall quality recommendations
            if quality_info.score < 60:
                recommendations["recommendations"].append({
                    "category": "general",
                    "issue": "Overall quality below acceptable threshold",
                    "suggestion": "Consider using alternative export format or reviewing source diagram",
                    "priority": "high"
                })

            return recommendations

        except Exception as e:
            self.logger.error(f"Failed to generate quality recommendations: {str(e)}")
            return {
                "overall_score": quality_info.score,
                "recommendations": [{
                    "category": "error",
                    "issue": "Could not generate recommendations",
                    "suggestion": "Manual review recommended",
                    "priority": "high"
                }]
            }


# Global service instance
drawio_quality_service = DrawioQualityService()

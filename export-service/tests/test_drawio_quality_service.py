"""Tests for DrawioQualityService - Quality assessment and scoring logic."""

import pytest
from unittest.mock import MagicMock

from app.services.drawio_quality_service import DrawioQualityService, DrawioQualityInfo
from tests.fixtures.test_data import QUALITY_TEST_CASES, EXPECTED_TEST_RESULTS


class TestDrawioQualityService:
    """Test cases for DrawioQualityService."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assess_conversion_quality_perfect(self, drawio_quality_service):
        """Test quality assessment for perfect conversion."""
        test_case = next(tc for tc in QUALITY_TEST_CASES if tc["name"] == "perfect_conversion")

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes=test_case["original_nodes"],
            converted_nodes=test_case["converted_nodes"],
            original_edges=test_case["original_edges"],
            converted_edges=test_case["converted_edges"],
            icons_attempted=test_case["icons_attempted"],
            icons_successful=test_case["icons_successful"]
        )

        # Verify perfect score range
        min_score, max_score = test_case["expected_score_range"]
        assert min_score <= quality_info.score <= max_score
        assert quality_info.score >= EXPECTED_TEST_RESULTS["quality_thresholds"]["excellent"]

        # Verify quality message
        assert "excellent" in quality_info.message.lower()

        # Verify component scores
        assert quality_info.structural_fidelity >= 90
        assert quality_info.visual_quality >= 80
        assert quality_info.icon_success_rate >= 90

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assess_conversion_quality_good(self, drawio_quality_service):
        """Test quality assessment for good conversion."""
        test_case = next(tc for tc in QUALITY_TEST_CASES if tc["name"] == "good_conversion")

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes=test_case["original_nodes"],
            converted_nodes=test_case["converted_nodes"],
            original_edges=test_case["original_edges"],
            converted_edges=test_case["converted_edges"],
            icons_attempted=test_case["icons_attempted"],
            icons_successful=test_case["icons_successful"]
        )

        # Verify good score range
        min_score, max_score = test_case["expected_score_range"]
        assert min_score <= quality_info.score <= max_score

        # Verify quality message
        assert "good" in quality_info.message.lower()

        # Verify component scores are reasonable
        assert quality_info.structural_fidelity > 70
        assert quality_info.visual_quality > 60
        assert quality_info.icon_success_rate > 50

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assess_conversion_quality_fair(self, drawio_quality_service):
        """Test quality assessment for fair conversion."""
        test_case = next(tc for tc in QUALITY_TEST_CASES if tc["name"] == "fair_conversion")

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes=test_case["original_nodes"],
            converted_nodes=test_case["converted_nodes"],
            original_edges=test_case["original_edges"],
            converted_edges=test_case["converted_edges"],
            icons_attempted=test_case["icons_attempted"],
            icons_successful=test_case["icons_successful"]
        )

        # Verify fair score range
        min_score, max_score = test_case["expected_score_range"]
        assert min_score <= quality_info.score <= max_score

        # Verify quality message suggests review
        assert any(word in quality_info.message.lower() for word in ["fair", "review", "consider"])

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_assess_conversion_quality_poor(self, drawio_quality_service):
        """Test quality assessment for poor conversion."""
        test_case = next(tc for tc in QUALITY_TEST_CASES if tc["name"] == "poor_conversion")

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes=test_case["original_nodes"],
            converted_nodes=test_case["converted_nodes"],
            original_edges=test_case["original_edges"],
            converted_edges=test_case["converted_edges"],
            icons_attempted=test_case["icons_attempted"],
            icons_successful=test_case["icons_successful"]
        )

        # Verify poor score range
        min_score, max_score = test_case["expected_score_range"]
        assert min_score <= quality_info.score <= max_score
        assert quality_info.score < EXPECTED_TEST_RESULTS["quality_thresholds"]["fair"]

        # Verify quality message indicates poor quality
        assert any(word in quality_info.message.lower() for word in ["poor", "alternative", "consider"])

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_structural_fidelity_perfect(self, drawio_quality_service):
        """Test structural fidelity calculation for perfect preservation."""
        original_nodes = 4  # Changed to integer
        converted_nodes = 4
        original_edges = 3
        converted_edges = 3

        fidelity = await drawio_quality_service.calculate_structural_fidelity(
            original_nodes, converted_nodes, original_edges, converted_edges
        )

        # Perfect preservation should score 100%
        assert fidelity == 100.0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_structural_fidelity_partial_loss(self, drawio_quality_service):
        """Test structural fidelity calculation with partial data loss."""
        original_nodes = 5  # Changed to integer
        converted_nodes = 4  # Missing one node
        original_edges = 4
        converted_edges = 3  # Missing one edge

        fidelity = await drawio_quality_service.calculate_structural_fidelity(
            original_nodes, converted_nodes, original_edges, converted_edges
        )

        # Should be less than 100% due to missing elements
        assert 70 <= fidelity < 100

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_structural_fidelity_zero_original(self, drawio_quality_service):
        """Test structural fidelity calculation with zero original elements."""
        original_nodes = 0  # Changed to integer
        converted_nodes = 0
        original_edges = 0
        converted_edges = 0

        fidelity = await drawio_quality_service.calculate_structural_fidelity(
            original_nodes, converted_nodes, original_edges, converted_edges
        )

        # Should handle zero case gracefully
        assert fidelity == 100.0  # Perfect preservation of nothing

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_visual_quality_high(self, drawio_quality_service):
        """Test visual quality calculation for high quality conversion."""
        original_nodes = {
            "node1": {"id": "A", "label": "Start", "hasIcon": True},
            "node2": {"id": "B", "label": "Process", "hasIcon": True},
            "node3": {"id": "C", "label": "End", "hasIcon": False}
        }
        positioning_accuracy = 95.0

        visual_quality = await drawio_quality_service.calculate_visual_quality(
            original_nodes, positioning_accuracy
        )

        # High input values should produce high visual quality
        assert visual_quality >= 85

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_visual_quality_low(self, drawio_quality_service):
        """Test visual quality calculation for low quality conversion."""
        original_nodes = {
            "node1": {"id": "auto-1", "hasIcon": False},
            "node2": {"id": "auto-2", "hasIcon": False}
        }
        positioning_accuracy = 30.0

        visual_quality = await drawio_quality_service.calculate_visual_quality(
            original_nodes, positioning_accuracy
        )

        # Low input values should produce lower visual quality
        assert visual_quality <= 75

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_icon_success_rate_perfect(self, drawio_quality_service):
        """Test icon success rate calculation for perfect icon fetching."""
        icons_attempted = 5
        icons_successful = 5

        success_rate = await drawio_quality_service.calculate_icon_success_rate(
            icons_attempted, icons_successful
        )

        # Perfect success should be 100%
        assert success_rate == 100.0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_icon_success_rate_partial(self, drawio_quality_service):
        """Test icon success rate calculation for partial success."""
        icons_attempted = 10
        icons_successful = 6

        success_rate = await drawio_quality_service.calculate_icon_success_rate(
            icons_attempted, icons_successful
        )

        # Should be 60%
        assert success_rate == 60.0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_icon_success_rate_zero_attempted(self, drawio_quality_service):
        """Test icon success rate calculation with no icons attempted."""
        icons_attempted = 0
        icons_successful = 0

        success_rate = await drawio_quality_service.calculate_icon_success_rate(
            icons_attempted, icons_successful
        )

        # No icons attempted should be treated as perfect (100%)
        assert success_rate == 100.0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_calculate_icon_success_rate_over_successful(self, drawio_quality_service):
        """Test icon success rate calculation with more successful than attempted."""
        icons_attempted = 3
        icons_successful = 5  # This shouldn't happen, but test robustness

        success_rate = await drawio_quality_service.calculate_icon_success_rate(
            icons_attempted, icons_successful
        )

        # Should cap at 100%
        assert success_rate == 100.0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_quality_message_excellent(self, drawio_quality_service):
        """Test quality message generation for excellent scores."""
        message = await drawio_quality_service.generate_quality_message(95.0)

        assert "excellent" in message.lower()
        assert "ready" in message.lower()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_quality_message_good(self, drawio_quality_service):
        """Test quality message generation for good scores."""
        message = await drawio_quality_service.generate_quality_message(80.0)

        assert "good" in message.lower()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_quality_message_fair(self, drawio_quality_service):
        """Test quality message generation for fair scores."""
        message = await drawio_quality_service.generate_quality_message(65.0)

        assert "fair" in message.lower()
        assert "review" in message.lower()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_generate_quality_message_poor(self, drawio_quality_service):
        """Test quality message generation for poor scores."""
        message = await drawio_quality_service.generate_quality_message(40.0)

        assert "poor" in message.lower()
        assert any(word in message.lower() for word in ["alternative", "consider"])

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_quality_info_to_dict(self, drawio_quality_service):
        """Test DrawioQualityInfo to_dict conversion."""
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={"A": {}, "B": {}},
            converted_nodes=2,
            original_edges=1,
            converted_edges=1,
            icons_attempted=1,
            icons_successful=1
        )

        quality_dict = quality_info.to_dict()

        # Verify all required fields are present
        required_fields = [
            "score", "message", "details", "structural_fidelity",
            "visual_quality", "icon_success_rate"
        ]

        for field in required_fields:
            assert field in quality_dict

        # Verify data types
        assert isinstance(quality_dict["score"], float)
        assert isinstance(quality_dict["message"], str)
        assert isinstance(quality_dict["details"], dict)
        assert isinstance(quality_dict["structural_fidelity"], float)
        assert isinstance(quality_dict["visual_quality"], float)
        assert isinstance(quality_dict["icon_success_rate"], float)

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_detailed_quality_breakdown(self, drawio_quality_service):
        """Test detailed quality breakdown in assessment."""
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={"A": {}, "B": {}, "C": {}},
            converted_nodes=3,
            original_edges=2,
            converted_edges=2,
            icons_attempted=2,
            icons_successful=1
        )

        # Verify detailed breakdown is provided
        assert "details" in quality_info.to_dict()
        details = quality_info.details

        # Verify breakdown components
        expected_detail_keys = [
            "structural_fidelity", "visual_quality", "icon_success_rate",
            "node_preservation", "edge_preservation", "icons_attempted",
            "icons_successful", "positioning_accuracy", "conversion_method"
        ]

        for key in expected_detail_keys:
            assert key in details

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_weighted_scoring_algorithm(self, drawio_quality_service):
        """Test the weighted scoring algorithm components."""
        # Test with known values to verify weighting
        original_nodes = {"A": {}, "B": {}, "C": {}, "D": {}}
        converted_nodes = 4
        original_edges = 3
        converted_edges = 3
        icons_attempted = 2
        icons_successful = 2

        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes, converted_nodes, original_edges,
            converted_edges, icons_attempted, icons_successful
        )

        # Verify individual components are calculated
        assert quality_info.structural_fidelity > 0
        assert quality_info.visual_quality > 0
        assert quality_info.icon_success_rate > 0

        # Verify overall score is weighted combination
        # Formula: (structural * 0.4) + (visual * 0.3) + (icon * 0.3)
        expected_score = (
            quality_info.structural_fidelity * 0.4 +
            quality_info.visual_quality * 0.3 +
            quality_info.icon_success_rate * 0.3
        )

        # Allow small floating point differences
        assert abs(quality_info.score - expected_score) < 0.1

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_edge_cases_handling(self, drawio_quality_service):
        """Test edge cases in quality assessment."""
        # Test with negative values (should be handled gracefully)
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={},
            converted_nodes=-1,  # Invalid negative value
            original_edges=0,
            converted_edges=0,
            icons_attempted=0,
            icons_successful=0
        )
        assert quality_info.score >= 0  # Should return some valid score

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_quality_consistency(self, drawio_quality_service):
        """Test that quality assessment is consistent for same inputs."""
        # Run same assessment multiple times
        results = []
        for _ in range(5):
            quality_info = await drawio_quality_service.assess_conversion_quality(
                original_nodes={"A": {}, "B": {}, "C": {}},
                converted_nodes=3,
                original_edges=2,
                converted_edges=2,
                icons_attempted=1,
                icons_successful=1
            )
            results.append(quality_info.score)

        # All results should be identical
        assert all(score == results[0] for score in results)

    @pytest.mark.unit
    def test_service_initialization(self, drawio_quality_service):
        """Test service initialization and configuration."""
        assert drawio_quality_service is not None
        assert hasattr(drawio_quality_service, 'logger')
        assert drawio_quality_service.logger.name == "export-service.drawio-quality"

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_quality_threshold_compliance(self, drawio_quality_service, sample_environment):
        """Test quality assessment against configured thresholds."""
        # Test with threshold from environment
        threshold = float(sample_environment["DRAWIO_QUALITY_THRESHOLD"])

        # Test case that should meet threshold
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={"A": {}, "B": {}, "C": {}},
            converted_nodes=3,
            original_edges=2,
            converted_edges=2,
            icons_attempted=2,
            icons_successful=2
        )

        # Verify quality assessment includes threshold compliance
        assert quality_info.score >= 0  # Basic validation

        # Quality message should reflect threshold compliance
        if quality_info.score >= threshold:
            assert "acceptable" in quality_info.message.lower() or "good" in quality_info.message.lower() or "excellent" in quality_info.message.lower()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_performance_quality_assessment(self, drawio_quality_service, performance_timer):
        """Test performance of quality assessment calculations."""
        performance_timer.start()

        # Run assessment on reasonably complex case
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={f"N{i}": {} for i in range(50)},  # 50 nodes
            converted_nodes=50,
            original_edges=49,  # Chain of connections
            converted_edges=49,
            icons_attempted=10,
            icons_successful=8
        )

        performance_timer.stop()

        # Verify assessment completed quickly (should be near-instantaneous)
        assert performance_timer.elapsed < 1.0  # Less than 1 second
        assert quality_info is not None
        assert quality_info.score >= 0
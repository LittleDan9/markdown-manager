"""Tests for DiagramTypeDetector."""

from app.services.diagram_converters.diagram_detector import DiagramTypeDetector, DiagramType
from tests.fixtures.phase1_test_data import (
    FLOWCHART_DIAGRAM,
    ARCHITECTURE_DIAGRAM,
    UNKNOWN_DIAGRAM,
    SIMPLE_ARROW_DIAGRAM
)


class TestDiagramTypeDetector:
    """Test cases for diagram type detection."""

    def test_detect_flowchart_diagram(self):
        """Test detection of flowchart diagrams."""
        diagram_type = DiagramTypeDetector.detect_diagram_type(FLOWCHART_DIAGRAM)
        assert diagram_type == DiagramType.FLOWCHART

    def test_detect_architecture_diagram(self):
        """Test detection of architecture diagrams."""
        diagram_type = DiagramTypeDetector.detect_diagram_type(ARCHITECTURE_DIAGRAM)
        assert diagram_type == DiagramType.ARCHITECTURE

    def test_detect_unknown_diagram(self):
        """Test detection of unknown diagram types."""
        diagram_type = DiagramTypeDetector.detect_diagram_type(UNKNOWN_DIAGRAM)
        assert diagram_type == DiagramType.DEFAULT

    def test_detect_simple_arrow_diagram(self):
        """Test detection of simple arrow diagrams."""
        diagram_type = DiagramTypeDetector.detect_diagram_type(SIMPLE_ARROW_DIAGRAM)
        assert diagram_type == DiagramType.DEFAULT

    def test_detect_empty_diagram(self):
        """Test detection of empty diagrams."""
        diagram_type = DiagramTypeDetector.detect_diagram_type("")
        assert diagram_type == DiagramType.DEFAULT

    def test_get_diagram_info_flowchart(self):
        """Test getting detailed diagram info for flowchart."""
        info = DiagramTypeDetector.get_diagram_info(FLOWCHART_DIAGRAM)

        assert info["type"] == DiagramType.FLOWCHART
        assert info["type_name"] == "flowchart"
        assert isinstance(info["source_length"], int) and info["source_length"] > 0
        assert isinstance(info["normalized_length"], int) and info["normalized_length"] > 0
        assert isinstance(info["confidence"], float) and 0.5 <= info["confidence"] <= 1.0

    def test_get_diagram_info_architecture(self):
        """Test getting detailed diagram info for architecture."""
        info = DiagramTypeDetector.get_diagram_info(ARCHITECTURE_DIAGRAM)

        assert info["type"] == DiagramType.ARCHITECTURE
        assert info["type_name"] == "architecture"
        assert isinstance(info["confidence"], float) and info["confidence"] >= 0.6

    def test_get_diagram_info_default(self):
        """Test getting detailed diagram info for unknown types."""
        info = DiagramTypeDetector.get_diagram_info(UNKNOWN_DIAGRAM)

        assert info["type"] == DiagramType.DEFAULT
        assert info["type_name"] == "default"
        assert info["confidence"] == 0.5

    def test_normalize_source_removes_comments(self):
        """Test that source normalization removes comments."""
        source_with_comments = """
        flowchart TD
            %% This is a comment
            A --> B  %% Another comment
            B --> C
        """

        normalized = DiagramTypeDetector._normalize_source(source_with_comments)
        assert "%%" not in normalized
        assert "flowchart TD" in normalized
        assert "A --> B" in normalized

    def test_matches_patterns(self):
        """Test pattern matching functionality."""
        patterns = [r'^\s*flowchart\s+', r'^\s*graph\s+']

        assert DiagramTypeDetector._matches_patterns("flowchart TD", patterns)
        assert DiagramTypeDetector._matches_patterns("graph LR", patterns)
        assert not DiagramTypeDetector._matches_patterns("sequence", patterns)

    def test_calculate_confidence(self):
        """Test confidence calculation."""
        # High confidence for architecture with multiple matches
        arch_confidence = DiagramTypeDetector._calculate_confidence(
            ARCHITECTURE_DIAGRAM, DiagramType.ARCHITECTURE
        )
        assert arch_confidence > 0.6

        # Medium confidence for default
        default_confidence = DiagramTypeDetector._calculate_confidence(
            UNKNOWN_DIAGRAM, DiagramType.DEFAULT
        )
        assert default_confidence == 0.5

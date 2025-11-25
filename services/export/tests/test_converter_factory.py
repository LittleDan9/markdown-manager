"""Tests for MermaidConverterFactory."""

from app.services.diagram_converters.converter_factory import MermaidConverterFactory
from app.services.diagram_converters.diagram_detector import DiagramType
from app.services.diagram_converters.flowchart_converter import FlowchartMermaidConverter
from app.services.diagram_converters.default_converter import DefaultMermaidConverter
from app.services.diagram_converters.architecture_converter import ArchitectureMermaidConverter
from tests.fixtures.phase1_test_data import (
    FLOWCHART_DIAGRAM,
    ARCHITECTURE_DIAGRAM,
    UNKNOWN_DIAGRAM
)


class TestMermaidConverterFactory:
    """Test cases for converter factory."""

    def test_create_converter_for_flowchart(self):
        """Test that flowchart converter is created for flowchart diagrams."""
        converter = MermaidConverterFactory.create_converter(FLOWCHART_DIAGRAM)
        assert isinstance(converter, FlowchartMermaidConverter)

    def test_create_converter_for_architecture(self):
        """Test that architecture converter is created for architecture diagrams."""
        converter = MermaidConverterFactory.create_converter(ARCHITECTURE_DIAGRAM)
        # Phase 2A: Architecture converter now implemented
        assert isinstance(converter, ArchitectureMermaidConverter)

    def test_create_converter_for_unknown(self):
        """Test that default converter is created for unknown diagrams."""
        converter = MermaidConverterFactory.create_converter(UNKNOWN_DIAGRAM)
        assert isinstance(converter, DefaultMermaidConverter)

    def test_get_converter_by_type_flowchart(self):
        """Test getting converter by specific type."""
        converter = MermaidConverterFactory.get_converter_by_type(DiagramType.FLOWCHART)
        assert isinstance(converter, FlowchartMermaidConverter)

    def test_get_converter_by_type_default(self):
        """Test getting default converter by type."""
        converter = MermaidConverterFactory.get_converter_by_type(DiagramType.DEFAULT)
        assert isinstance(converter, DefaultMermaidConverter)

    def test_get_supported_types(self):
        """Test getting list of supported types."""
        supported_types = MermaidConverterFactory.get_supported_types()
        assert DiagramType.FLOWCHART in supported_types
        assert DiagramType.DEFAULT in supported_types
        assert len(supported_types) >= 2

    def test_register_converter(self):
        """Test registering a new converter type."""
        # Save original registry
        original_converters = MermaidConverterFactory._CONVERTERS.copy()

        try:
            # Register a test converter
            class TestConverter(DefaultMermaidConverter):
                pass

            MermaidConverterFactory.register_converter(DiagramType.ARCHITECTURE, TestConverter)

            # Test that it was registered
            converter = MermaidConverterFactory.get_converter_by_type(DiagramType.ARCHITECTURE)
            assert isinstance(converter, TestConverter)

        finally:
            # Restore original registry
            MermaidConverterFactory._CONVERTERS = original_converters

    def test_fallback_to_default_for_unregistered_type(self):
        """Test that unregistered types fall back to default converter."""
        # Save original registry
        original_converters = MermaidConverterFactory._CONVERTERS.copy()

        try:
            # Clear the registry temporarily
            MermaidConverterFactory._CONVERTERS = {}

            # Should fall back to default
            converter = MermaidConverterFactory.get_converter_by_type(DiagramType.FLOWCHART)
            assert isinstance(converter, DefaultMermaidConverter)

        finally:
            # Restore original registry
            MermaidConverterFactory._CONVERTERS = original_converters

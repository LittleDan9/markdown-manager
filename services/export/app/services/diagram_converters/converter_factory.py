"""Factory for creating appropriate Mermaid converters."""

from typing import Dict, Type
from .base_converter import BaseMermaidConverter
from .diagram_detector import DiagramType, DiagramTypeDetector
from .default_converter import DefaultMermaidConverter
from .flowchart_converter import FlowchartMermaidConverter
from .architecture_converter import ArchitectureMermaidConverter


class MermaidConverterFactory:
    """Factory class for creating appropriate Mermaid converters."""

    # Registry of available converters
    _CONVERTERS: Dict[DiagramType, Type[BaseMermaidConverter]] = {
        DiagramType.FLOWCHART: FlowchartMermaidConverter,
        DiagramType.ARCHITECTURE: ArchitectureMermaidConverter,  # Phase 2A: Architecture converter
        DiagramType.DEFAULT: DefaultMermaidConverter,
    }

    @classmethod
    def create_converter(cls, mermaid_source: str) -> BaseMermaidConverter:
        """
        Create appropriate converter based on Mermaid source.

        Args:
            mermaid_source: Raw Mermaid source code

        Returns:
            Appropriate converter instance
        """
        # Detect diagram type
        diagram_type = DiagramTypeDetector.detect_diagram_type(mermaid_source)

        # Get converter class (fallback to default if not found)
        converter_class = cls._CONVERTERS.get(diagram_type, DefaultMermaidConverter)

        # Create and return instance
        return converter_class()

    @classmethod
    def get_converter_by_type(cls, diagram_type: DiagramType) -> BaseMermaidConverter:
        """
        Create converter for specific diagram type.

        Args:
            diagram_type: DiagramType enum value

        Returns:
            Appropriate converter instance
        """
        converter_class = cls._CONVERTERS.get(diagram_type, DefaultMermaidConverter)
        return converter_class()

    @classmethod
    def register_converter(cls, diagram_type: DiagramType, converter_class: Type[BaseMermaidConverter]):
        """
        Register a new converter type.

        Args:
            diagram_type: DiagramType enum value
            converter_class: Converter class to register
        """
        cls._CONVERTERS[diagram_type] = converter_class

    @classmethod
    def get_supported_types(cls) -> list[DiagramType]:
        """Get list of supported diagram types."""
        return list(cls._CONVERTERS.keys())

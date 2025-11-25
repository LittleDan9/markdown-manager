"""
Diagram converters package for multi-algorithm Mermaid to Draw.io conversion.

This package provides:
- Diagram type detection
- Factory pattern for converter selection
- Base converter class with shared functionality
- Specialized converters for different diagram types
"""

from .diagram_detector import DiagramType, DiagramTypeDetector
from .converter_factory import MermaidConverterFactory
from .base_converter import BaseMermaidConverter

__all__ = [
    'DiagramType',
    'DiagramTypeDetector',
    'MermaidConverterFactory',
    'BaseMermaidConverter'
]
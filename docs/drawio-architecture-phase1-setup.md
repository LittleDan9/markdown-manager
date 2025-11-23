# Phase 1: Architecture Setup & Foundation

## Overview
Establish the multi-algorithm architecture foundation for Mermaid to Draw.io conversion. This phase creates the base converter infrastructure, diagram type detection, and factory pattern while maintaining full backward compatibility.

## 🎯 Phase Objectives
- Create base converter class with shared functionality
- Implement smart diagram type detection
- Set up factory pattern for algorithm selection
- Refactor existing code into flowchart converter
- Maintain 100% backward compatibility

## 🏗️ Architecture Overview

### Current State
- Single `MermaidDrawioService` handles all diagram types
- Hardcoded flowchart-specific logic throughout
- No diagram type detection or algorithm selection

### Target State
```
MermaidDrawioService (Orchestrator)
├── DiagramTypeDetector
├── MermaidConverterFactory
└── Converters/
    ├── BaseMermaidConverter (Abstract)
    ├── FlowchartMermaidConverter (Current logic)
    ├── ArchitectureMermaidConverter (Phase 2)
    └── DefaultMermaidConverter (Fallback)
```

## 📁 File Structure Changes

### New Files to Create
```
export-service/app/services/diagram_converters/
├── __init__.py
├── base_converter.py          # Abstract base class
├── diagram_detector.py        # Type detection logic
├── converter_factory.py       # Factory pattern
├── flowchart_converter.py     # Existing logic refactored
└── default_converter.py       # Fallback implementation
```

### Files to Modify
```
export-service/app/services/mermaid_drawio_service.py  # Orchestrator refactor
```

## 🔧 Implementation Details

### 1. Diagram Type Detection (`diagram_detector.py`)

```python
"""Diagram type detection for Mermaid source code."""

import re
from typing import Dict, List, Optional
from enum import Enum

class DiagramType(Enum):
    """Supported Mermaid diagram types."""
    ARCHITECTURE = "architecture"
    FLOWCHART = "flowchart"
    DEFAULT = "default"

class DiagramTypeDetector:
    """Detects Mermaid diagram type from source code."""

    # Detection patterns ordered by specificity
    DETECTION_PATTERNS = {
        DiagramType.ARCHITECTURE: [
            r'^\s*architecture(-beta)?',  # architecture-beta
            r'\bservice\s+\w+',          # service definitions
            r'\bgroup\s+\w+',            # group definitions
            r'\bjunction\s+\w+',         # junction definitions
        ],
        DiagramType.FLOWCHART: [
            r'^\s*(graph|flowchart)',    # graph TD, flowchart TD
            r'^\s*graph\s+(TD|TB|BT|RL|LR)', # directed graphs
        ]
    }

    @classmethod
    def detect_diagram_type(cls, mermaid_source: str) -> DiagramType:
        """
        Detect diagram type from Mermaid source code.

        Args:
            mermaid_source: Raw Mermaid source code

        Returns:
            DiagramType enum value
        """
        if not mermaid_source or not mermaid_source.strip():
            return DiagramType.DEFAULT

        # Normalize source: remove comments, extra whitespace
        normalized = cls._normalize_source(mermaid_source)

        # Check patterns in order of specificity
        for diagram_type, patterns in cls.DETECTION_PATTERNS.items():
            if cls._matches_patterns(normalized, patterns):
                return diagram_type

        return DiagramType.DEFAULT

    @staticmethod
    def _normalize_source(source: str) -> str:
        """Remove comments and normalize whitespace."""
        # Remove Mermaid comments (lines starting with %%)
        lines = []
        for line in source.split('\n'):
            # Remove comment portion
            comment_pos = line.find('%%')
            if comment_pos >= 0:
                line = line[:comment_pos]
            line = line.strip()
            if line:
                lines.append(line)

        return '\n'.join(lines)

    @staticmethod
    def _matches_patterns(normalized_source: str, patterns: List[str]) -> bool:
        """Check if source matches any of the given patterns."""
        for pattern in patterns:
            if re.search(pattern, normalized_source, re.MULTILINE | re.IGNORECASE):
                return True
        return False

    @classmethod
    def get_diagram_info(cls, mermaid_source: str) -> Dict[str, any]:
        """
        Get detailed diagram information.

        Returns:
            Dictionary with diagram type and metadata
        """
        diagram_type = cls.detect_diagram_type(mermaid_source)

        return {
            "type": diagram_type,
            "type_name": diagram_type.value,
            "source_length": len(mermaid_source),
            "normalized_length": len(cls._normalize_source(mermaid_source)),
            "confidence": cls._calculate_confidence(mermaid_source, diagram_type)
        }

    @classmethod
    def _calculate_confidence(cls, source: str, detected_type: DiagramType) -> float:
        """Calculate confidence score for detection (0.0 to 1.0)."""
        if detected_type == DiagramType.DEFAULT:
            return 0.5  # Medium confidence for fallback

        normalized = cls._normalize_source(source)
        patterns = cls.DETECTION_PATTERNS.get(detected_type, [])

        matches = sum(1 for pattern in patterns
                     if re.search(pattern, normalized, re.MULTILINE | re.IGNORECASE))

        return min(1.0, 0.6 + (matches * 0.2))  # 60% base + 20% per match
```

### 2. Base Converter (`base_converter.py`)

```python
"""Base converter class for Mermaid to Draw.io conversion."""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any
from xml.etree import ElementTree as ET

class BaseMermaidConverter(ABC):
    """Abstract base class for Mermaid diagram converters."""

    def __init__(self):
        self.logger = logging.getLogger(f"export-service.{self.__class__.__name__.lower()}")

    # Abstract methods that each converter must implement
    @abstractmethod
    async def parse_mermaid_source(self, mermaid_content: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parse Mermaid source to extract nodes and edges.

        Args:
            mermaid_content: Raw Mermaid source code

        Returns:
            Tuple of (nodes_dict, edges_list)
        """
        pass

    @abstractmethod
    async def extract_svg_positions(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """
        Extract positioning information from rendered SVG.

        Args:
            svg_content: Rendered SVG content

        Returns:
            Dictionary mapping node IDs to position/size info
        """
        pass

    # Shared utility methods available to all converters
    async def convert_to_drawio_xml(
        self,
        mermaid_source: str,
        svg_content: str,
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600,
        is_dark_mode: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Convert Mermaid content to Draw.io XML format.

        This is the main entry point that orchestrates the conversion process.
        """
        try:
            self.logger.info(f"Starting conversion with {self.__class__.__name__}")

            # Step 1: Parse Mermaid source
            nodes, edges = await self.parse_mermaid_source(mermaid_source)
            self.logger.info(f"Parsed {len(nodes)} nodes and {len(edges)} edges")

            # Step 2: Extract SVG positions
            positions = await self.extract_svg_positions(svg_content)
            self.logger.info(f"Extracted positions for {len(positions)} nodes")

            # Step 3: Build Draw.io XML
            drawio_xml, metadata = await self.build_drawio_xml(
                nodes, edges, positions, icon_service_url, width, height
            )

            # Step 4: Prepare final metadata
            final_metadata = {
                "converter_type": self.__class__.__name__,
                "nodes_parsed": len(nodes),
                "edges_parsed": len(edges),
                "positions_found": len(positions),
                "canvas_width": width,
                "canvas_height": height,
                "icon_service_url": icon_service_url,
                "dark_mode": is_dark_mode,
                **metadata
            }

            self.logger.info("Conversion completed successfully")
            return drawio_xml, final_metadata

        except Exception as e:
            self.logger.error(f"Conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert with {self.__class__.__name__}: {str(e)}")

    # Shared helper methods
    def _parse_transform_translate(self, transform_str: str) -> Tuple[float, float]:
        """Parse SVG transform attribute to extract translation."""
        if not transform_str:
            return (0.0, 0.0)

        import re
        match = re.search(r'translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', transform_str)
        return (float(match.group(1)), float(match.group(2))) if match else (0.0, 0.0)

    def _get_rect_size(self, node_g: ET.Element) -> Tuple[float, float, float, float]:
        """Get rectangle size and position from SVG node group."""
        # Look for rect with specific class first
        rect = node_g.find(".//{http://www.w3.org/2000/svg}rect[@class='basic label-container']")

        if rect is None:
            # Look for any rect element
            rects = node_g.findall('.//{http://www.w3.org/2000/svg}rect')
            for r in rects:
                if r.get('width') and r.get('height'):
                    rect = r
                    break

        if rect is not None:
            try:
                w = float(rect.get('width', '80'))
                h = float(rect.get('height', '50'))
                x = float(rect.get('x', '0'))
                y = float(rect.get('y', '0'))
                return w, h, x, y
            except (ValueError, TypeError):
                pass

        # Default size
        return 80.0, 80.0, -40.0, -40.0

    async def build_drawio_xml(
        self,
        nodes: Dict[str, Any],
        edges: List[Dict[str, Any]],
        positions: Dict[str, Dict[str, float]],
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600
    ) -> Tuple[str, Dict[str, Any]]:
        """Build Draw.io XML using parsed nodes, edges, and positions."""
        try:
            # Import shared utilities
            from .shared_utils import XMLBuilder, IconService

            xml_builder = XMLBuilder(width, height)
            icon_service = IconService(icon_service_url) if icon_service_url else None

            # Track conversion statistics
            stats = {
                "nodes_converted": 0,
                "edges_converted": 0,
                "icons_attempted": 0,
                "icons_successful": 0
            }

            # Create nodes
            for node_id, node_info in nodes.items():
                position = positions.get(node_id, {"x": 100 + stats["nodes_converted"] * 150, "y": 100, "w": 80, "h": 50})

                # Handle icons if available
                icon_data = None
                if node_info.get("hasIcon") and node_info.get("icon") and icon_service:
                    stats["icons_attempted"] += 1
                    icon_data = await icon_service.fetch_icon_svg(node_info["icon"])
                    if icon_data:
                        stats["icons_successful"] += 1

                xml_builder.add_node(node_id, node_info["label"], position, icon_data)
                stats["nodes_converted"] += 1

            # Create edges
            for edge in edges:
                xml_builder.add_edge(edge["source"], edge["target"], edge.get("dashed", False))
                stats["edges_converted"] += 1

            # Generate final XML
            drawio_xml = xml_builder.build_xml()

            # Calculate success rates
            stats["icon_success_rate"] = (
                (stats["icons_successful"] / stats["icons_attempted"] * 100)
                if stats["icons_attempted"] > 0 else 100.0
            )

            return drawio_xml, stats

        except Exception as e:
            self.logger.error(f"Failed to build Draw.io XML: {str(e)}")
            raise ValueError(f"Failed to build Draw.io XML: {str(e)}")
```

### 3. Converter Factory (`converter_factory.py`)

```python
"""Factory for creating appropriate Mermaid converters."""

from typing import Dict, Type
from .base_converter import BaseMermaidConverter
from .diagram_detector import DiagramType, DiagramTypeDetector
from .flowchart_converter import FlowchartMermaidConverter
from .default_converter import DefaultMermaidConverter

class MermaidConverterFactory:
    """Factory class for creating appropriate Mermaid converters."""

    # Registry of available converters
    _CONVERTERS: Dict[DiagramType, Type[BaseMermaidConverter]] = {
        DiagramType.FLOWCHART: FlowchartMermaidConverter,
        DiagramType.DEFAULT: DefaultMermaidConverter,
        # DiagramType.ARCHITECTURE will be added in Phase 2
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
    def get_supported_types(cls) -> List[DiagramType]:
        """Get list of supported diagram types."""
        return list(cls._CONVERTERS.keys())
```

### 4. Default Converter (`default_converter.py`)

```python
"""Default/fallback converter for unsupported diagram types."""

import re
from typing import Dict, List, Tuple, Any
from xml.etree import ElementTree as ET
from .base_converter import BaseMermaidConverter

class DefaultMermaidConverter(BaseMermaidConverter):
    """Default converter for unsupported or unrecognized diagram types."""

    async def parse_mermaid_source(self, mermaid_content: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Basic parsing that attempts to extract simple node/edge patterns.
        This is a fallback that handles basic arrow connections.
        """
        nodes = {}
        edges = []

        self.logger.info("Using default parser for unrecognized diagram type")

        # Clean content
        content = ' '.join(line.strip() for line in mermaid_content.strip().split('\n')
                          if line.strip() and not line.strip().startswith('%%'))

        # Try to find basic arrow patterns: A --> B, A -> B, etc.
        arrow_patterns = [
            (r'(\w+)\s*-->\s*(\w+)', False),  # solid arrow
            (r'(\w+)\s*-\.->\s*(\w+)', True), # dashed arrow
            (r'(\w+)\s*->\s*(\w+)', False),   # simple arrow
        ]

        for pattern, is_dashed in arrow_patterns:
            matches = re.findall(pattern, content)
            for source, target in matches:
                # Add nodes if not present
                if source not in nodes:
                    nodes[source] = {
                        'id': source,
                        'label': source,
                        'icon': None,
                        'hasIcon': False
                    }

                if target not in nodes:
                    nodes[target] = {
                        'id': target,
                        'label': target,
                        'icon': None,
                        'hasIcon': False
                    }

                edges.append({
                    'source': source,
                    'target': target,
                    'dashed': is_dashed
                })

        self.logger.info(f"Default parser found {len(nodes)} nodes and {len(edges)} edges")
        return nodes, edges

    async def extract_svg_positions(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """
        Basic SVG position extraction that works with various SVG structures.
        """
        try:
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            root = ET.fromstring(svg_content)
            ns = {'svg': 'http://www.w3.org/2000/svg'}

            positions = {}

            # Look for groups with IDs - try various patterns
            for g in root.findall('.//svg:g[@id]', ns):
                gid = g.get('id')
                if not gid:
                    continue

                # Try to extract meaningful node name from ID
                node_name = self._extract_node_name_from_id(gid)
                if not node_name:
                    continue

                # Get position and size
                tx, ty = self._parse_transform_translate(g.get('transform', ''))
                w, h, rx, ry = self._get_rect_size(g)
                x, y = tx + rx, ty + ry

                positions[node_name] = {
                    'x': x, 'y': y, 'w': w, 'h': h
                }

            self.logger.info(f"Default extractor found {len(positions)} positioned nodes")
            return positions

        except Exception as e:
            self.logger.warning(f"Default SVG extraction failed: {str(e)}")
            return {}

    def _extract_node_name_from_id(self, element_id: str) -> str:
        """Extract node name from various ID patterns."""
        # Try flowchart pattern: flowchart-A-123 -> A
        match = re.match(r'flowchart-([A-Za-z0-9_]+)-\d+', element_id)
        if match:
            return match.group(1)

        # Try simple patterns: node-A, A-123, etc.
        match = re.match(r'(?:node-)?([A-Za-z0-9_]+)(?:-\d+)?', element_id)
        if match:
            return match.group(1)

        # Use ID as-is if it looks like a node name
        if re.match(r'^[A-Za-z0-9_]+$', element_id):
            return element_id

        return ""
```

## 🔄 Refactoring Existing Service

### Modified `mermaid_drawio_service.py`

The main service becomes an orchestrator that delegates to appropriate converters:

```python
"""
Mermaid to Draw.io conversion service - Orchestrator for multiple algorithms.
"""

import logging
from typing import Dict, List, Tuple, Optional, Any

from .diagram_converters.converter_factory import MermaidConverterFactory
from .diagram_converters.diagram_detector import DiagramTypeDetector

# Keep existing imports for PNG conversion and icon services
# ... (existing imports)

class MermaidDrawioService:
    """Orchestrator service for converting Mermaid diagrams to Draw.io format."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.mermaid-drawio")

    async def convert_mermaid_to_drawio_xml(
        self,
        mermaid_source: str,
        svg_content: str,
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600,
        is_dark_mode: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Convert Mermaid source and SVG content to Draw.io XML format.

        Uses smart detection to choose appropriate conversion algorithm.
        """
        try:
            self.logger.info("Starting Mermaid to Draw.io XML conversion")

            # Detect diagram type and get info
            diagram_info = DiagramTypeDetector.get_diagram_info(mermaid_source)
            self.logger.info(f"Detected diagram type: {diagram_info['type_name']} "
                           f"(confidence: {diagram_info['confidence']:.2f})")

            # Create appropriate converter
            converter = MermaidConverterFactory.create_converter(mermaid_source)

            # Delegate conversion to specialized converter
            drawio_xml, conversion_metadata = await converter.convert_to_drawio_xml(
                mermaid_source, svg_content, icon_service_url, width, height, is_dark_mode
            )

            # Enhance metadata with detection info
            metadata = {
                **diagram_info,
                **conversion_metadata,
                "canvas_width": width,
                "canvas_height": height,
                "icon_service_url": icon_service_url,
                "dark_mode": is_dark_mode
            }

            self.logger.info("Mermaid to Draw.io XML conversion completed")
            return drawio_xml, metadata

        except Exception as e:
            self.logger.error(f"Mermaid to Draw.io XML conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert Mermaid to Draw.io XML: {str(e)}")

    # Keep existing PNG conversion methods unchanged
    async def convert_mermaid_to_drawio_png(self, ...):
        """Existing PNG conversion - delegates XML generation to new system."""
        # Get XML using new system
        drawio_xml, xml_metadata = await self.convert_mermaid_to_drawio_xml(
            mermaid_source, svg_content, icon_service_url, width or 1000, height or 600, is_dark_mode
        )

        # Continue with existing PNG generation logic...
        # ... (keep existing PNG code)

    # Keep all existing helper methods for PNG conversion
    # ... (existing methods)
```

## ✅ Testing Strategy

### Test Files to Create
```
export-service/tests/
├── test_diagram_detector.py
├── test_converter_factory.py
├── test_base_converter.py
├── test_default_converter.py
└── fixtures/
    └── phase1_test_data.py
```

### Key Test Cases
1. **Diagram Detection**: All diagram types correctly identified
2. **Factory Pattern**: Correct converters created for each type
3. **Backward Compatibility**: Existing flowchart tests still pass
4. **Default Fallback**: Unknown diagrams handled gracefully
5. **Error Handling**: Proper error propagation and logging

## 🚀 Implementation Steps

### Step 1: Create Directory Structure
```bash
mkdir -p export-service/app/services/diagram_converters
touch export-service/app/services/diagram_converters/__init__.py
```

### Step 2: Implement Core Components
1. Create `diagram_detector.py` with comprehensive type detection
2. Create `base_converter.py` with abstract interface
3. Create `converter_factory.py` with factory pattern
4. Create `default_converter.py` with fallback logic

### Step 3: Extract Flowchart Logic
1. Move existing logic from `mermaid_drawio_service.py` to `flowchart_converter.py`
2. Adapt to new base class interface
3. Ensure no functionality is lost

### Step 4: Refactor Main Service
1. Update `mermaid_drawio_service.py` to use factory pattern
2. Keep PNG conversion methods intact
3. Enhance metadata with detection info

### Step 5: Update Tests
1. Create new test files for new components
2. Verify existing tests still pass
3. Add integration tests for new architecture

## 🎯 Success Criteria

- [ ] All existing tests pass without modification
- [ ] New architecture supports flowchart diagrams identically to before
- [ ] Diagram type detection accurately identifies flowcharts
- [ ] Factory pattern correctly instantiates flowchart converter
- [ ] Default converter handles unknown diagram types gracefully
- [ ] No performance degradation in conversion speed
- [ ] Code coverage maintained at current levels
- [ ] All error cases properly handled and logged

## 📋 Deliverables

1. Complete diagram converter infrastructure
2. Working diagram type detection
3. Factory pattern implementation
4. Refactored main service maintaining API compatibility
5. Comprehensive test suite
6. Updated documentation

## 🔗 Next Phase
Phase 2 will implement the architecture-specific converter using this foundation, adding support for architecture diagrams with enhanced positioning and parsing logic.
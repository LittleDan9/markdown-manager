# Phase 2A: Architecture Converter - Enhanced SVG Processing

## Overview

Implement the first part of the architecture-specific converter focusing on enhanced SVG position extraction and transform handling. This phase builds on Phase 1's foundation to support architecture diagrams with proper positioning.

## 🎯 Phase Objectives

- Create architecture-specific converter class
- Implement enhanced SVG position extraction with transform accumulation
- Support architecture diagram CSS classes and ID patterns
- Handle viewBox offsets and complex positioning
- Maintain compatibility with existing position extraction logic

## 🏗️ Architecture Overview

### Building on Phase 1

Phase 1 established:

- `BaseMermaidConverter` abstract class
- `DiagramTypeDetector` for type identification
- `MermaidConverterFactory` for converter creation
- `FlowchartMermaidConverter` (existing logic)

### Phase 2A Additions

```text
diagram_converters/
├── architecture_converter.py  # NEW: Architecture-specific logic
├── shared_utils.py           # NEW: Shared utilities
└── positioning/              # NEW: Advanced positioning logic
    ├── __init__.py
    ├── svg_parser.py         # Enhanced SVG parsing
    ├── transform_handler.py  # Transform accumulation
    └── viewbox_handler.py    # ViewBox offset handling
```

## 🔧 Implementation Details

### 1. Architecture Converter Foundation (`architecture_converter.py`)

```python
"""Architecture-specific converter for Mermaid architecture diagrams."""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from xml.etree import ElementTree as ET

from .base_converter import BaseMermaidConverter
from .positioning.svg_parser import EnhancedSVGParser
from .positioning.transform_handler import TransformHandler
from .positioning.viewbox_handler import ViewBoxHandler

class ArchitectureMermaidConverter(BaseMermaidConverter):
    """Converter specialized for Mermaid architecture diagrams."""

    def __init__(self):
        super().__init__()
        self.svg_parser = EnhancedSVGParser()
        self.transform_handler = TransformHandler()
        self.viewbox_handler = ViewBoxHandler()

    async def parse_mermaid_source(self, mermaid_content: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parse architecture diagram source code.

        Architecture diagrams support:
        - service definitions: service name(icon)[Label]
        - group definitions: group name(icon)[Label]
        - junction definitions: junction name
        - bidirectional edges with position specifiers
        """
        # This will be implemented in Phase 2B
        # For now, return empty structures
        return {}, []

    async def extract_svg_positions(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """
        Enhanced SVG position extraction for architecture diagrams.

        Improvements over basic extraction:
        - Support architecture-specific CSS classes
        - Handle transform accumulation from parent elements
        - Apply viewBox offsets correctly
        - Support hyphenated node IDs
        - Robust fallback sizing
        """
        try:
            self.logger.info("Starting enhanced SVG position extraction for architecture diagram")

            # Parse SVG with namespace handling
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            root = ET.fromstring(svg_content)
            ns = {'svg': 'http://www.w3.org/2000/svg'}

            # Extract viewBox information
            viewbox_offset = self.viewbox_handler.extract_viewbox_offset(root)
            self.logger.debug(f"ViewBox offset: {viewbox_offset}")

            positions = {}

            # Find all relevant groups - broader selector than flowchart-only
            groups = self._find_relevant_groups(root, ns)
            self.logger.info(f"Found {len(groups)} relevant groups in SVG")

            for group in groups:
                position_info = await self._extract_group_position(group, viewbox_offset, ns)
                if position_info:
                    node_id, position = position_info
                    positions[node_id] = position
                    self.logger.debug(f"Extracted position for {node_id}: {position}")

            self.logger.info(f"Enhanced extraction found {len(positions)} positioned nodes")
            return positions

        except Exception as e:
            self.logger.error(f"Enhanced SVG position extraction failed: {str(e)}")
            # Fallback to basic extraction if available
            return await self._fallback_position_extraction(svg_content)

    def _find_relevant_groups(self, root: ET.Element, ns: Dict[str, str]) -> List[ET.Element]:
        """
        Find all groups that represent architecture diagram nodes.

        Architecture diagrams use different CSS classes than flowcharts:
        - architecture-service
        - architecture-junction
        - architecture-groups
        - node (generic)
        - icon-shape
        """
        relevant_groups = []

        # Architecture-specific selectors
        architecture_classes = [
            'architecture-service',
            'architecture-junction',
            'architecture-groups',
            'node',
            'icon-shape'
        ]

        # Find groups with relevant classes
        for group in root.findall('.//svg:g[@class]', ns):
            class_attr = group.get('class', '')
            classes = class_attr.split()

            # Check if any class matches our architecture patterns
            if any(cls in architecture_classes for cls in classes):
                relevant_groups.append(group)
                continue

            # Also check for groups with IDs (fallback)
            if group.get('id') and not relevant_groups.__contains__(group):
                relevant_groups.append(group)

        return relevant_groups

    async def _extract_group_position(
        self,
        group: ET.Element,
        viewbox_offset: Dict[str, float],
        ns: Dict[str, str]
    ) -> Optional[Tuple[str, Dict[str, float]]]:
        """Extract position information from a single group element."""
        try:
            # Extract node ID using multiple strategies
            node_id = self._extract_node_id(group)
            if not node_id:
                return None

            # Accumulate transforms from this element and all parents
            total_transform = self.transform_handler.accumulate_transforms(group)

            # Get element size using multiple strategies
            element_size = self._extract_element_size(group, ns)

            # Apply viewBox offset to final position
            final_position = self.viewbox_handler.apply_viewbox_offset(
                total_transform, element_size, viewbox_offset
            )

            return node_id, final_position

        except Exception as e:
            self.logger.warning(f"Failed to extract position from group: {str(e)}")
            return None

    def _extract_node_id(self, group: ET.Element) -> Optional[str]:
        """
        Extract node ID using multiple strategies for architecture diagrams.

        Strategies (in order of preference):
        1. Use data-node-id attribute if present
        2. Extract from id attribute with pattern matching
        3. Extract from inner text content
        4. Use id as-is if it looks like a node name
        """
        # Strategy 1: data-node-id attribute (most reliable)
        data_node_id = group.get('data-node-id')
        if data_node_id:
            return data_node_id

        # Strategy 2: Pattern matching on id attribute
        element_id = group.get('id')
        if element_id:
            # Remove flowchart-specific prefix constraint
            # Support patterns like: service-input, node-A, input-123, etc.
            patterns = [
                r'service-([A-Za-z0-9_-]+)',     # service-input -> input
                r'node-([A-Za-z0-9_-]+)',        # node-input -> input
                r'flowchart-([A-Za-z0-9_-]+)-\d+', # flowchart-input-0 -> input
                r'([A-Za-z0-9_-]+)-\d+',         # input-123 -> input
                r'^([A-Za-z0-9_-]+)$'            # input -> input
            ]

            for pattern in patterns:
                match = re.match(pattern, element_id)
                if match:
                    return match.group(1)

        # Strategy 3: Extract from inner text content
        text_content = self._extract_text_content(group)
        if text_content and re.match(r'^[A-Za-z0-9_-]+$', text_content):
            return text_content

        return None

    def _extract_text_content(self, group: ET.Element) -> Optional[str]:
        """Extract text content from group element."""
        try:
            # Look for text elements
            text_elements = group.findall('.//{http://www.w3.org/2000/svg}text')
            if text_elements:
                # Get text from first text element
                text_elem = text_elements[0]
                if text_elem.text:
                    return text_elem.text.strip()

                # Check for tspan children
                tspan = text_elem.find('.//{http://www.w3.org/2000/svg}tspan')
                if tspan is not None and tspan.text:
                    return tspan.text.strip()

        except Exception:
            pass

        return None

    def _extract_element_size(self, group: ET.Element, ns: Dict[str, str]) -> Dict[str, float]:
        """
        Extract element size using multiple strategies.

        Strategies (in order of preference):
        1. Find rect with specific class
        2. Find any rect with width/height
        3. Calculate bounding box from child elements
        4. Use default size based on element type
        """
        # Strategy 1: Look for rect with specific class
        rect = group.find(".//{http://www.w3.org/2000/svg}rect[@class='basic label-container']")

        if rect is None:
            # Strategy 2: Look for any rect element with dimensions
            rects = group.findall('.//{http://www.w3.org/2000/svg}rect')
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

                return {'w': w, 'h': h, 'rx': x, 'ry': y}
            except (ValueError, TypeError):
                pass

        # Strategy 3: Calculate bounding box from child elements
        bbox = self._calculate_bounding_box(group, ns)
        if bbox:
            return bbox

        # Strategy 4: Default size based on element class
        return self._get_default_size_for_element(group)

    def _calculate_bounding_box(self, group: ET.Element, ns: Dict[str, str]) -> Optional[Dict[str, float]]:
        """Calculate bounding box from child SVG elements."""
        try:
            min_x = min_y = float('inf')
            max_x = max_y = float('-inf')
            found_elements = False

            # Check various SVG elements for position/size info
            for element_type in ['rect', 'circle', 'ellipse', 'path', 'polygon']:
                elements = group.findall(f'.//{{{ns["svg"]}}}{element_type}')

                for elem in elements:
                    bounds = self._get_element_bounds(elem, element_type)
                    if bounds:
                        found_elements = True
                        min_x = min(min_x, bounds['min_x'])
                        min_y = min(min_y, bounds['min_y'])
                        max_x = max(max_x, bounds['max_x'])
                        max_y = max(max_y, bounds['max_y'])

            if found_elements and min_x != float('inf'):
                w = max_x - min_x
                h = max_y - min_y
                return {'w': max(w, 40), 'h': max(h, 30), 'rx': min_x, 'ry': min_y}

        except Exception as e:
            self.logger.debug(f"Bounding box calculation failed: {str(e)}")

        return None

    def _get_element_bounds(self, elem: ET.Element, element_type: str) -> Optional[Dict[str, float]]:
        """Get bounds for a specific SVG element type."""
        try:
            if element_type == 'rect':
                x = float(elem.get('x', 0))
                y = float(elem.get('y', 0))
                w = float(elem.get('width', 0))
                h = float(elem.get('height', 0))
                return {'min_x': x, 'min_y': y, 'max_x': x + w, 'max_y': y + h}

            elif element_type == 'circle':
                cx = float(elem.get('cx', 0))
                cy = float(elem.get('cy', 0))
                r = float(elem.get('r', 0))
                return {'min_x': cx - r, 'min_y': cy - r, 'max_x': cx + r, 'max_y': cy + r}

            elif element_type == 'ellipse':
                cx = float(elem.get('cx', 0))
                cy = float(elem.get('cy', 0))
                rx = float(elem.get('rx', 0))
                ry = float(elem.get('ry', 0))
                return {'min_x': cx - rx, 'min_y': cy - ry, 'max_x': cx + rx, 'max_y': cy + ry}

        except (ValueError, TypeError):
            pass

        return None

    def _get_default_size_for_element(self, group: ET.Element) -> Dict[str, float]:
        """Get default size based on element class or type."""
        class_attr = group.get('class', '')

        # Architecture services tend to be larger
        if 'architecture-service' in class_attr:
            return {'w': 120, 'h': 100, 'rx': -60, 'ry': -50}

        # Junctions are smaller
        if 'architecture-junction' in class_attr:
            return {'w': 20, 'h': 20, 'rx': -10, 'ry': -10}

        # Default size
        return {'w': 80, 'h': 80, 'rx': -40, 'ry': -40}

    async def _fallback_position_extraction(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """Fallback to basic position extraction if enhanced extraction fails."""
        try:
            self.logger.warning("Using fallback position extraction")

            # Use the basic extraction logic from parent class
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            root = ET.fromstring(svg_content)
            ns = {'svg': 'http://www.w3.org/2000/svg'}

            positions = {}

            # Simple fallback - just look for any groups with IDs
            for g in root.findall('.//svg:g[@id]', ns):
                gid = g.get('id')
                if not gid:
                    continue

                # Simple node name extraction
                node_name = re.sub(r'[^A-Za-z0-9_-]', '', gid)
                if not node_name:
                    continue

                # Basic position extraction
                tx, ty = self._parse_transform_translate(g.get('transform', ''))
                w, h, rx, ry = self._get_rect_size(g)
                x, y = tx + rx, ty + ry

                positions[node_name] = {'x': x, 'y': y, 'w': w, 'h': h}

            return positions

        except Exception as e:
            self.logger.error(f"Fallback position extraction also failed: {str(e)}")
            return {}
```

### 2. Enhanced SVG Parser (`positioning/svg_parser.py`)

```python
"""Enhanced SVG parsing utilities for architecture diagrams."""

import logging
from typing import Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

class EnhancedSVGParser:
    """Enhanced SVG parser with support for complex architecture diagrams."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.svg-parser")

    def parse_svg_with_namespaces(self, svg_content: str) -> Tuple[ET.Element, Dict[str, str]]:
        """Parse SVG content and return root element with namespace map."""
        try:
            # Register common SVG namespace
            ET.register_namespace('', 'http://www.w3.org/2000/svg')

            # Parse the SVG
            root = ET.fromstring(svg_content)

            # Standard namespace mapping
            namespaces = {
                'svg': 'http://www.w3.org/2000/svg',
                'xlink': 'http://www.w3.org/1999/xlink'
            }

            return root, namespaces

        except ET.ParseError as e:
            self.logger.error(f"Failed to parse SVG content: {str(e)}")
            raise ValueError(f"Invalid SVG content: {str(e)}")

    def find_groups_by_class_patterns(
        self,
        root: ET.Element,
        ns: Dict[str, str],
        class_patterns: List[str]
    ) -> List[ET.Element]:
        """Find groups matching any of the given class patterns."""
        matching_groups = []

        for group in root.findall('.//svg:g[@class]', ns):
            class_attr = group.get('class', '')
            classes = class_attr.split()

            # Check if any class matches our patterns
            for pattern in class_patterns:
                if any(pattern in cls for cls in classes):
                    matching_groups.append(group)
                    break

        return matching_groups

    def extract_viewbox_info(self, root: ET.Element) -> Dict[str, float]:
        """Extract viewBox information from SVG root."""
        viewbox_attr = root.get('viewBox')
        if not viewbox_attr:
            return {'x': 0, 'y': 0, 'width': 0, 'height': 0}

        try:
            values = viewbox_attr.split()
            if len(values) == 4:
                return {
                    'x': float(values[0]),
                    'y': float(values[1]),
                    'width': float(values[2]),
                    'height': float(values[3])
                }
        except (ValueError, IndexError):
            self.logger.warning(f"Invalid viewBox format: {viewbox_attr}")

        return {'x': 0, 'y': 0, 'width': 0, 'height': 0}

    def get_svg_dimensions(self, root: ET.Element) -> Dict[str, float]:
        """Get SVG width and height from root element."""
        try:
            width = float(root.get('width', '0').replace('px', ''))
            height = float(root.get('height', '0').replace('px', ''))
            return {'width': width, 'height': height}
        except ValueError:
            # Fallback to viewBox if width/height not numeric
            viewbox = self.extract_viewbox_info(root)
            return {'width': viewbox['width'], 'height': viewbox['height']}
```

### 3. Transform Handler (`positioning/transform_handler.py`)

```python
"""Transform accumulation and handling for SVG elements."""

import re
import logging
from typing import Dict, List, Tuple, Optional
from xml.etree import ElementTree as ET

class TransformHandler:
    """Handles SVG transform accumulation and matrix operations."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.transform-handler")

    def accumulate_transforms(self, element: ET.Element) -> Dict[str, float]:
        """
        Accumulate all transforms from element and its parents.

        Returns combined translation as {x, y, scale_x, scale_y, rotation}
        """
        total_transform = {'x': 0.0, 'y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'rotation': 0.0}

        # Walk up the element tree accumulating transforms
        current = element
        transform_chain = []

        while current is not None:
            transform_attr = current.get('transform')
            if transform_attr:
                transform_chain.append(transform_attr)
                self.logger.debug(f"Found transform: {transform_attr}")

            # Move to parent
            current = current.getparent() if hasattr(current, 'getparent') else None

        # Apply transforms in reverse order (parent first)
        for transform_str in reversed(transform_chain):
            transform_data = self.parse_transform_string(transform_str)
            total_transform = self.combine_transforms(total_transform, transform_data)

        self.logger.debug(f"Final accumulated transform: {total_transform}")
        return total_transform

    def parse_transform_string(self, transform_str: str) -> Dict[str, float]:
        """
        Parse SVG transform string into components.

        Supports: translate(x,y), scale(x,y), rotate(angle), matrix(...)
        """
        transform_data = {'x': 0.0, 'y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'rotation': 0.0}

        if not transform_str:
            return transform_data

        # Parse translate(x, y)
        translate_match = re.search(r'translate\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)', transform_str)
        if translate_match:
            transform_data['x'] = float(translate_match.group(1))
            transform_data['y'] = float(translate_match.group(2)) if translate_match.group(2) else 0.0

        # Parse scale(x, y) or scale(factor)
        scale_match = re.search(r'scale\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)', transform_str)
        if scale_match:
            scale_x = float(scale_match.group(1))
            scale_y = float(scale_match.group(2)) if scale_match.group(2) else scale_x
            transform_data['scale_x'] = scale_x
            transform_data['scale_y'] = scale_y

        # Parse rotate(angle)
        rotate_match = re.search(r'rotate\(\s*([-\d.]+)\s*\)', transform_str)
        if rotate_match:
            transform_data['rotation'] = float(rotate_match.group(1))

        # Parse matrix(a b c d e f) - extract translation components
        matrix_match = re.search(r'matrix\(\s*([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)' +
                                r'(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)\s*\)',
                                transform_str)
        if matrix_match:
            # Matrix format: matrix(a, b, c, d, e, f)
            # Where e and f are translation components
            transform_data['x'] += float(matrix_match.group(5))  # e
            transform_data['y'] += float(matrix_match.group(6))  # f
            # Could also extract scale and rotation from a,b,c,d but keeping simple for now

        return transform_data

    def combine_transforms(self, base: Dict[str, float], additional: Dict[str, float]) -> Dict[str, float]:
        """Combine two transform dictionaries."""
        return {
            'x': base['x'] + additional['x'] * base['scale_x'],
            'y': base['y'] + additional['y'] * base['scale_y'],
            'scale_x': base['scale_x'] * additional['scale_x'],
            'scale_y': base['scale_y'] * additional['scale_y'],
            'rotation': base['rotation'] + additional['rotation']  # Simple addition for rotation
        }
```

### 4. ViewBox Handler (`positioning/viewbox_handler.py`)

```python
"""ViewBox offset handling for accurate SVG positioning."""

import logging
from typing import Dict
from xml.etree import ElementTree as ET

class ViewBoxHandler:
    """Handles SVG viewBox offset calculations."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.viewbox-handler")

    def extract_viewbox_offset(self, root: ET.Element) -> Dict[str, float]:
        """Extract viewBox offset from SVG root element."""
        viewbox_attr = root.get('viewBox')
        if not viewbox_attr:
            return {'offset_x': 0.0, 'offset_y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0}

        try:
            values = viewbox_attr.split()
            if len(values) >= 4:
                viewbox_x = float(values[0])
                viewbox_y = float(values[1])
                viewbox_width = float(values[2])
                viewbox_height = float(values[3])

                # Get actual SVG dimensions
                svg_width = self._get_svg_dimension(root, 'width', viewbox_width)
                svg_height = self._get_svg_dimension(root, 'height', viewbox_height)

                # Calculate scale factors
                scale_x = svg_width / viewbox_width if viewbox_width > 0 else 1.0
                scale_y = svg_height / viewbox_height if viewbox_height > 0 else 1.0

                return {
                    'offset_x': -viewbox_x,
                    'offset_y': -viewbox_y,
                    'scale_x': scale_x,
                    'scale_y': scale_y,
                    'viewbox_width': viewbox_width,
                    'viewbox_height': viewbox_height,
                    'svg_width': svg_width,
                    'svg_height': svg_height
                }

        except (ValueError, IndexError) as e:
            self.logger.warning(f"Failed to parse viewBox '{viewbox_attr}': {str(e)}")

        return {'offset_x': 0.0, 'offset_y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0}

    def _get_svg_dimension(self, root: ET.Element, attr: str, fallback: float) -> float:
        """Get SVG width or height attribute as float."""
        try:
            value = root.get(attr, str(fallback))
            # Remove common units
            value = value.replace('px', '').replace('pt', '').replace('%', '')
            return float(value)
        except ValueError:
            return fallback

    def apply_viewbox_offset(
        self,
        transform: Dict[str, float],
        element_size: Dict[str, float],
        viewbox_offset: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply viewBox offset to element position and size.

        Args:
            transform: Transform data with x, y, scale_x, scale_y
            element_size: Element size with w, h, rx, ry
            viewbox_offset: ViewBox offset data

        Returns:
            Final position dictionary with x, y, w, h
        """
        # Apply viewBox offset to position
        final_x = (transform['x'] + element_size['rx'] + viewbox_offset['offset_x']) * viewbox_offset.get('scale_x', 1.0)
        final_y = (transform['y'] + element_size['ry'] + viewbox_offset['offset_y']) * viewbox_offset.get('scale_y', 1.0)

        # Apply scaling to size
        final_w = element_size['w'] * transform['scale_x'] * viewbox_offset.get('scale_x', 1.0)
        final_h = element_size['h'] * transform['scale_y'] * viewbox_offset.get('scale_y', 1.0)

        return {
            'x': final_x,
            'y': final_y,
            'w': max(final_w, 20),  # Minimum width
            'h': max(final_h, 15),  # Minimum height
        }
```

## 🔧 Integration Updates

### Update Converter Factory

```python
# In converter_factory.py, add architecture support:

from .architecture_converter import ArchitectureMermaidConverter

class MermaidConverterFactory:
    _CONVERTERS: Dict[DiagramType, Type[BaseMermaidConverter]] = {
        DiagramType.FLOWCHART: FlowchartMermaidConverter,
        DiagramType.ARCHITECTURE: ArchitectureMermaidConverter,  # NEW
        DiagramType.DEFAULT: DefaultMermaidConverter,
    }
```

### Update Diagram Detector

```python
# In diagram_detector.py, ensure architecture detection is robust:

DETECTION_PATTERNS = {
    DiagramType.ARCHITECTURE: [
        r'^\s*architecture(-beta)?',        # architecture-beta keyword
        r'\bservice\s+\w+.*\[.*\]',        # service definitions
        r'\bgroup\s+\w+.*\[.*\]',          # group definitions
        r'\bjunction\s+\w+',               # junction definitions
        r':\s*[LRTB]\s*[<-]+[>-]*\s*[LRTB]\s*:', # directional edges
    ],
    # ... other patterns
}
```

## ✅ Testing Strategy

### Test Files to Create

```text
export-service/tests/
├── test_architecture_converter.py
├── test_enhanced_svg_parsing.py
├── test_transform_handler.py
├── test_viewbox_handler.py
└── fixtures/
    └── architecture_svg_samples.py
```

### Key Test Cases

1. **Architecture SVG Position Extraction**
   - Various CSS class patterns
   - Transform accumulation
   - ViewBox offset handling
   - Fallback extraction

2. **Transform Handling**
   - Nested transforms
   - Multiple transform types
   - Matrix transforms
   - Scale and rotation

3. **ViewBox Processing**
   - Different viewBox formats
   - Scaling calculations
   - Offset applications

## 🚀 Implementation Steps

### Step 1: Create Directory Structure

```bash
mkdir -p export-service/app/services/diagram_converters/positioning
touch export-service/app/services/diagram_converters/positioning/__init__.py
```

### Step 2: Implement Core Components

1. Create positioning utility classes
2. Implement enhanced SVG parser
3. Create transform and viewbox handlers
4. Create architecture converter foundation

### Step 3: Update Factory and Detector

1. Register architecture converter in factory
2. Ensure architecture detection works properly
3. Test converter creation

### Step 4: Integration Testing

1. Test with real architecture diagram SVGs
2. Verify position extraction improvements
3. Ensure backward compatibility maintained

## 🎯 Success Criteria

- [ ] Architecture converter properly registered and created
- [ ] Enhanced SVG position extraction handles architecture diagrams
- [ ] Transform accumulation works for nested elements
- [ ] ViewBox offset correctly applied to final positions
- [ ] Robust fallback extraction for edge cases
- [ ] All existing tests continue to pass
- [ ] Performance is acceptable for complex SVGs

## 📋 Deliverables

1. `ArchitectureMermaidConverter` class foundation
2. Enhanced SVG parsing utilities
3. Transform accumulation system
4. ViewBox offset handling
5. Updated factory registration
6. Comprehensive test suite
7. Documentation updates

## 🔗 Next Phase

Phase 2B will implement the Mermaid source parsing for architecture diagrams, handling services, groups, junctions, and directional edges.
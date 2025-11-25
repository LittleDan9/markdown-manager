"""Enhanced SVG parsing utilities for architecture diagrams."""

import logging
from typing import Dict, List, Tuple
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

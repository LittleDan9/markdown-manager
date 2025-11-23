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
            (r'(\w+)\s*-\.->\s*(\w+)', True),  # dashed arrow
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

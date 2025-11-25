"""Flowchart converter - existing logic extracted from MermaidDrawioService."""

import re
from typing import Dict, List, Tuple, Any
from xml.etree import ElementTree as ET
from .base_converter import BaseMermaidConverter


class FlowchartMermaidConverter(BaseMermaidConverter):
    """Converter for flowchart-type Mermaid diagrams."""

    async def parse_mermaid_source(self, mermaid_content: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Parse the raw mermaid source to extract node information and icons."""
        nodes = {}
        edges = []

        # First, collect all content in one string for easier processing
        content = ' '.join(line.strip() for line in mermaid_content.strip().split('\n')
                           if line.strip() and not line.strip().startswith('flowchart')
                           and not line.strip().startswith('graph'))

        self.logger.debug(f"Processing Mermaid content: {content}")

        # Parse node definitions with icons first
        # A@{ icon: "network:firewall", form: "", label: "Node" }
        icon_matches = re.findall(r'(\w+)@\{[^}]*icon:\s*"([^"]+)"[^}]*label:\s*"([^"]+)"[^}]*\}', content)
        for node_id, icon_ref, label in icon_matches:
            nodes[node_id] = {
                'id': node_id,
                'label': label,
                'icon': icon_ref,
                'hasIcon': True
            }
            self.logger.debug(f"Found icon node: {node_id} -> {label} ({icon_ref})")

        # Parse all edges and extract nodes from them
        edge_patterns = [
            (r'(\w+)(?:@\{[^}]*\})?\s*-->\s*(\w+)', False),  # solid arrow (A@{...} --> B or A --> B)
            (r'(\w+)(?:@\{[^}]*\})?\s*-\.-\s*(\w+)', True),   # dotted line
            (r'(\w+)(?:@\{[^}]*\})?\s*---\s*(\w+)', False),   # solid line
        ]

        for pattern, is_dashed in edge_patterns:
            matches = re.findall(pattern, content)
            for source, target in matches:
                # Add source node if not already present
                if source not in nodes:
                    nodes[source] = {
                        'id': source,
                        'label': source,
                        'icon': None,
                        'hasIcon': False
                    }
                    self.logger.debug(f"Found regular node from edge: {source}")

                # Add target node if not already present
                if target not in nodes:
                    nodes[target] = {
                        'id': target,
                        'label': target,
                        'icon': None,
                        'hasIcon': False
                    }
                    self.logger.debug(f"Found regular node from edge: {target}")

                edges.append({
                    'source': source,
                    'target': target,
                    'dashed': is_dashed
                })
                self.logger.debug(f"Found edge: {source} -> {target} (dashed: {is_dashed})")

        return nodes, edges

    async def extract_svg_positions(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """Extract positioning information from the rendered SVG."""
        try:
            # Register namespace for XML parsing
            ET.register_namespace('', 'http://www.w3.org/2000/svg')

            # Parse SVG content
            root = ET.fromstring(svg_content)
            ns = {'svg': 'http://www.w3.org/2000/svg'}

            positions = {}

            # Find all groups that represent nodes
            for g in root.findall('.//svg:g[@class]', ns):
                cls = g.get('class', '')
                if 'node' not in cls.split() and 'icon-shape' not in cls.split():
                    continue

                gid = g.get('id')
                if not gid:
                    continue

                # Extract node name from ID (flowchart-A-0 -> A)
                m = re.match(r'flowchart-([A-Za-z0-9_]+)-\d+', gid)
                if not m:
                    continue

                node_name = m.group(1)

                # Get position and size
                tx, ty = self._parse_transform_translate(g.get('transform', ''))
                w, h, rx, ry = self._get_rect_size(g)
                x, y = tx + rx, ty + ry

                positions[node_name] = {
                    'x': x, 'y': y, 'w': w, 'h': h
                }

            return positions

        except Exception as e:
            self.logger.error(f"Failed to extract SVG positions: {str(e)}")
            return {}
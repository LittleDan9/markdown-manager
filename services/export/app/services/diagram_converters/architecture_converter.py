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

        Returns nodes and edges in the format expected by the base converter.
        """
        try:
            self.logger.info("Parsing architecture diagram source")

            # Import parser
            from .parsing.architecture_parser import ArchitectureParser

            # Parse architecture content
            parser = ArchitectureParser()
            parsed_data = parser.parse_architecture_content(mermaid_content)

            # Convert to base converter format
            nodes = {}
            edges = []

            # Convert services to nodes
            for service_id, service in parsed_data['services'].items():
                nodes[service_id] = {
                    'id': service_id,
                    'label': service.label,
                    'type': 'service',
                    'icon': service.icon,
                    'group': service.group,
                    'hasIcon': bool(service.icon)
                }

            # Convert groups to nodes (they can have visual representation)
            for group_id, group in parsed_data['groups'].items():
                nodes[group_id] = {
                    'id': group_id,
                    'label': group.label,
                    'type': 'group',
                    'icon': group.icon,
                    'services': group.services,
                    'hasIcon': bool(group.icon)
                }

            # Convert junctions to nodes
            for junction_id, junction in parsed_data['junctions'].items():
                nodes[junction_id] = {
                    'id': junction_id,
                    'label': junction_id,
                    'type': 'junction',
                    'group': junction.group,
                    'hasIcon': False
                }

            # Convert edges
            for edge in parsed_data['edges']:
                edges.append({
                    'source': edge.source,
                    'target': edge.target,
                    'source_direction': edge.source_direction,
                    'target_direction': edge.target_direction,
                    'arrow_type': edge.arrow_type,
                    'bidirectional': edge.arrow_type == 'bidirectional',
                    'dashed': edge.arrow_type == 'line'
                })

            self.logger.info(f"Converted to base format: {len(nodes)} nodes, {len(edges)} edges")
            return nodes, edges

        except Exception as e:
            self.logger.error(f"Architecture source parsing failed: {str(e)}")
            raise ValueError(f"Failed to parse architecture source: {str(e)}")

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

    async def build_drawio_xml(
        self,
        nodes: Dict[str, Any],
        edges: List[Dict[str, Any]],
        positions: Dict[str, Dict[str, float]],
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600
    ) -> Tuple[str, Dict[str, Any]]:
        """Build Draw.io XML with architecture-specific enhancements."""
        try:
            # Create root mxGraphModel element
            root = ET.Element('mxGraphModel',
                              dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                              connect='1', arrows='1', fold='1', page='1', pageScale='1',
                              pageWidth=str(width), pageHeight=str(height), math='0', shadow='0')

            root_el = ET.SubElement(root, 'root')
            ET.SubElement(root_el, 'mxCell', id='0')
            ET.SubElement(root_el, 'mxCell', id='1', parent='0')

            # Track conversion statistics
            stats = {
                'nodes_converted': 0,
                'edges_converted': 0,
                'icons_attempted': 0,
                'icons_successful': 0,
                'services_created': 0,
                'groups_created': 0,
                'junctions_created': 0
            }

            # Create nodes with architecture-specific styling
            x_offset = 100
            for i, (node_id, node_info) in enumerate(nodes.items()):
                position = positions.get(node_id, {
                    'x': x_offset + (i % 4) * 200,
                    'y': 100 + (i // 4) * 150,
                    'w': 120, 'h': 100
                })

                await self._create_architecture_node(
                    root_el, node_id, node_info, position, icon_service_url, stats
                )
                stats['nodes_converted'] += 1

            # Create edges with directional support
            await self._create_architecture_edges(root_el, edges, stats)

            # Convert to XML string and wrap in Draw.io format
            mx_xml = ET.tostring(root, encoding='unicode')
            drawio_xml = self._wrap_as_drawio(mx_xml)

            # Calculate success rates
            stats['icon_success_rate'] = (
                (stats['icons_successful'] / stats['icons_attempted'] * 100)
                if stats['icons_attempted'] > 0 else 100.0
            )

            return drawio_xml, stats

        except Exception as e:
            self.logger.error(f"Failed to build architecture Draw.io XML: {str(e)}")
            raise ValueError(f"Failed to build architecture Draw.io XML: {str(e)}")

    async def _create_architecture_node(
        self,
        root_el: ET.Element,
        node_id: str,
        node_info: Dict[str, Any],
        position: Dict[str, float],
        icon_service_url: Optional[str],
        stats: Dict[str, int]
    ):
        """Create a node with architecture-specific styling."""
        label = node_info['label']
        node_type = node_info.get('type', 'service')

        # Determine style based on node type
        if node_type == 'service':
            style = await self._get_service_style(node_info, icon_service_url, stats)
            # Services are typically larger
            position['w'] = max(position.get('w', 80), 120)
            position['h'] = max(position.get('h', 50), 100)
            stats['services_created'] += 1

        elif node_type == 'junction':
            style = "shape=ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;"
            # Junctions are small
            position['w'] = 20
            position['h'] = 20
            stats['junctions_created'] += 1

        elif node_type == 'group':
            # Groups are typically rendered as containers/backgrounds
            style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;dashed=1;"
            # Groups are larger to contain services
            position['w'] = max(position.get('w', 200), 200)
            position['h'] = max(position.get('h', 150), 150)
            stats['groups_created'] += 1

        else:
            # Default service style
            style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"

        # Create the cell
        cell_id = f"node-{node_id}"
        cell = ET.SubElement(root_el, 'mxCell',
                            id=cell_id,
                            value=self._escape_xml(label),
                            style=style,
                            vertex='1',
                            parent='1')

        geometry = ET.SubElement(cell, 'mxGeometry',
                               x=str(position['x']),
                               y=str(position['y']),
                               width=str(position['w']),
                               height=str(position['h']))
        geometry.set('as', 'geometry')

    async def _get_service_style(
        self,
        node_info: Dict[str, Any],
        icon_service_url: Optional[str],
        stats: Dict[str, int]
    ) -> str:
        """Get styling for service nodes, potentially with icons."""
        if node_info.get('hasIcon') and node_info.get('icon') and icon_service_url:
            stats['icons_attempted'] += 1
            icon_svg = await self.fetch_icon_svg(node_info['icon'], icon_service_url)
            if icon_svg:
                stats['icons_successful'] += 1
                # Icon style with bottom text positioning
                style = "shape=image;imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
                style += "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
                style += f"image={self._escape_xml(icon_svg)}"
                return style

        # Service without icon
        return "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;"

    async def _create_architecture_edges(
        self,
        root_el: ET.Element,
        edges: List[Dict[str, Any]],
        stats: Dict[str, int]
    ):
        """Create edges with architecture-specific directional support."""
        edge_id = 1000

        for edge in edges:
            source_id = f"node-{edge['source']}"
            target_id = f"node-{edge['target']}"

            # Build style based on edge properties
            style = 'endArrow=block;html=1;rounded=0;'

            if edge.get('dashed', False):
                style += 'dashed=1;dashPattern=3 3;'

            if edge.get('bidirectional', False):
                style += 'startArrow=block;'

            # Add directional exit/entry points if specified
            if edge.get('source_direction') or edge.get('target_direction'):
                style += self._get_directional_style(edge)

            edge_elem = ET.SubElement(root_el, 'mxCell',
                                     id=str(edge_id),
                                     style=style,
                                     edge='1',
                                     parent='1',
                                     source=source_id,
                                     target=target_id)

            geometry = ET.SubElement(edge_elem, 'mxGeometry', relative='1')
            geometry.set('as', 'geometry')

            # Add waypoints for directional edges if needed
            if edge.get('source_direction') or edge.get('target_direction'):
                self._add_directional_waypoints(geometry, edge)

            stats['edges_converted'] += 1
            edge_id += 1

    def _get_directional_style(self, edge: Dict[str, Any]) -> str:
        """Get additional styling for directional edges."""
        style = ""

        # Add exit/entry point styling based on directions
        source_dir = edge.get('source_direction')
        target_dir = edge.get('target_direction')

        if source_dir:
            if source_dir == 'R':
                style += 'exitX=1;exitY=0.5;exitDx=0;exitDy=0;'
            elif source_dir == 'L':
                style += 'exitX=0;exitY=0.5;exitDx=0;exitDy=0;'
            elif source_dir == 'T':
                style += 'exitX=0.5;exitY=0;exitDx=0;exitDy=0;'
            elif source_dir == 'B':
                style += 'exitX=0.5;exitY=1;exitDx=0;exitDy=0;'

        if target_dir:
            if target_dir == 'R':
                style += 'entryX=1;entryY=0.5;entryDx=0;entryDy=0;'
            elif target_dir == 'L':
                style += 'entryX=0;entryY=0.5;entryDx=0;entryDy=0;'
            elif target_dir == 'T':
                style += 'entryX=0.5;entryY=0;entryDx=0;entryDy=0;'
            elif target_dir == 'B':
                style += 'entryX=0.5;entryY=1;entryDx=0;entryDy=0;'

        return style

    def _add_directional_waypoints(self, geometry: ET.Element, edge: Dict[str, Any]):
        """Add intermediate waypoints for better edge routing."""
        # For now, let Draw.io handle automatic routing
        # Could be enhanced with specific waypoint calculation based on directions
        pass

    # Keep existing icon and XML utility methods
    async def fetch_icon_svg(self, icon_ref: str, icon_service_url: str) -> Optional[str]:
        """Fetch and clean SVG icon from icon service."""
        try:
            import requests
            import urllib.parse

            # Clean the icon reference
            icon_ref = icon_ref.strip()
            if not icon_ref:
                return None

            # Build the request URL
            if '/' not in icon_ref:
                # Single icon name, try common icon sets
                for icon_set in ['material-icons', 'heroicons', 'lucide']:
                    url = f"{icon_service_url}/api/icons/{icon_set}/{icon_ref}"
                    try:
                        response = requests.get(url, timeout=5)
                        if response.status_code == 200:
                            return self._clean_svg_for_drawio(response.text)
                    except requests.RequestException:
                        continue
            else:
                # Full icon reference with set
                url = f"{icon_service_url}/api/icons/{icon_ref}"
                try:
                    response = requests.get(url, timeout=5)
                    if response.status_code == 200:
                        return self._clean_svg_for_drawio(response.text)
                except requests.RequestException:
                    pass

            return None

        except Exception as e:
            self.logger.warning(f"Failed to fetch icon {icon_ref}: {str(e)}")
            return None

    def _clean_svg_for_drawio(self, svg_content: str) -> str:
        """Clean SVG content for use in Draw.io."""
        try:
            import urllib.parse

            # Remove XML declaration if present
            svg_content = re.sub(r'<\?xml[^>]*\?>', '', svg_content)

            # Remove comments
            svg_content = re.sub(r'<!--.*?-->', '', svg_content, flags=re.DOTALL)

            # Convert to data URI
            encoded_svg = urllib.parse.quote(svg_content.strip())
            return f"data:image/svg+xml,{encoded_svg}"

        except Exception as e:
            self.logger.warning(f"Failed to clean SVG: {str(e)}")
            return svg_content

    def _wrap_as_drawio(self, mx_xml: str) -> str:
        """Wrap mxGraphModel XML in Draw.io format."""
        import urllib.parse

        # URL encode the mxGraphModel XML
        encoded_xml = urllib.parse.quote(mx_xml)

        # Create the final Draw.io XML structure
        drawio_xml = f'<mxfile host="Electron" modified="2024-01-01T00:00:00.000Z" agent="5.0" version="22.1.16" etag="XYZ123" type="device"><diagram id="PAGE-1" name="Page-1">{encoded_xml}</diagram></mxfile>'

        return drawio_xml

    def _escape_xml(self, text: str) -> str:
        """Escape text for XML content."""
        import html
        return html.escape(text)
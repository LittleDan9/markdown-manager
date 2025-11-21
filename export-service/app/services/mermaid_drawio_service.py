"""
Mermaid to Draw.io conversion service for converting Mermaid diagrams to Draw.io XML format.

This service handles:
- Parsing Mermaid source code to extract nodes and edges
- Extracting SVG positioning from rendered content
- Fetching and cleaning SVG icons from icon service
- Generating Draw.io XML with proper mxGraphModel structure
- PNG embedding with XML metadata for editable files

Based on the enhanced conversion logic from mermaid_to_drawio_fresh.
"""

import html
import io
import logging
import re
import urllib.parse
from typing import Dict, List, Tuple, Optional, Any
from xml.etree import ElementTree as ET

import requests
from PIL import Image
from PIL.PngImagePlugin import PngInfo

logger = logging.getLogger(__name__)


class MermaidDrawioService:
    """Service for converting Mermaid diagrams to Draw.io format."""

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

        Args:
            mermaid_source: Raw Mermaid source code
            svg_content: Rendered SVG content
            icon_service_url: Optional icon service URL for fetching icons
            width: Canvas width
            height: Canvas height
            is_dark_mode: Whether to use dark mode styling

        Returns:
            Tuple of (Draw.io XML string, conversion metadata)
        """
        try:
            self.logger.info("Starting Mermaid to Draw.io XML conversion")

            # Parse Mermaid source to extract nodes and edges
            mermaid_nodes, mermaid_edges = await self.parse_mermaid_source(mermaid_source)
            self.logger.info(f"Parsed {len(mermaid_nodes)} nodes and {len(mermaid_edges)} edges from Mermaid source")

            # Extract positions from rendered SVG
            svg_positions = await self.extract_svg_positions(svg_content)
            self.logger.info(f"Extracted positions for {len(svg_positions)} nodes from SVG")

            # Build Draw.io XML
            drawio_xml, conversion_metadata = await self.build_drawio_xml(
                mermaid_nodes, mermaid_edges, svg_positions, icon_service_url, width, height
            )

            # Prepare metadata with conversion statistics
            metadata = {
                "original_nodes": len(mermaid_nodes),
                "original_edges": len(mermaid_edges),
                "positioned_nodes": len(svg_positions),
                "canvas_width": width,
                "canvas_height": height,
                "icon_service_url": icon_service_url,
                "dark_mode": is_dark_mode,
                # Add conversion statistics
                "nodes_converted": conversion_metadata['nodes_converted'],
                "edges_converted": conversion_metadata['edges_converted'],
                "icons_attempted": conversion_metadata['icons_attempted'],
                "icons_successful": conversion_metadata['icons_successful'],
                "icon_success_rate": conversion_metadata['icon_success_rate']
            }

            self.logger.info("Mermaid to Draw.io XML conversion completed")
            return drawio_xml, metadata

        except Exception as e:
            self.logger.error(f"Mermaid to Draw.io XML conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert Mermaid to Draw.io XML: {str(e)}")

    async def convert_mermaid_to_drawio_png(
        self,
        mermaid_source: str,
        svg_content: str,
        icon_service_url: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        transparent_background: bool = True,
        is_dark_mode: bool = False
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Convert Mermaid content to Draw.io editable PNG format.

        Args:
            mermaid_source: Raw Mermaid source code
            svg_content: Rendered SVG content
            icon_service_url: Optional icon service URL for fetching icons
            width: Optional image width
            height: Optional image height
            transparent_background: Whether to use transparent background
            is_dark_mode: Whether to use dark mode styling

        Returns:
            Tuple of (PNG bytes with embedded XML, conversion metadata)
        """
        try:
            self.logger.info("Starting Mermaid to Draw.io PNG conversion")

            # First, convert to XML
            drawio_xml, xml_metadata = await self.convert_mermaid_to_drawio_xml(
                mermaid_source, svg_content, icon_service_url, width or 1000, height or 600, is_dark_mode
            )

            # Convert SVG to PNG
            png_data = await self._convert_svg_to_png(svg_content, width, height, transparent_background)

            # Embed XML in PNG metadata
            editable_png = await self.embed_xml_in_png(drawio_xml, png_data)

            # Prepare metadata
            metadata = {
                **xml_metadata,
                "png_size": len(editable_png),
                "transparent_background": transparent_background,
                "embedded_xml": True
            }

            self.logger.info("Mermaid to Draw.io PNG conversion completed")
            return editable_png, metadata

        except Exception as e:
            self.logger.error(f"Mermaid to Draw.io PNG conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert Mermaid to Draw.io PNG: {str(e)}")

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

    def _parse_transform_translate(self, transform_str: str) -> Tuple[float, float]:
        """Parse SVG transform attribute to extract translation."""
        if not transform_str:
            return (0.0, 0.0)

        m = re.search(r'translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', transform_str)
        return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)

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

        # Default size for icon nodes
        return 80.0, 80.0, -40.0, -40.0

    async def fetch_icon_svg(self, icon_ref: str, icon_service_url: str) -> Optional[str]:
        """Fetch the SVG for an icon from the icon service."""
        if not icon_service_url or not icon_ref:
            return None

        try:
            # Parse icon reference: "network:firewall" -> pack="network", id="firewall"
            if ':' not in icon_ref:
                return None

            pack, icon_id = icon_ref.split(':', 1)

            # Construct URL to fetch raw SVG
            url = f"{icon_service_url}/api/icons/packs/{pack}/contents/{icon_id}/raw"

            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                # Clean and prepare the SVG for Draw.io
                svg_content = self._clean_svg_for_drawio(response.text)
                # Use percent-encoded SVG (no base64, no semicolons)
                payload = urllib.parse.quote(svg_content, safe='')  # FULLY encoded
                return f"data:image/svg+xml,{payload}"  # no ;base64

        except Exception as e:
            self.logger.warning(f"Could not fetch icon {icon_ref}: {e}")

        return None

    def _clean_svg_for_drawio(self, svg_content: str) -> str:
        """Clean SVG content to make it compatible with Draw.io."""
        # Create a minimal, clean SVG by extracting just the path elements
        # Find all path elements
        paths = re.findall(r'<path[^>]*d="[^"]*"[^>]*>', svg_content)

        if not paths:
            # Fallback to simple shape if no paths found
            return ('<svg width="24" height="24" viewBox="0 0 24 24">'
                    '<rect x="2" y="6" width="20" height="12" '
                    'fill=\"#d94723\" stroke=\"#e1e1e1\" stroke-width=\"1\"/></svg>')

        # Create a clean SVG with just the essential paths
        clean_paths = []
        for path in paths:
            # Clean up the path by removing problematic attributes
            clean_path = re.sub(r'\s+(?:inkscape|sodipodi):[^=]*="[^"]*"', '', path)
            clean_paths.append(clean_path)

        # Construct minimal, hardened SVG for Draw.io compatibility
        svg_header = '<svg width="80" height="80" viewBox="0 0 161.47 100.69" xmlns="http://www.w3.org/2000/svg">'
        svg_footer = '</svg>'

        # Add transform group to position correctly
        group_start = '<g transform="translate(-630.34 -504.88)">'
        group_end = '</g>'

        clean_svg = svg_header + group_start + ''.join(clean_paths) + group_end + svg_footer

        return clean_svg

    async def build_drawio_xml(
        self,
        mermaid_nodes: Dict[str, Any],
        mermaid_edges: List[Dict[str, Any]],
        svg_positions: Dict[str, Dict[str, float]],
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600
    ) -> Tuple[str, Dict[str, Any]]:
        """Build Draw.io XML using both mermaid source and SVG positioning."""
        try:
            # Initialize tracking variables
            icons_attempted = 0
            icons_successful = 0
            nodes_converted = 0
            edges_converted = 0

            # Create root mxGraphModel element
            root = ET.Element('mxGraphModel',
                              dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                              connect='1', arrows='1', fold='1', page='1', pageScale='1',
                              pageWidth=str(width), pageHeight=str(height), math='0', shadow='0')

            root_el = ET.SubElement(root, 'root')
            ET.SubElement(root_el, 'mxCell', id='0')
            ET.SubElement(root_el, 'mxCell', id='1', parent='0')

            # Create nodes
            x_offset = 100  # For nodes without SVG positions
            for i, (node_id, node_info) in enumerate(mermaid_nodes.items()):
                label = node_info['label']

                # Get position from SVG, use calculated defaults if not found
                if node_id in svg_positions:
                    pos = svg_positions[node_id]
                else:
                    # Calculate position for nodes not in SVG
                    pos = {'x': x_offset + (i * 150), 'y': 100, 'w': 80, 'h': 50}
                    self.logger.debug(f"Using calculated position for {node_id}: {pos}")

                # Determine style based on whether node has icon
                if node_info['hasIcon'] and node_info['icon'] and icon_service_url:
                    # Try to fetch clean icon SVG
                    icons_attempted += 1
                    icon_svg = await self.fetch_icon_svg(node_info['icon'], icon_service_url)
                    if icon_svg:
                        icons_successful += 1
                        # Put image= LAST to avoid semicolon collision in data URI
                        # Position text at bottom center for icon nodes
                        style = "shape=image;imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
                        style += "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
                        style += f"image={html.escape(icon_svg)}"  # image LAST, no trailing ';'
                        # Make icon nodes larger for better visibility
                        pos['w'] = int(max(pos['w'], 80))
                        pos['h'] = int(max(pos['h'], 80))
                    else:
                        # Fallback for failed icon fetch
                        style = "shape=hexagon;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;"
                else:
                    # Regular rectangular node
                    style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"

                # Create the cell
                cell_id = f"node-{node_id}"
                v = ET.SubElement(root_el, 'mxCell', id=cell_id, value=html.escape(label),
                                  style=style, vertex='1', parent='1')
                geo = ET.SubElement(v, 'mxGeometry', x=str(pos['x']), y=str(pos['y']),
                                    width=str(pos['w']), height=str(pos['h']))
                geo.set('as', 'geometry')
                nodes_converted += 1

            # Create edges
            eid = 1000
            for edge in mermaid_edges:
                source_id = f"node-{edge['source']}"
                target_id = f"node-{edge['target']}"

                style = 'endArrow=block;html=1;rounded=0;'
                if edge['dashed']:
                    style += 'dashed=1;dashPattern=3 3;'

                edge_elem = ET.SubElement(root_el, 'mxCell', id=str(eid), style=style,
                                          edge='1', parent='1', source=source_id, target=target_id)
                geo = ET.SubElement(edge_elem, 'mxGeometry', relative='1')
                geo.set('as', 'geometry')
                edges_converted += 1
                eid += 1

            # Convert to XML string and wrap in Draw.io format
            mx_xml = ET.tostring(root, encoding='unicode')
            drawio_xml = self._wrap_as_drawio(mx_xml)

            # Prepare conversion metadata
            conversion_metadata = {
                'nodes_converted': nodes_converted,
                'edges_converted': edges_converted,
                'icons_attempted': icons_attempted,
                'icons_successful': icons_successful,
                'icon_success_rate': (icons_successful / icons_attempted * 100) if icons_attempted > 0 else 100.0
            }

            self.logger.info(f"Draw.io XML built: {nodes_converted} nodes, {edges_converted} edges, "
                             f"{icons_successful}/{icons_attempted} icons")
            return drawio_xml, conversion_metadata

        except Exception as e:
            self.logger.error(f"Failed to build Draw.io XML: {str(e)}")
            raise ValueError(f"Failed to build Draw.io XML: {str(e)}")

    def _wrap_as_drawio(self, mx_xml: str) -> str:
        """Wrap mxGraphModel XML in Draw.io format."""
        mxfile = ET.Element('mxfile', host='app.diagrams.net', version='24.7.5')
        diag = ET.SubElement(mxfile, 'diagram', id='0', name='Page-1')
        diag.append(ET.fromstring(mx_xml))
        return ET.tostring(mxfile, encoding='unicode')

    async def _convert_svg_to_png(
        self,
        svg_content: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        transparent_background: bool = True
    ) -> bytes:
        """Convert SVG content to PNG image."""
        try:
            # Always use Playwright for more consistent results with Mermaid SVGs
            self.logger.info("Using Playwright for SVG to PNG conversion")
            return await self._convert_svg_to_png_playwright(svg_content, width, height, transparent_background)

        except Exception as e:
            self.logger.error(f"Playwright SVG to PNG conversion failed: {str(e)}")

            # Fallback to CairoSVG for simple SVGs
            try:
                import cairosvg
                self.logger.info("Falling back to CairoSVG for PNG conversion")

                # Ensure SVG has proper dimensions
                svg_content_fixed = self._ensure_svg_dimensions(svg_content, width or 800, height or 600)
                png_data = cairosvg.svg2png(
                    bytestring=svg_content_fixed.encode('utf-8'),
                    output_width=width or 800,
                    output_height=height or 600
                )

                return png_data or b''

            except Exception as cairo_error:
                self.logger.error(f"CairoSVG fallback also failed: {str(cairo_error)}")
                # Final fallback to simple PNG
                return await self._create_fallback_png(width or 400, height or 300)

    def _ensure_svg_dimensions(self, svg_content: str, width: int, height: int) -> str:
        """Ensure SVG has proper width and height attributes."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(svg_content, 'xml')
            svg_element = soup.find('svg')

            if svg_element:
                # Ensure width and height attributes exist
                svg_element['width'] = str(width)
                svg_element['height'] = str(height)

                return str(soup)

        except Exception as e:
            self.logger.warning(f"Failed to fix SVG dimensions: {str(e)}")

        return svg_content

    async def _convert_svg_to_png_playwright(
        self,
        svg_content: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        transparent_background: bool = True
    ) -> bytes:
        """Convert SVG to PNG using Playwright."""
        try:
            from playwright.async_api import async_playwright

            self.logger.info("Using Playwright for SVG to PNG conversion")

            async with async_playwright() as p:
                # Launch browser
                browser = await p.chromium.launch()
                page = await browser.new_page()

                # Create HTML with SVG
                bg_color = "transparent" if transparent_background else "white"
                html_content = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {{ margin: 0; padding: 20px; background: {bg_color}; }}
                        svg {{ display: block; margin: 0 auto; }}
                    </style>
                </head>
                <body>
                    {svg_content}
                </body>
                </html>
                """

                # Set content and wait for load
                await page.set_content(html_content)
                await page.wait_for_load_state('networkidle')

                # Get SVG element dimensions
                svg_element = await page.query_selector('svg')
                if not svg_element:
                    raise ValueError("No SVG element found in content")

                # Take screenshot of the SVG element
                png_data = await svg_element.screenshot(
                    type='png'
                )

                await browser.close()
                return png_data

        except Exception as e:
            self.logger.error(f"Playwright SVG to PNG conversion failed: {str(e)}")
            # Create a simple fallback PNG
            return await self._create_fallback_png(width or 400, height or 300)

    async def _create_fallback_png(self, width: int, height: int) -> bytes:
        """Create a simple fallback PNG when conversion fails."""
        try:
            # Create a simple white PNG with error message
            img = Image.new('RGB', (width, height), color='white')

            # Add error text (if PIL supports text drawing)
            try:
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(img)

                # Try to use a default font
                try:
                    font = ImageFont.load_default()
                except Exception:
                    font = None

                text = "Diagram conversion\nrequires SVG content"
                text_bbox = draw.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]

                x = (width - text_width) // 2
                y = (height - text_height) // 2

                draw.text((x, y), text, fill='black', font=font)

            except ImportError:
                # If ImageDraw is not available, just create blank image
                pass

            # Save to bytes
            output = io.BytesIO()
            img.save(output, format='PNG')
            return output.getvalue()

        except Exception as e:
            self.logger.error(f"Failed to create fallback PNG: {str(e)}")
            # Return minimal PNG bytes if everything fails
            return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x90\x00\x00\x01,\x08\x02\x00\x00\x00'

    async def embed_xml_in_png(self, xml_content: str, png_data: bytes) -> bytes:
        """
        Embed Draw.io XML in PNG metadata for editable PNG format.

        Args:
            xml_content: Draw.io XML string
            png_data: PNG image bytes

        Returns:
            PNG bytes with embedded XML metadata
        """
        try:
            self.logger.info("Embedding XML in PNG metadata")

            # Open PNG image
            img = Image.open(io.BytesIO(png_data))

            # Create PNG metadata
            metadata = PngInfo()

            # Embed Draw.io XML in PNG metadata
            # Draw.io uses specific metadata keys
            metadata.add_text("mxGraphModel", xml_content)
            metadata.add_text("Software", "diagrams.net")

            # Save PNG with metadata
            output = io.BytesIO()
            img.save(output, format="PNG", pnginfo=metadata)

            self.logger.info("Successfully embedded XML in PNG metadata")
            return output.getvalue()

        except Exception as e:
            self.logger.error(f"Failed to embed XML in PNG: {str(e)}")
            raise ValueError(f"Failed to embed XML in PNG metadata: {str(e)}")


# Global service instance
mermaid_drawio_service = MermaidDrawioService()

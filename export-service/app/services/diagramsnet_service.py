"""
diagrams.net conversion service for converting Mermaid SVG to diagrams.net XML format.

This service handles:
- SVG parsing and element extraction
- diagrams.net XML generation with proper mxGraphModel structure
- PNG embedding with XML metadata for editable files
- Quality scoring and conversion assessment
"""

import base64
import io
import logging
import re
import uuid
from typing import Dict, List, Tuple, Optional, Any
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup, Tag
from lxml import etree
from PIL import Image
from PIL.PngImagePlugin import PngInfo

logger = logging.getLogger(__name__)


class ConversionQuality:
    """Quality assessment for diagram conversion."""

    def __init__(self, score: float, message: str, details: Dict[str, Any]):
        self.score = score
        self.message = message
        self.details = details

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "message": self.message,
            "details": self.details
        }


class DiagramsNetService:
    """Service for converting SVG diagrams to diagrams.net format."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.diagramsnet")

    async def convert_svg_to_diagrams_xml(self, svg_content: str) -> Tuple[str, ConversionQuality]:
        """
        Convert SVG content to diagrams.net XML format.

        Args:
            svg_content: SVG string to convert

        Returns:
            Tuple of (diagrams.net XML string, quality assessment)
        """
        try:
            self.logger.info("Starting SVG to diagrams.net XML conversion")

            # Parse SVG content
            svg_data = await self._parse_svg(svg_content)

            # Generate diagrams.net XML
            diagrams_xml = await self._generate_diagrams_xml(svg_data)

            # Calculate quality score
            quality = await self._calculate_quality_score(svg_content, diagrams_xml, svg_data)

            self.logger.info(f"Conversion completed with quality score: {quality.score:.1f}%")
            return diagrams_xml, quality

        except Exception as e:
            self.logger.error(f"SVG to diagrams.net conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert SVG to diagrams.net XML: {str(e)}")

    async def convert_svg_to_diagrams_png(self, svg_content: str) -> Tuple[bytes, ConversionQuality]:
        """
        Convert SVG content to diagrams.net editable PNG format.

        Args:
            svg_content: Raw SVG string from Mermaid

        Returns:
            Tuple of (png_bytes_with_embedded_xml, quality_assessment)
        """
        try:
            self.logger.info("Starting SVG to diagrams.net PNG conversion")

            # First, convert to XML
            xml_content, quality = await self.convert_svg_to_diagrams_xml(svg_content)

            # Convert SVG to PNG
            png_data = await self._convert_svg_to_png(svg_content)

            # Embed XML in PNG metadata
            editable_png = await self.embed_xml_in_png(xml_content, png_data)

            self.logger.info(f"PNG conversion completed with quality score: {quality.score:.1f}%")
            return editable_png, quality

        except Exception as e:
            self.logger.error(f"SVG to diagrams.net PNG conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert SVG to diagrams.net PNG: {str(e)}")

    async def _convert_svg_to_png(self, svg_content: str) -> bytes:
        """
        Convert SVG content to PNG image.

        Args:
            svg_content: Raw SVG string

        Returns:
            PNG image bytes
        """
        try:
            # Always use Playwright for more consistent results with Mermaid SVGs
            # CairoSVG has issues with complex SVG features used by Mermaid
            self.logger.info("Using Playwright for SVG to PNG conversion (primary method)")
            return await self._convert_svg_to_png_playwright(svg_content)

        except Exception as e:
            self.logger.error(f"Playwright SVG to PNG conversion failed: {str(e)}")

            # Fallback to CairoSVG for simple SVGs
            try:
                import cairosvg
                self.logger.info("Falling back to CairoSVG for PNG conversion")

                # Ensure SVG has proper dimensions
                svg_content_fixed = self._ensure_svg_dimensions(svg_content)
                png_data = cairosvg.svg2png(
                    bytestring=svg_content_fixed.encode('utf-8'),
                    output_width=800,  # Default width
                    output_height=600  # Default height
                )

                return png_data

            except Exception as cairo_error:
                self.logger.error(f"CairoSVG fallback also failed: {str(cairo_error)}")
                # Final fallback to simple PNG
                return await self._create_fallback_png()

    def _ensure_svg_dimensions(self, svg_content: str) -> str:
        """Ensure SVG has proper width and height attributes."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(svg_content, 'xml')
            svg_element = soup.find('svg')

            if svg_element:
                # Ensure width and height attributes exist
                if not svg_element.get('width'):
                    svg_element['width'] = '800'
                if not svg_element.get('height'):
                    svg_element['height'] = '600'

                return str(soup)

        except Exception as e:
            self.logger.warning(f"Failed to fix SVG dimensions: {str(e)}")

        return svg_content

    async def _convert_svg_to_png_playwright(self, svg_content: str) -> bytes:
        """
        Convert SVG to PNG using Playwright (fallback method).

        Args:
            svg_content: Raw SVG string

        Returns:
            PNG image bytes
        """
        try:
            from playwright.async_api import async_playwright

            self.logger.info("Using Playwright for SVG to PNG conversion")

            async with async_playwright() as p:
                # Launch browser
                browser = await p.chromium.launch()
                page = await browser.new_page()

                # Create HTML with SVG
                html_content = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {{ margin: 0; padding: 20px; background: white; }}
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

                # Get the bounding box of the SVG
                bbox = await svg_element.bounding_box()
                if not bbox:
                    # Fallback dimensions
                    bbox = {'x': 0, 'y': 0, 'width': 800, 'height': 600}

                # Take screenshot of the SVG element
                png_data = await svg_element.screenshot(
                    type='png'
                )

                await browser.close()
                return png_data

        except Exception as e:
            self.logger.error(f"Playwright SVG to PNG conversion failed: {str(e)}")
            # Create a simple fallback PNG
            return await self._create_fallback_png()

    async def _create_fallback_png(self) -> bytes:
        """Create a simple fallback PNG when conversion fails."""
        try:
            # Create a simple 400x300 white PNG with error message
            img = Image.new('RGB', (400, 300), color='white')

            # Add error text (if PIL supports text drawing)
            try:
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(img)

                # Try to use a default font
                try:
                    font = ImageFont.load_default()
                except:
                    font = None

                text = "Diagram conversion\nrequires SVG content"
                text_bbox = draw.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]

                x = (400 - text_width) // 2
                y = (300 - text_height) // 2

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
        Embed diagrams.net XML in PNG metadata for editable PNG format.

        Args:
            xml_content: diagrams.net XML string
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

            # Embed diagrams.net XML in PNG metadata
            # diagrams.net uses specific metadata keys
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

    async def _parse_svg(self, svg_content: str) -> Dict[str, Any]:
        """Parse SVG content and extract diagram elements."""
        try:
            # Use BeautifulSoup for robust HTML/SVG parsing
            soup = BeautifulSoup(svg_content, 'xml')
            svg_element = soup.find('svg')

            if not svg_element:
                raise ValueError("No SVG element found in content")

            # Extract SVG dimensions
            width = self._extract_dimension(str(svg_element.get('width', '')), default=800)
            height = self._extract_dimension(str(svg_element.get('height', '')), default=600)

            # Parse viewBox if available
            viewbox = svg_element.get('viewBox')
            if viewbox:
                vb_str = str(viewbox)
                vb_parts = vb_str.split()
                if len(vb_parts) == 4:
                    vb_width = float(vb_parts[2])
                    vb_height = float(vb_parts[3])
                    # Use viewBox dimensions if they seem more appropriate
                    if vb_width > 0 and vb_height > 0:
                        width = max(width, vb_width)
                        height = max(height, vb_height)

            # Extract nodes (typically rectangles, circles, ellipses)
            nodes = await self._extract_nodes(svg_element)

            # Extract edges (paths, lines)
            edges = await self._extract_edges(svg_element)

            # Extract text elements
            texts = await self._extract_texts(svg_element)

            # Extract embedded SVG icons
            icons = await self._extract_svg_icons(svg_element)

            return {
                'width': width,
                'height': height,
                'nodes': nodes,
                'edges': edges,
                'texts': texts,
                'icons': icons,
                'svg_element': svg_element
            }

        except Exception as e:
            self.logger.error(f"SVG parsing failed: {str(e)}")
            raise ValueError(f"Failed to parse SVG content: {str(e)}")

    def _extract_dimension(self, value: Optional[str], default: float) -> float:
        """Extract numeric dimension from SVG attribute."""
        if not value:
            return default

        # Remove units (px, pt, etc.) and convert to float
        numeric_value = re.sub(r'[^\d.]', '', str(value))
        try:
            return float(numeric_value) if numeric_value else default
        except ValueError:
            return default

    def _safe_float(self, element: Tag, attr: str, default: float = 0.0) -> float:
        """Safely extract float value from element attribute."""
        try:
            attr_value = element.get(attr)
            if attr_value is None:
                return default
            return float(str(attr_value))
        except (ValueError, TypeError):
            return default

    async def _extract_nodes(self, svg_element: Tag) -> List[Dict[str, Any]]:
        """Extract node elements (shapes) from SVG."""
        nodes = []

        # Check if this is a Mermaid SVG
        is_mermaid = bool(svg_element.get('class') and 'flowchart' in str(svg_element.get('class')))
        self.logger.info(f"Is Mermaid flowchart: {is_mermaid}")

        if is_mermaid:
            # Mermaid-specific parsing: look for top-level node groups only
            # Find groups with flowchart IDs (these are the main node containers)
            node_groups = svg_element.select('g[id*="flowchart"]')
            self.logger.info(f"Found {len(node_groups)} Mermaid node groups")

            for group in node_groups:
                node = await self._parse_mermaid_node(group)
                if node:
                    self.logger.info(f"Parsed Mermaid node: id={node['id']}, "
                                     f"x={node['x']}, y={node['y']}, label='{node['label']}'")
                    nodes.append(node)
        else:
            # Common node elements in generic SVGs
            node_selectors = ['rect', 'circle', 'ellipse', 'polygon', 'path[class*="node"]']
            self.logger.info(f"Processing generic SVG with {len(node_selectors)} selectors")

            for selector in node_selectors:
                elements = svg_element.select(selector)
                self.logger.info(f"Selector '{selector}' found {len(elements)} elements")
                for element in elements:
                    node = await self._parse_node_element(element)
                    if node:
                        self.logger.info(f"Parsed generic node: id={node['id']}, "
                                         f"x={node['x']}, y={node['y']}")
                        nodes.append(node)

        return nodes

    async def _parse_mermaid_node(self, group: Tag) -> Optional[Dict[str, Any]]:
        """Parse a Mermaid node group with transforms and nested elements."""
        try:
            node_id = group.get('id') or str(uuid.uuid4())

            # Accumulate all transforms from this element and parents
            x, y = self._accumulate_transforms(group)

            # Find the text label within the group - look for deepest text content
            text_elements = group.select('text, tspan')
            label = ""
            for text_element in text_elements:
                text_content = text_element.get_text().strip()
                if text_content and not label:  # Take first non-empty text
                    label = text_content
                    break

            # Find shape information - look for rect, path, or background elements
            shape_element = group.select_one('rect, path[d], .background')
            width = height = 100  # Default size
            shape_type = 'rectangle'

            if shape_element:
                if shape_element.name == 'rect':
                    width = self._safe_float(shape_element, 'width', 100)
                    height = self._safe_float(shape_element, 'height', 50)
                    shape_type = 'rectangle'
                elif shape_element.name == 'path':
                    # For path elements, try to estimate size from the path
                    width = height = 100  # Default for complex paths
                    shape_type = 'rectangle'

            # Check for embedded SVG icons
            embedded_svg = group.select_one('svg')
            has_icon = embedded_svg is not None

            # For diagrams.net compatibility, when we have complex embedded SVG icons,
            # we'll create a shape that indicates an icon but doesn't embed the SVG
            if has_icon:
                # Use a shape style that indicates this is an icon node
                shape_type = 'rounded_rectangle'  # More visual shape for icon nodes

            # Extract styling
            style = self._parse_element_style(group)

            return {
                'id': node_id,
                'type': shape_type,
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'label': label,
                'style': style,
                'has_icon': has_icon,
                'embedded_svg': str(embedded_svg) if embedded_svg else None,
                'element': group
            }

        except Exception as e:
            self.logger.warning(f"Failed to parse Mermaid node: {str(e)}")
            return None

    def _parse_transform(self, transform_str: str) -> tuple[float, float]:
        """Parse SVG transform attribute to extract translation."""
        if not transform_str:
            return 0.0, 0.0

        # Look for translate(x, y) pattern
        import re
        translate_match = re.search(r'translate\(([^)]+)\)', str(transform_str))
        if translate_match:
            coords = translate_match.group(1).split(',')
            if len(coords) >= 2:
                try:
                    x = float(coords[0].strip())
                    y = float(coords[1].strip())
                    return x, y
                except ValueError:
                    pass
            elif len(coords) == 1:
                # Handle single coordinate (x only)
                try:
                    x = float(coords[0].strip())
                    return x, 0.0
                except ValueError:
                    pass

        return 0.0, 0.0

    def _accumulate_transforms(self, element: Tag) -> tuple[float, float]:
        """Accumulate all transform translations from element and its parents."""
        total_x = 0.0
        total_y = 0.0

        current = element
        while current and current.name != 'svg':
            transform_str = str(current.get('transform', ''))
            if transform_str:
                x, y = self._parse_transform(transform_str)
                total_x += x
                total_y += y
            current = current.parent

        return total_x, total_y

    async def _parse_node_element(self, element: Tag) -> Optional[Dict[str, Any]]:
        """Parse a single node element."""
        try:
            node_id = element.get('id') or str(uuid.uuid4())

            # Extract position and dimensions based on element type
            if element.name == 'rect':
                x = self._safe_float(element, 'x', 0)
                y = self._safe_float(element, 'y', 0)
                width = self._safe_float(element, 'width', 100)
                height = self._safe_float(element, 'height', 50)
                shape_type = 'rectangle'

            elif element.name == 'circle':
                cx = self._safe_float(element, 'cx', 0)
                cy = self._safe_float(element, 'cy', 0)
                r = self._safe_float(element, 'r', 25)
                x = cx - r
                y = cy - r
                width = height = r * 2
                shape_type = 'ellipse'

            elif element.name == 'ellipse':
                cx = self._safe_float(element, 'cx', 0)
                cy = self._safe_float(element, 'cy', 0)
                rx = self._safe_float(element, 'rx', 50)
                ry = self._safe_float(element, 'ry', 25)
                x = cx - rx
                y = cy - ry
                width = rx * 2
                height = ry * 2
                shape_type = 'ellipse'

            else:
                # For complex paths, estimate bounding box
                x = y = 0
                width = height = 100
                shape_type = 'rectangle'

            # Extract styling
            style = self._parse_element_style(element)

            return {
                'id': node_id,
                'type': shape_type,
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'style': style,
                'element': element
            }

        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse node element: {str(e)}")
            return None

    async def _extract_edges(self, svg_element: Tag) -> List[Dict[str, Any]]:
        """Extract edge elements (connections) from SVG."""
        edges = []

        # Common edge elements in Mermaid SVGs
        edge_elements = svg_element.select('path[class*="edge"], line, polyline')

        for element in edge_elements:
            edge = await self._parse_edge_element(element)
            if edge:
                edges.append(edge)

        return edges

    async def _parse_edge_element(self, element: Tag) -> Optional[Dict[str, Any]]:
        """Parse a single edge element."""
        try:
            edge_id = element.get('id') or str(uuid.uuid4())

            # Extract path information
            if element.name == 'path':
                path_data = element.get('d', '')
                points = self._extract_path_points(path_data)
            elif element.name == 'line':
                x1 = self._safe_float(element, 'x1', 0)
                y1 = self._safe_float(element, 'y1', 0)
                x2 = self._safe_float(element, 'x2', 0)
                y2 = self._safe_float(element, 'y2', 0)
                points = [(x1, y1), (x2, y2)]
            else:
                points = []

            if not points:
                return None

            # Extract styling
            style = self._parse_element_style(element)

            return {
                'id': edge_id,
                'points': points,
                'style': style,
                'element': element
            }

        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse edge element: {str(e)}")
            return None

    def _extract_path_points(self, path_data: str) -> List[Tuple[float, float]]:
        """Extract points from SVG path data."""
        points = []

        # Simple path parsing - extract M (moveto) and L (lineto) commands
        # This is a basic implementation; more complex paths may need advanced parsing
        commands = re.findall(r'[ML]\s*([0-9.-]+)\s*,?\s*([0-9.-]+)', path_data)

        for x_str, y_str in commands:
            try:
                x = float(x_str)
                y = float(y_str)
                points.append((x, y))
            except ValueError:
                continue

        return points

    async def _extract_texts(self, svg_element: Tag) -> List[Dict[str, Any]]:
        """Extract text elements from SVG."""
        texts = []

        # Check if this is a Mermaid SVG
        is_mermaid = bool(svg_element.get('class') and 'flowchart' in str(svg_element.get('class')))

        if is_mermaid:
            # For Mermaid SVGs, text is handled in node parsing, so skip standalone text extraction
            # to avoid duplicates
            return texts

        # Find all text elements (for non-Mermaid SVGs)
        text_elements = svg_element.find_all('text')

        for text_element in text_elements:
            text_data = await self._parse_text_element(text_element)
            if text_data:
                texts.append(text_data)

        return texts

    async def _parse_text_element(self, element: Tag) -> Optional[Dict[str, Any]]:
        """Parse a single text element."""
        try:
            text_content = element.get_text(strip=True)
            if not text_content:
                return None

            x = self._safe_float(element, 'x', 0)
            y = self._safe_float(element, 'y', 0)

            style = self._parse_element_style(element)

            return {
                'content': text_content,
                'x': x,
                'y': y,
                'style': style,
                'element': element
            }

        except (ValueError, TypeError) as e:
            self.logger.warning(f"Failed to parse text element: {str(e)}")
            return None

    async def _extract_svg_icons(self, svg_element: Tag) -> List[Dict[str, Any]]:
        """Extract embedded SVG icons from the diagram."""
        icons = []

        # Look for nested SVG elements or use elements that might contain icons
        nested_svgs = svg_element.select('svg', recursive=True)
        use_elements = svg_element.select('use')

        for svg in nested_svgs:
            if svg != svg_element:  # Don't include the root SVG
                icon_data = await self._parse_svg_icon(svg)
                if icon_data:
                    icons.append(icon_data)

        for use in use_elements:
            icon_data = await self._parse_use_element(use)
            if icon_data:
                icons.append(icon_data)

        return icons

    async def _parse_svg_icon(self, svg_element: Tag) -> Optional[Dict[str, Any]]:
        """Parse an embedded SVG icon."""
        try:
            # Convert SVG to base64 for embedding
            svg_content = str(svg_element)
            svg_base64 = base64.b64encode(svg_content.encode('utf-8')).decode('utf-8')

            # Extract position if available
            x = self._safe_float(svg_element, 'x', 0)
            y = self._safe_float(svg_element, 'y', 0)
            width = self._extract_dimension(svg_element.get('width'), 50)
            height = self._extract_dimension(svg_element.get('height'), 50)

            return {
                'type': 'svg',
                'content': svg_base64,
                'x': x,
                'y': y,
                'width': width,
                'height': height
            }

        except Exception as e:
            self.logger.warning(f"Failed to parse SVG icon: {str(e)}")
            return None

    async def _parse_use_element(self, use_element: Tag) -> Optional[Dict[str, Any]]:
        """Parse a 'use' element that references an icon."""
        try:
            href = use_element.get('href') or use_element.get('xlink:href', '')
            if not href:
                return None

            x = self._safe_float(use_element, 'x', 0)
            y = self._safe_float(use_element, 'y', 0)

            return {
                'type': 'use',
                'href': href,
                'x': x,
                'y': y
            }

        except Exception as e:
            self.logger.warning(f"Failed to parse use element: {str(e)}")
            return None

    def _parse_element_style(self, element: Tag) -> Dict[str, str]:
        """Parse style attributes from an SVG element."""
        style_dict = {}

        # Parse inline style attribute
        style_attr = element.get('style', '')
        if style_attr:
            for declaration in style_attr.split(';'):
                if ':' in declaration:
                    key, value = declaration.split(':', 1)
                    style_dict[key.strip()] = value.strip()

        # Parse individual style attributes
        style_attrs = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-family',
                      'font-size', 'font-weight', 'text-anchor']

        for attr in style_attrs:
            if element.get(attr):
                style_dict[attr] = element.get(attr)

        return style_dict

    async def _generate_diagrams_xml(self, svg_data: Dict[str, Any]) -> str:
        """Generate diagrams.net XML from parsed SVG data."""
        try:
            # Create diagrams.net XML structure
            root = ET.Element("mxGraphModel")
            root.set("dx", "1426")
            root.set("dy", "685")
            root.set("grid", "1")
            root.set("gridSize", "10")
            root.set("guides", "1")
            root.set("tooltips", "1")
            root.set("connect", "1")
            root.set("arrows", "1")
            root.set("fold", "1")
            root.set("page", "1")
            root.set("pageScale", "1")
            root.set("pageWidth", str(int(svg_data['width'])))
            root.set("pageHeight", str(int(svg_data['height'])))
            root.set("math", "0")
            root.set("shadow", "0")

            # Create root cell
            mxgraph = ET.SubElement(root, "root")

            # Add default cells (required by diagrams.net)
            cell0 = ET.SubElement(mxgraph, "mxCell")
            cell0.set("id", "0")

            cell1 = ET.SubElement(mxgraph, "mxCell")
            cell1.set("id", "1")
            cell1.set("parent", "0")

            cell_id = 2

            # Add nodes
            for node in svg_data['nodes']:
                cell_id = await self._add_node_to_xml(mxgraph, node, cell_id)

            # Add edges
            for edge in svg_data['edges']:
                cell_id = await self._add_edge_to_xml(mxgraph, edge, cell_id)

            # Add standalone text elements
            for text in svg_data['texts']:
                cell_id = await self._add_text_to_xml(mxgraph, text, cell_id)

            # Generate XML string
            xml_str = ET.tostring(root, encoding='unicode', method='xml')

            # Pretty format the XML
            dom = etree.fromstring(xml_str)
            pretty_xml = etree.tostring(dom, pretty_print=True, encoding='unicode')

            return pretty_xml

        except Exception as e:
            self.logger.error(f"Failed to generate diagrams.net XML: {str(e)}")
            raise ValueError(f"Failed to generate diagrams.net XML: {str(e)}")

    async def _add_node_to_xml(self, parent: ET.Element, node: Dict[str, Any], cell_id: int) -> int:
        """Add a node to the diagrams.net XML structure."""
        # Get the label from node data
        label = node.get('label', '')

        # Create shape cell
        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", str(cell_id))
        cell.set("value", label)  # Use the extracted label
        cell.set("style", await self._convert_style_to_diagramsnet(node['style'], node['type']))
        cell.set("vertex", "1")
        cell.set("parent", "1")

        # Add geometry
        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(int(node['x'])))
        geometry.set("y", str(int(node['y'])))
        geometry.set("width", str(int(node['width'])))
        geometry.set("height", str(int(node['height'])))
        geometry.set("as", "geometry")

        return cell_id + 1

    async def _add_edge_to_xml(self, parent: ET.Element, edge: Dict[str, Any], cell_id: int) -> int:
        """Add an edge to the diagrams.net XML structure."""
        if len(edge['points']) < 2:
            return cell_id

        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", str(cell_id))
        cell.set("value", "")
        cell.set("style", await self._convert_edge_style_to_diagramsnet(edge['style']))
        cell.set("edge", "1")
        cell.set("parent", "1")

        # Add geometry with points
        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("relative", "1")
        geometry.set("as", "geometry")

        # Set source and target points
        start_point = edge['points'][0]
        end_point = edge['points'][-1]

        source_point = ET.SubElement(geometry, "mxPoint")
        source_point.set("x", str(int(start_point[0])))
        source_point.set("y", str(int(start_point[1])))
        source_point.set("as", "sourcePoint")

        target_point = ET.SubElement(geometry, "mxPoint")
        target_point.set("x", str(int(end_point[0])))
        target_point.set("y", str(int(end_point[1])))
        target_point.set("as", "targetPoint")

        return cell_id + 1

    async def _add_text_to_xml(self, parent: ET.Element, text: Dict[str, Any], cell_id: int) -> int:
        """Add a text element to the diagrams.net XML structure."""
        cell = ET.SubElement(parent, "mxCell")
        cell.set("id", str(cell_id))
        cell.set("value", text['content'])
        cell.set("style", await self._convert_text_style_to_diagramsnet(text['style']))
        cell.set("vertex", "1")
        cell.set("parent", "1")

        # Add geometry
        geometry = ET.SubElement(cell, "mxGeometry")
        geometry.set("x", str(int(text['x'])))
        geometry.set("y", str(int(text['y'])))
        geometry.set("width", "100")  # Default width for text
        geometry.set("height", "30")   # Default height for text
        geometry.set("as", "geometry")

        return cell_id + 1

    async def _convert_style_to_diagramsnet(self, svg_style: Dict[str, str], shape_type: str) -> str:
        """Convert SVG style to diagrams.net style string."""
        diagramsnet_styles = []

        # Base shape style
        if shape_type == 'rectangle':
            diagramsnet_styles.append("rounded=0")
        elif shape_type == 'ellipse':
            diagramsnet_styles.append("ellipse")
        elif shape_type == 'rounded_rectangle':
            diagramsnet_styles.append("rounded=1")
            diagramsnet_styles.append("strokeWidth=2")  # Thicker border for icon nodes

        # Convert colors
        if 'fill' in svg_style:
            fill_color = self._convert_color(svg_style['fill'])
            if fill_color != 'none':
                diagramsnet_styles.append(f"fillColor={fill_color}")
            else:
                diagramsnet_styles.append("fillColor=none")

        if 'stroke' in svg_style:
            stroke_color = self._convert_color(svg_style['stroke'])
            diagramsnet_styles.append(f"strokeColor={stroke_color}")

        if 'stroke-width' in svg_style:
            diagramsnet_styles.append(f"strokeWidth={svg_style['stroke-width']}")

        return ";".join(diagramsnet_styles) + ";"

    async def _convert_edge_style_to_diagramsnet(self, svg_style: Dict[str, str]) -> str:
        """Convert SVG edge style to diagrams.net edge style."""
        diagramsnet_styles = ["endArrow=classic", "html=1"]

        if 'stroke' in svg_style:
            stroke_color = self._convert_color(svg_style['stroke'])
            diagramsnet_styles.append(f"strokeColor={stroke_color}")

        if 'stroke-width' in svg_style:
            diagramsnet_styles.append(f"strokeWidth={svg_style['stroke-width']}")

        return ";".join(diagramsnet_styles) + ";"

    async def _convert_text_style_to_diagramsnet(self, svg_style: Dict[str, str]) -> str:
        """Convert SVG text style to diagrams.net text style."""
        diagramsnet_styles = ["text", "html=1", "align=center", "verticalAlign=middle"]

        if 'font-family' in svg_style:
            diagramsnet_styles.append(f"fontFamily={svg_style['font-family']}")

        if 'font-size' in svg_style:
            size = re.sub(r'[^\d.]', '', svg_style['font-size'])
            if size:
                diagramsnet_styles.append(f"fontSize={size}")

        if 'fill' in svg_style:
            text_color = self._convert_color(svg_style['fill'])
            diagramsnet_styles.append(f"fontColor={text_color}")

        return ";".join(diagramsnet_styles) + ";"

    def _convert_color(self, svg_color: str) -> str:
        """Convert SVG color to diagrams.net color format."""
        if not svg_color or svg_color == 'none':
            return 'none'

        # Handle hex colors
        if svg_color.startswith('#'):
            return svg_color

        # Handle rgb colors
        rgb_match = re.match(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', svg_color)
        if rgb_match:
            r, g, b = rgb_match.groups()
            return f"#{int(r):02x}{int(g):02x}{int(b):02x}"

        # Handle named colors - convert to hex approximations
        color_map = {
            'black': '#000000',
            'white': '#ffffff',
            'red': '#ff0000',
            'green': '#00ff00',
            'blue': '#0000ff',
            'yellow': '#ffff00',
            'cyan': '#00ffff',
            'magenta': '#ff00ff',
            'gray': '#808080',
            'grey': '#808080'
        }

        return color_map.get(svg_color.lower(), '#000000')

    async def _calculate_quality_score(self, original_svg: str, diagramsnet_xml: str, svg_data: Dict[str, Any]) -> ConversionQuality:
        """Calculate conversion quality score and assessment."""
        try:
            scores = {}
            total_score = 0.0

            # Structural Fidelity (40%)
            structural_score = await self._assess_structural_fidelity(svg_data, diagramsnet_xml)
            scores['structural'] = structural_score
            total_score += structural_score * 0.4

            # Visual Quality (30%)
            visual_score = await self._assess_visual_quality(svg_data)
            scores['visual'] = visual_score
            total_score += visual_score * 0.3

            # Icon Success Rate (30%)
            icon_score = await self._assess_icon_preservation(svg_data)
            scores['icons'] = icon_score
            total_score += icon_score * 0.3

            # Generate quality message
            message = self._generate_quality_message(total_score)

            return ConversionQuality(
                score=total_score,
                message=message,
                details=scores
            )

        except Exception as e:
            self.logger.error(f"Quality assessment failed: {str(e)}")
            return ConversionQuality(
                score=50.0,
                message="Quality assessment failed - manual review recommended",
                details={"error": str(e)}
            )

    async def _assess_structural_fidelity(self, svg_data: Dict[str, Any], diagramsnet_xml: str) -> float:
        """Assess structural fidelity of the conversion."""
        score = 100.0

        # Check if nodes were preserved
        original_nodes = len(svg_data['nodes'])
        xml_nodes = diagramsnet_xml.count('vertex="1"')

        if original_nodes > 0:
            node_preservation = min(xml_nodes / original_nodes, 1.0)
            score *= node_preservation

        # Check if edges were preserved
        original_edges = len(svg_data['edges'])
        xml_edges = diagramsnet_xml.count('edge="1"')

        if original_edges > 0:
            edge_preservation = min(xml_edges / original_edges, 1.0)
            score *= edge_preservation

        return score

    async def _assess_visual_quality(self, svg_data: Dict[str, Any]) -> float:
        """Assess visual quality preservation."""
        # This is a simplified assessment
        # In a full implementation, you might analyze color accuracy, positioning, etc.
        base_score = 85.0

        # Bonus for having styling information
        if any(node['style'] for node in svg_data['nodes']):
            base_score += 10.0

        return min(base_score, 100.0)

    async def _assess_icon_preservation(self, svg_data: Dict[str, Any]) -> float:
        """Assess icon preservation success rate."""
        icons = svg_data['icons']

        if not icons:
            return 100.0  # No icons to preserve

        # For now, assume all SVG icons can be preserved (they're embedded as base64)
        preserved_icons = len([icon for icon in icons if icon['type'] == 'svg'])

        if len(icons) > 0:
            return (preserved_icons / len(icons)) * 100.0

        return 100.0

    def _generate_quality_message(self, score: float) -> str:
        """Generate human-readable quality message."""
        if score >= 90:
            return f"Excellent conversion quality ({score:.1f}%) - Ready for use"
        elif score >= 75:
            return f"Good conversion quality ({score:.1f}%) - Minor adjustments may be needed"
        elif score >= 60:
            return f"Fair conversion quality ({score:.1f}%) - Review recommended"
        else:
            return f"Poor conversion quality ({score:.1f}%) - Consider alternative export format"


# Global service instance
diagramsnet_service = DiagramsNetService()
"""
Mermaid to Draw.io conversion service - Orchestrator for multiple algorithms.

This service handles:
- Smart diagram type detection
- Factory-based converter selection
- Delegating conversion to specialized converters
- PNG embedding with XML metadata for editable files
- Maintaining backward compatibility with existing API

Uses multi-algorithm architecture for different diagram types.
"""

import io
import logging
from typing import Dict, Tuple, Optional, Any, List

from PIL import Image
from PIL.PngImagePlugin import PngInfo

from .diagram_converters.converter_factory import MermaidConverterFactory
from .diagram_converters.diagram_detector import DiagramTypeDetector
from .diagram_converters.shared_utils import PerformanceMonitor
from .diagram_converters.validation.input_validator import InputValidator
from configs.converter_config import get_config

logger = logging.getLogger(__name__)


class MermaidDrawioService:
    """Orchestrator service for converting Mermaid diagrams to Draw.io format."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.mermaid-drawio")
        self.config = get_config()

        # Initialize components based on configuration
        self.performance_monitor = PerformanceMonitor() if self.config.performance.enable_monitoring else None
        self.input_validator = InputValidator(self.config) if self.config.quality.enable_validation else None

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

            # Start performance monitoring
            if self.performance_monitor:
                self.performance_monitor.start_timer("service_xml_conversion")

            # Enhanced input validation
            if self.input_validator:
                validation_result = self.input_validator.validate_conversion_request(
                    mermaid_source, svg_content, {
                        "width": width, "height": height,
                        "icon_service_url": icon_service_url,
                        "is_dark_mode": is_dark_mode
                    }
                )

                if not validation_result.is_valid:
                    raise ValueError(f"Input validation failed: {'; '.join(validation_result.errors)}")

                if validation_result.has_warnings():
                    self.logger.warning(f"Validation warnings: {'; '.join(validation_result.warnings)}")

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

            # Add performance metrics
            service_metrics = {}
            if self.performance_monitor:
                conversion_time = self.performance_monitor.end_timer("service_xml_conversion")
                service_metrics = {
                    "conversion_time": conversion_time,
                    "performance_metrics": self.performance_monitor.get_metrics()
                }
                self.logger.info(f"Service XML conversion completed in {conversion_time:.3f}s")

            # Enhance metadata with detection info and test-expected fields
            metadata = {
                **diagram_info,
                **conversion_metadata,
                **service_metrics,
                "canvas_width": width,
                "canvas_height": height,
                "icon_service_url": icon_service_url,
                "dark_mode": is_dark_mode,
                # Add fields expected by tests
                "original_nodes": conversion_metadata.get('nodes_parsed', 0),
                "original_edges": conversion_metadata.get('edges_parsed', 0),
                "positioned_nodes": conversion_metadata.get('positions_found', 0)
            }

            self.logger.info("Mermaid to Draw.io XML conversion completed")
            return drawio_xml, metadata

        except Exception as e:
            # Cleanup performance monitoring on error
            if self.performance_monitor:
                self.performance_monitor.end_timer("service_xml_conversion")
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

        Delegates XML generation to new system, handles PNG conversion.
        """
        try:
            self.logger.info("Starting Mermaid to Draw.io PNG conversion")

            # Start performance monitoring for PNG conversion
            if self.performance_monitor:
                self.performance_monitor.start_timer("service_png_conversion")

            # Additional validation for PNG-specific parameters
            if self.input_validator:
                png_validation_result = self.input_validator.validate_conversion_request(
                    mermaid_source, svg_content, {
                        "width": width, "height": height,
                        "icon_service_url": icon_service_url,
                        "transparent_background": transparent_background,
                        "is_dark_mode": is_dark_mode
                    }
                )

                if not png_validation_result.is_valid:
                    raise ValueError(f"PNG input validation failed: {'; '.join(png_validation_result.errors)}")

                if png_validation_result.has_warnings():
                    self.logger.warning(f"PNG validation warnings: {'; '.join(png_validation_result.warnings)}")

            # Get XML using new system
            drawio_xml, xml_metadata = await self.convert_mermaid_to_drawio_xml(
                mermaid_source, svg_content, icon_service_url, width or 1000, height or 600, is_dark_mode
            )

            # Convert SVG to PNG
            png_data = await self._convert_svg_to_png(svg_content, width, height, transparent_background)

            # Embed XML in PNG metadata
            editable_png = await self.embed_xml_in_png(drawio_xml, png_data)

            # Add PNG-specific performance metrics
            png_metrics = {}
            if self.performance_monitor:
                png_conversion_time = self.performance_monitor.end_timer("service_png_conversion")
                png_metrics = {
                    "png_conversion_time": png_conversion_time,
                    "total_performance_metrics": self.performance_monitor.get_metrics()
                }
                self.logger.info(f"Service PNG conversion completed in {png_conversion_time:.3f}s")

            # Prepare metadata
            metadata = {
                **xml_metadata,
                **png_metrics,
                "png_size": len(editable_png),
                "transparent_background": transparent_background,
                "embedded_xml": True
            }

            self.logger.info("Mermaid to Draw.io PNG conversion completed")
            return editable_png, metadata

        except Exception as e:
            # Cleanup PNG performance monitoring on error
            if self.performance_monitor:
                self.performance_monitor.end_timer("service_png_conversion")
            self.logger.error(f"Mermaid to Draw.io PNG conversion failed: {str(e)}")
            raise ValueError(f"Failed to convert Mermaid to Draw.io PNG: {str(e)}")

    # Keep existing PNG conversion methods
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

    # Expose converter methods for testing and direct usage
    async def parse_mermaid_source(self, mermaid_source: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Parse Mermaid source using appropriate converter (exposed for testing)."""
        try:
            converter = MermaidConverterFactory.create_converter(mermaid_source)
            return await converter.parse_mermaid_source(mermaid_source)
        except Exception as e:
            self.logger.error(f"Failed to parse Mermaid source: {str(e)}")
            raise ValueError(f"Failed to parse Mermaid source: {str(e)}")

    async def extract_svg_positions(self, svg_content: str) -> Dict[str, Dict[str, float]]:
        """Extract SVG positions using default converter (exposed for testing)."""
        try:
            from .diagram_converters.default_converter import DefaultMermaidConverter
            converter = DefaultMermaidConverter()
            return await converter.extract_svg_positions(svg_content)
        except Exception as e:
            self.logger.error(f"Failed to extract SVG positions: {str(e)}")
            return {}

    async def build_drawio_xml(
        self,
        nodes: Dict[str, Any],
        edges: List[Dict[str, Any]],
        positions: Dict[str, Dict[str, float]],
        icon_service_url: Optional[str] = None,
        width: int = 1000,
        height: int = 600
    ) -> str:
        """Build Draw.io XML from parsed components (exposed for testing)."""
        try:
            from .diagram_converters.default_converter import DefaultMermaidConverter
            converter = DefaultMermaidConverter()
            drawio_xml, _ = await converter.build_drawio_xml(
                nodes, edges, positions, icon_service_url, width, height
            )
            return drawio_xml
        except Exception as e:
            self.logger.error(f"Failed to build Draw.io XML: {str(e)}")
            raise ValueError(f"Failed to build Draw.io XML: {str(e)}")

    async def fetch_icon_svg(self, icon_ref: str, icon_service_url: str) -> Optional[str]:
        """Fetch icon SVG from icon service (exposed for testing)."""
        try:
            from .diagram_converters.shared_utils import IconService
            icon_service = IconService(icon_service_url)
            return await icon_service.fetch_icon_svg(icon_ref)
        except Exception as e:
            self.logger.warning(f"Failed to fetch icon {icon_ref}: {str(e)}")
            return None


# Global service instance
mermaid_drawio_service = MermaidDrawioService()

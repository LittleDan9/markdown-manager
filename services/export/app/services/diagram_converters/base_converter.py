"""Base converter class for Mermaid to Draw.io conversion."""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any
from xml.etree import ElementTree as ET

from .validation.input_validator import InputValidator, ValidationResult
from .shared_utils import PerformanceMonitor
from configs.converter_config import get_config


class BaseMermaidConverter(ABC):
    """Abstract base class for Mermaid diagram converters."""

    def __init__(self):
        self.logger = logging.getLogger(f"export-service.{self.__class__.__name__.lower()}")
        self.config = get_config()

        # Initialize validation and monitoring components
        self.validator = InputValidator(self.config) if self.config.quality.enable_validation else None
        self.performance_monitor = PerformanceMonitor() if self.config.performance.enable_monitoring else None

    def _validate_conversion_inputs(
        self, mermaid_source: str, svg_content: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None
    ) -> ValidationResult:
        """Validate inputs before conversion with comprehensive checks."""
        # Production safety: Always require validation in production environment
        if self.config.is_production() and not self.validator:
            raise ValueError("Input validation is required in production environment but validator is not initialized")

        if not self.validator:
            # Only allow skipping validation in development/testing
            self.logger.warning("Input validation is disabled - only safe in development environment")
            return ValidationResult(
                is_valid=True, errors=[], warnings=[],
                metadata={"validation_enabled": False, "environment": self.config.environment}
            )

        self.logger.debug("Performing comprehensive input validation")

        # Critical security checks before detailed validation
        if not mermaid_source or not mermaid_source.strip():
            return ValidationResult(
                is_valid=False, errors=["Mermaid source is empty or missing"],
                warnings=[], metadata={"security_check": "failed"}
            )

        # Check for potential security risks in input
        if len(mermaid_source) > self.config.quality.max_source_length:
            return ValidationResult(
                is_valid=False, errors=[f"Input too large: {len(mermaid_source)} > {self.config.quality.max_source_length}"],
                warnings=[], metadata={"security_check": "size_limit_exceeded"}
            )

        validation_result = self.validator.validate_conversion_request(
            mermaid_source, svg_content, parameters
        )

        if not validation_result.is_valid:
            self.logger.warning(f"Input validation failed: {'; '.join(validation_result.errors)}")
        elif validation_result.has_warnings():
            self.logger.info(f"Input validation warnings: {'; '.join(validation_result.warnings)}")
        else:
            self.logger.debug("Input validation passed")

        return validation_result

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

            # Start performance monitoring
            if self.performance_monitor:
                self.performance_monitor.start_timer("converter_total_time")

            # Step 0: Comprehensive Input Validation
            validation_result = self._validate_conversion_inputs(
                mermaid_source, svg_content, {
                    "width": width, "height": height,
                    "icon_service_url": icon_service_url,
                    "is_dark_mode": is_dark_mode
                }
            )

            if not validation_result.is_valid:
                raise ValueError(f"Input validation failed: {'; '.join(validation_result.errors)}")

            # Log validation warnings if any
            if validation_result.has_warnings():
                self.logger.warning(f"Validation warnings: {'; '.join(validation_result.warnings)}")

            # Step 1: Parse Mermaid source
            if self.performance_monitor:
                self.performance_monitor.start_timer("parse_mermaid")

            nodes, edges = await self.parse_mermaid_source(mermaid_source)

            if self.performance_monitor:
                parse_time = self.performance_monitor.end_timer("parse_mermaid")
                self.logger.debug(f"Mermaid parsing completed in {parse_time:.3f}s")
            self.logger.info(f"Parsed {len(nodes)} nodes and {len(edges)} edges")

            # Step 2: Extract SVG positions with performance monitoring
            if self.performance_monitor:
                self.performance_monitor.start_timer("extract_svg_positions")

            positions = await self.extract_svg_positions(svg_content)

            if self.performance_monitor:
                extract_time = self.performance_monitor.end_timer("extract_svg_positions")
                self.logger.debug(f"SVG position extraction completed in {extract_time:.3f}s")

            self.logger.info(f"Extracted positions for {len(positions)} nodes")

            # Step 3: Build Draw.io XML with performance monitoring
            if self.performance_monitor:
                self.performance_monitor.start_timer("build_drawio_xml")

            drawio_xml, metadata = await self.build_drawio_xml(
                nodes, edges, positions, icon_service_url, width, height
            )

            if self.performance_monitor:
                build_time = self.performance_monitor.end_timer("build_drawio_xml")
                self.logger.debug(f"Draw.io XML building completed in {build_time:.3f}s")

            # Step 4: Prepare final metadata with performance metrics
            performance_metrics = {}
            if self.performance_monitor:
                total_time = self.performance_monitor.end_timer("converter_total_time")
                performance_metrics = {
                    "converter_total_time": total_time,
                    "performance_breakdown": self.performance_monitor.get_metrics()
                }
                self.logger.info(f"Total conversion time: {total_time:.3f}s")

            final_metadata = {
                "converter_type": self.__class__.__name__,
                "nodes_parsed": len(nodes),
                "edges_parsed": len(edges),
                "positions_found": len(positions),
                "canvas_width": width,
                "canvas_height": height,
                "icon_service_url": icon_service_url,
                "dark_mode": is_dark_mode,
                "validation_metadata": validation_result.metadata,
                **metadata,
                **performance_metrics
            }

            self.logger.info("Conversion completed successfully")
            return drawio_xml, final_metadata

        except Exception as e:
            # Clean up performance monitoring on error
            if self.performance_monitor:
                self.performance_monitor.end_timer("converter_total_time")
                if "parse_mermaid" in str(e):
                    self.performance_monitor.end_timer("parse_mermaid")
                if "extract_svg" in str(e):
                    self.performance_monitor.end_timer("extract_svg_positions")
                if "build_drawio" in str(e):
                    self.performance_monitor.end_timer("build_drawio_xml")

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
            stats: Dict[str, Any] = {
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

"""Shared utilities for diagram converters."""

import asyncio
import html
import logging
import math
import os
import psutil
import re
import time
import urllib.parse
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional, Any, Tuple
from xml.etree import ElementTree as ET

import requests

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

@dataclass
class ConversionMetrics:
    """Metrics collected during conversion process."""
    conversion_time: float
    svg_parse_time: Optional[float] = None
    mermaid_parse_time: Optional[float] = None
    xml_build_time: Optional[float] = None
    icon_fetch_time: Optional[float] = None
    total_nodes: int = 0
    total_edges: int = 0
    icons_fetched: int = 0
    memory_peak: Optional[float] = None
    cache_hits: int = 0
    cache_misses: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for JSON serialization."""
        return {
            "conversion_time": self.conversion_time,
            "svg_parse_time": self.svg_parse_time,
            "mermaid_parse_time": self.mermaid_parse_time,
            "xml_build_time": self.xml_build_time,
            "icon_fetch_time": self.icon_fetch_time,
            "total_nodes": self.total_nodes,
            "total_edges": self.total_edges,
            "icons_fetched": self.icons_fetched,
            "memory_peak": self.memory_peak,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses
        }


class XMLBuilder:
    """Builder class for creating Draw.io XML."""

    def __init__(self, width: int = 1000, height: int = 600):
        self.width = width
        self.height = height
        self.logger = logging.getLogger("export-service.xmlbuilder")

        # Create root mxGraphModel element
        self.root = ET.Element('mxGraphModel',
                               dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                               connect='1', arrows='1', fold='1', page='1', pageScale='1',
                               pageWidth=str(width), pageHeight=str(height), math='0', shadow='0')

        self.root_el = ET.SubElement(self.root, 'root')
        ET.SubElement(self.root_el, 'mxCell', id='0')
        ET.SubElement(self.root_el, 'mxCell', id='1', parent='0')

        self.edge_id = 1000

    def add_node(self, node_id: str, label: str, position: Dict[str, float], icon_data: Optional[str] = None):
        """Add a node to the XML structure."""
        try:
            # Determine style based on whether node has icon
            if icon_data:
                # Put image= LAST to avoid semicolon collision in data URI
                # Position text at bottom center for icon nodes
                style = "shape=image;imageBackground=none;imageBorder=none;whiteSpace=wrap;html=1;"
                style += "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
                style += f"image={html.escape(icon_data)}"  # image LAST, no trailing ';'
                # Make icon nodes larger for better visibility
                position['w'] = max(position.get('w', 80), 80)
                position['h'] = max(position.get('h', 80), 80)
            else:
                # Regular rectangular node
                style = "shape=rectangle;rounded=2;whiteSpace=wrap;html=1;"

            # Create the cell
            cell_id = f"node-{node_id}"
            v = ET.SubElement(self.root_el, 'mxCell', id=cell_id, value=html.escape(label),
                              style=style, vertex='1', parent='1')
            geo = ET.SubElement(v, 'mxGeometry', x=str(position['x']), y=str(position['y']),
                                width=str(position['w']), height=str(position['h']))
            geo.set('as', 'geometry')

        except Exception as e:
            self.logger.error(f"Failed to add node {node_id}: {str(e)}")

    def add_edge(self, source_id: str, target_id: str, dashed: bool = False):
        """Add an edge to the XML structure."""
        try:
            source_cell_id = f"node-{source_id}"
            target_cell_id = f"node-{target_id}"

            style = 'endArrow=block;html=1;rounded=0;'
            if dashed:
                style += 'dashed=1;dashPattern=3 3;'

            edge_elem = ET.SubElement(self.root_el, 'mxCell', id=str(self.edge_id), style=style,
                                      edge='1', parent='1', source=source_cell_id, target=target_cell_id)
            geo = ET.SubElement(edge_elem, 'mxGeometry', relative='1')
            geo.set('as', 'geometry')
            self.edge_id += 1

        except Exception as e:
            self.logger.error(f"Failed to add edge {source_id}->{target_id}: {str(e)}")

    def build_xml(self) -> str:
        """Build and return the complete Draw.io XML."""
        try:
            # Convert to XML string and wrap in Draw.io format
            mx_xml = ET.tostring(self.root, encoding='unicode')
            return self._wrap_as_drawio(mx_xml)
        except Exception as e:
            self.logger.error(f"Failed to build XML: {str(e)}")
            return self._create_minimal_xml()

    def _wrap_as_drawio(self, mx_xml: str) -> str:
        """Wrap mxGraphModel XML in Draw.io format."""
        mxfile = ET.Element('mxfile', host='app.diagrams.net', version='24.7.5')
        diag = ET.SubElement(mxfile, 'diagram', id='0', name='Page-1')
        diag.append(ET.fromstring(mx_xml))
        return ET.tostring(mxfile, encoding='unicode')

    def _create_minimal_xml(self) -> str:
        """Create minimal valid Draw.io XML as fallback."""
        return '''<mxfile host="app.diagrams.net" version="24.7.5">
  <diagram id="0" name="Page-1">
    <mxGraphModel dx="1466" dy="827" grid="1" gridSize="10" guides="1" tooltips="1"
                  connect="1" arrows="1" fold="1" page="1" pageScale="1"
                  pageWidth="1000" pageHeight="600" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'''


class IconService:
    """Service for fetching and processing icons."""

    def __init__(self, icon_service_url: Optional[str] = None):
        self.icon_service_url = icon_service_url
        self.logger = logging.getLogger("export-service.iconservice")

    async def fetch_icon_svg(self, icon_ref: str) -> Optional[str]:
        """Fetch the SVG for an icon from the icon service."""
        if not self.icon_service_url or not icon_ref:
            return None

        try:
            # Parse icon reference: "network:firewall" -> pack="network", id="firewall"
            if ':' not in icon_ref:
                return None

            pack, icon_id = icon_ref.split(':', 1)

            # Construct URL to fetch raw SVG
            url = f"{self.icon_service_url}/api/icons/packs/{pack}/contents/{icon_id}/raw"

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


class PerformanceMonitor:
    """Monitor performance and resource usage during conversion."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.performance")
        self.metrics = {}
        self.start_times = {}
        self.memory_start = None

    def start_timer(self, operation: str):
        """Start timing an operation."""
        self.start_times[operation] = time.time()
        if operation == "conversion" and self.memory_start is None:
            try:
                process = psutil.Process(os.getpid())
                self.memory_start = process.memory_info().rss / 1024 / 1024  # MB
            except Exception:
                self.memory_start = None

    def end_timer(self, operation: str) -> float:
        """End timing and return duration."""
        if operation in self.start_times:
            duration = time.time() - self.start_times[operation]
            self.metrics[f"{operation}_time"] = duration
            del self.start_times[operation]
            return duration
        else:
            self.logger.warning(f"No start time found for operation: {operation}")
            return 0.0

    def record_metric(self, name: str, value: Any):
        """Record a performance metric."""
        self.metrics[name] = value

    def get_peak_memory(self) -> Optional[float]:
        """Get peak memory usage since start."""
        if self.memory_start is None:
            return None

        try:
            process = psutil.Process(os.getpid())
            current_memory = process.memory_info().rss / 1024 / 1024  # MB
            return current_memory - self.memory_start
        except Exception:
            return None

    def get_metrics(self) -> Dict[str, Any]:
        """Get all recorded metrics."""
        # Add current memory usage if available
        memory_peak = self.get_peak_memory()
        if memory_peak is not None:
            self.metrics["memory_peak"] = memory_peak

        return self.metrics.copy()

    def log_performance_summary(self):
        """Log performance summary."""
        metrics = self.get_metrics()
        self.logger.info(
            f"Performance Summary: "
            f"conversion_time={metrics.get('conversion_time', 0):.3f}s, "
            f"nodes={metrics.get('total_nodes', 0)}, "
            f"edges={metrics.get('total_edges', 0)}, "
            f"icons={metrics.get('icons_fetched', 0)}, "
            f"memory_peak={metrics.get('memory_peak', 0):.1f}MB"
        )

    def reset(self):
        """Reset all metrics and timers."""
        self.metrics.clear()
        self.start_times.clear()
        self.memory_start = None


# Utility functions for shared use

@lru_cache(maxsize=1000)
def clean_node_id(node_id: str) -> str:
    """Clean and normalize node IDs for consistent processing."""
    # Remove special characters and normalize
    cleaned = node_id.strip().replace(' ', '_').replace('-', '_')
    # Remove any non-alphanumeric characters except underscore
    cleaned = ''.join(c for c in cleaned if c.isalnum() or c == '_')
    return cleaned.lower()


def calculate_optimal_positions(nodes: Dict[str, Any], edges: List[Dict[str, Any]],
                              canvas_width: int = 1000, canvas_height: int = 600) -> Dict[str, Dict[str, float]]:
    """Calculate optimal positions for nodes based on graph structure."""
    if not nodes:
        return {}

    # Simple grid layout for now - can be enhanced with more sophisticated algorithms
    node_ids = list(nodes.keys())
    node_count = len(node_ids)

    # Calculate grid dimensions
    cols = max(1, int(math.ceil(math.sqrt(node_count))))
    rows = max(1, int(math.ceil(node_count / cols)))

    # Calculate spacing
    margin = 50
    node_width = 120  # Default node width
    node_height = 100  # Default node height

    x_spacing = (canvas_width - 2 * margin) / max(1, cols - 1) if cols > 1 else 0
    y_spacing = (canvas_height - 2 * margin) / max(1, rows - 1) if rows > 1 else 0

    positions = {}
    for i, node_id in enumerate(node_ids):
        row = i // cols
        col = i % cols

        x = margin + col * x_spacing if cols > 1 else canvas_width // 2 - node_width // 2
        y = margin + row * y_spacing if rows > 1 else canvas_height // 2 - node_height // 2

        # Adjust for node type if available
        node = nodes[node_id]
        if node.get('type') == 'service':
            w, h = 120, 100
        elif node.get('type') == 'group':
            w, h = 200, 150
        elif node.get('type') == 'junction':
            w, h = 20, 20
        else:
            w, h = 80, 80

        positions[node_id] = {'x': x, 'y': y, 'w': w, 'h': h}

    return positions


def validate_xml_structure(xml_content: str) -> Tuple[bool, List[str]]:
    """Validate Draw.io XML structure and return any issues found."""
    errors = []

    try:
        # Parse XML
        root = ET.fromstring(xml_content)

        # Check for required mxfile structure
        if root.tag != 'mxfile':
            errors.append("Root element should be 'mxfile'")

        # Check for diagram element
        diagram = root.find('diagram')
        if diagram is None:
            errors.append("Missing 'diagram' element")
        else:
            # Check for mxGraphModel in diagram text or child
            if diagram.text and 'mxGraphModel' in diagram.text:
                pass  # Text content format
            elif diagram.find('.//mxGraphModel') is not None:
                pass  # Child element format
            else:
                errors.append("Missing 'mxGraphModel' in diagram content")

        # Basic validation passed
        return len(errors) == 0, errors

    except ET.ParseError as e:
        errors.append(f"XML parsing error: {str(e)}")
        return False, errors
    except Exception as e:
        errors.append(f"Validation error: {str(e)}")
        return False, errors

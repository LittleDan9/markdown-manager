# Phase 3: Integration, Testing & Production Deployment

## Overview

Complete the multi-algorithm architecture by integrating all components, implementing comprehensive testing, optimizing performance, and preparing for production deployment. This phase ensures robustness, reliability, and production readiness.

## 🎯 Phase Objectives

- Complete integration of all converter components
- Implement comprehensive testing strategy
- Optimize performance for production workloads
- Add monitoring and observability
- Prepare deployment configurations
- Ensure backward compatibility and error handling

## 🏗️ Architecture Overview

### Building on Previous Phases

**Phase 1**: Foundation with factory pattern and base classes
**Phase 2A**: Enhanced SVG processing for architecture diagrams
**Phase 2B**: Mermaid source parsing for architecture syntax

### Phase 3 Additions

```text
export-service/
├── app/services/diagram_converters/
│   ├── monitoring/           # NEW: Performance monitoring
│   ├── validation/          # NEW: Input validation
│   ├── optimization/        # NEW: Performance optimization
│   └── shared_utils.py      # NEW: Shared utilities
├── tests/
│   ├── integration/         # NEW: Integration tests
│   ├── performance/         # NEW: Performance tests
│   └── e2e/                # NEW: End-to-end tests
└── configs/
    └── converter_config.py  # NEW: Configuration management
```

## 🔧 Implementation Details

### 1. Shared Utilities (`shared_utils.py`)

```python
"""Shared utilities for all diagram converters."""

import asyncio
import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from xml.etree import ElementTree as ET
from dataclasses import dataclass
import html
import urllib.parse
import requests

@dataclass
class ConversionMetrics:
    """Metrics collected during conversion process."""
    conversion_time: float
    svg_parse_time: float
    mermaid_parse_time: float
    xml_build_time: float
    icon_fetch_time: float
    total_nodes: int
    total_edges: int
    icons_fetched: int
    memory_peak: Optional[float] = None

class XMLBuilder:
    """Utility class for building Draw.io XML structures."""

    def __init__(self, width: int = 1000, height: int = 600, version: str = "24.7.5"):
        self.width = width
        self.height = height
        self.version = version
        self.logger = logging.getLogger("export-service.xml-builder")
        self.cells = []
        self.cell_id_counter = 2  # Start after root cells (0, 1)

    def create_root(self) -> ET.Element:
        """Create root mxGraphModel element."""
        root = ET.Element('mxGraphModel',
                          dx='1466', dy='827', grid='1', gridSize='10', guides='1', tooltips='1',
                          connect='1', arrows='1', fold='1', page='1', pageScale='1',
                          pageWidth=str(self.width), pageHeight=str(self.height),
                          math='0', shadow='0')

        root_el = ET.SubElement(root, 'root')
        ET.SubElement(root_el, 'mxCell', id='0')
        ET.SubElement(root_el, 'mxCell', id='1', parent='0')

        return root, root_el

    def add_node(
        self,
        node_id: str,
        label: str,
        position: Dict[str, float],
        style: str,
        parent_id: str = '1'
    ) -> str:
        """Add a node to the XML structure."""
        cell_id = f"node-{node_id}"

        cell_data = {
            'id': cell_id,
            'value': html.escape(label),
            'style': style,
            'vertex': '1',
            'parent': parent_id,
            'geometry': {
                'x': str(position['x']),
                'y': str(position['y']),
                'width': str(position['w']),
                'height': str(position['h']),
                'as': 'geometry'
            }
        }

        self.cells.append(cell_data)
        return cell_id

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        style: str,
        parent_id: str = '1'
    ) -> str:
        """Add an edge to the XML structure."""
        edge_id = str(self.cell_id_counter)
        self.cell_id_counter += 1

        edge_data = {
            'id': edge_id,
            'style': style,
            'edge': '1',
            'parent': parent_id,
            'source': source_id,
            'target': target_id,
            'geometry': {'relative': '1', 'as': 'geometry'}
        }

        self.cells.append(edge_data)
        return edge_id

    def build_xml(self) -> str:
        """Build final XML string."""
        root, root_el = self.create_root()

        # Add all cells to XML
        for cell_data in self.cells:
            cell = ET.SubElement(root_el, 'mxCell')

            # Set attributes
            for key, value in cell_data.items():
                if key != 'geometry':
                    cell.set(key, value)

            # Add geometry if present
            if 'geometry' in cell_data:
                geometry = ET.SubElement(cell, 'mxGeometry')
                for geo_key, geo_value in cell_data['geometry'].items():
                    geometry.set(geo_key, geo_value)

        # Convert to string and wrap in Draw.io format
        mx_xml = ET.tostring(root, encoding='unicode')
        return self._wrap_as_drawio(mx_xml)

    def _wrap_as_drawio(self, mx_xml: str) -> str:
        """Wrap mxGraphModel XML in Draw.io format."""
        mxfile = ET.Element('mxfile', host='app.diagrams.net', version=self.version)
        diagram = ET.SubElement(mxfile, 'diagram', id='0', name='Page-1')
        diagram.append(ET.fromstring(mx_xml))
        return ET.tostring(mxfile, encoding='unicode')

class IconService:
    """Service for fetching and processing icons."""

    def __init__(self, base_url: Optional[str]):
        self.base_url = base_url
        self.logger = logging.getLogger("export-service.icon-service")
        self.cache = {}  # Simple in-memory cache

    async def fetch_icon_svg(self, icon_ref: str) -> Optional[str]:
        """Fetch SVG icon with caching."""
        if not self.base_url or not icon_ref:
            return None

        # Check cache first
        if icon_ref in self.cache:
            return self.cache[icon_ref]

        try:
            # Parse icon reference: "network:firewall" -> pack="network", id="firewall"
            if ':' not in icon_ref:
                return None

            pack, icon_id = icon_ref.split(':', 1)
            url = f"{self.base_url}/api/icons/packs/{pack}/contents/{icon_id}/raw"

            start_time = time.time()
            response = requests.get(url, timeout=5)
            fetch_time = time.time() - start_time

            if response.status_code == 200:
                # Clean and prepare the SVG for Draw.io
                svg_content = self._clean_svg_for_drawio(response.text)
                # Use percent-encoded SVG
                payload = urllib.parse.quote(svg_content, safe='')
                icon_data = f"data:image/svg+xml,{payload}"

                # Cache result
                self.cache[icon_ref] = icon_data

                self.logger.debug(f"Fetched icon {icon_ref} in {fetch_time:.3f}s")
                return icon_data

        except Exception as e:
            self.logger.warning(f"Could not fetch icon {icon_ref}: {e}")

        return None

    def _clean_svg_for_drawio(self, svg_content: str) -> str:
        """Clean SVG content for Draw.io compatibility."""
        # Find all path elements
        import re
        paths = re.findall(r'<path[^>]*d="[^"]*"[^>]*>', svg_content)

        if not paths:
            # Fallback to simple shape if no paths found
            return ('<svg width="24" height="24" viewBox="0 0 24 24">'
                    '<rect x="2" y="6" width="20" height="12" '
                    'fill="#d94723" stroke="#e1e1e1" stroke-width="1"/></svg>')

        # Create clean SVG with essential paths
        clean_paths = []
        for path in paths:
            # Remove problematic attributes
            clean_path = re.sub(r'\s+(?:inkscape|sodipodi):[^=]*="[^"]*"', '', path)
            clean_paths.append(clean_path)

        # Construct minimal SVG
        svg_header = '<svg width="80" height="80" viewBox="0 0 161.47 100.69" xmlns="http://www.w3.org/2000/svg">'
        svg_footer = '</svg>'
        group_start = '<g transform="translate(-630.34 -504.88)">'
        group_end = '</g>'

        return svg_header + group_start + ''.join(clean_paths) + group_end + svg_footer

class PerformanceMonitor:
    """Monitor performance and resource usage during conversion."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.performance")
        self.metrics = {}
        self.start_times = {}

    def start_timer(self, operation: str):
        """Start timing an operation."""
        self.start_times[operation] = time.time()

    def end_timer(self, operation: str) -> float:
        """End timing and return duration."""
        if operation in self.start_times:
            duration = time.time() - self.start_times[operation]
            self.metrics[f"{operation}_time"] = duration
            del self.start_times[operation]
            return duration
        return 0.0

    def record_metric(self, name: str, value: Any):
        """Record a performance metric."""
        self.metrics[name] = value

    def get_metrics(self) -> Dict[str, Any]:
        """Get all recorded metrics."""
        return self.metrics.copy()

    def log_performance_summary(self):
        """Log performance summary."""
        total_time = self.metrics.get('total_conversion_time', 0)
        node_count = self.metrics.get('nodes_processed', 0)
        edge_count = self.metrics.get('edges_processed', 0)

        self.logger.info(
            f"Conversion completed in {total_time:.3f}s: "
            f"{node_count} nodes, {edge_count} edges "
            f"({(node_count + edge_count) / max(total_time, 0.001):.1f} items/sec)"
        )
```

### 2. Configuration Management (`configs/converter_config.py`)

```python
"""Configuration management for diagram converters."""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"

@dataclass
class PerformanceConfig:
    """Performance-related configuration."""
    enable_monitoring: bool = True
    enable_caching: bool = True
    max_cache_size: int = 1000
    icon_fetch_timeout: float = 5.0
    max_concurrent_icons: int = 10
    svg_parse_timeout: float = 30.0

@dataclass
class QualityConfig:
    """Quality and validation configuration."""
    enable_validation: bool = True
    max_nodes: int = 1000
    max_edges: int = 2000
    max_source_length: int = 100000  # 100KB
    min_confidence_threshold: float = 0.6

@dataclass
class ConverterConfig:
    """Main configuration for diagram converters."""
    # Environment
    environment: str = "development"
    debug_mode: bool = False
    log_level: LogLevel = LogLevel.INFO

    # Services
    icon_service_url: Optional[str] = None
    enable_icon_fetching: bool = True

    # Performance
    performance: PerformanceConfig = None

    # Quality
    quality: QualityConfig = None

    # Feature flags
    enable_architecture_diagrams: bool = True
    enable_flowchart_diagrams: bool = True
    enable_default_fallback: bool = True

    def __post_init__(self):
        if self.performance is None:
            self.performance = PerformanceConfig()
        if self.quality is None:
            self.quality = QualityConfig()

class ConfigManager:
    """Manages configuration from environment and defaults."""

    @classmethod
    def from_environment(cls) -> ConverterConfig:
        """Create configuration from environment variables."""
        config = ConverterConfig()

        # Environment settings
        config.environment = os.getenv("ENVIRONMENT", "development")
        config.debug_mode = os.getenv("DEBUG_MODE", "false").lower() == "true"
        config.log_level = LogLevel(os.getenv("LOG_LEVEL", "INFO"))

        # Service URLs
        config.icon_service_url = os.getenv("ICON_SERVICE_URL")
        config.enable_icon_fetching = os.getenv("ENABLE_ICON_FETCHING", "true").lower() == "true"

        # Performance settings
        config.performance.enable_monitoring = os.getenv("ENABLE_PERFORMANCE_MONITORING", "true").lower() == "true"
        config.performance.enable_caching = os.getenv("ENABLE_CACHING", "true").lower() == "true"
        config.performance.icon_fetch_timeout = float(os.getenv("ICON_FETCH_TIMEOUT", "5.0"))

        # Quality settings
        config.quality.enable_validation = os.getenv("ENABLE_VALIDATION", "true").lower() == "true"
        config.quality.max_nodes = int(os.getenv("MAX_NODES", "1000"))
        config.quality.max_edges = int(os.getenv("MAX_EDGES", "2000"))

        # Feature flags
        config.enable_architecture_diagrams = os.getenv("ENABLE_ARCHITECTURE_DIAGRAMS", "true").lower() == "true"
        config.enable_flowchart_diagrams = os.getenv("ENABLE_FLOWCHART_DIAGRAMS", "true").lower() == "true"

        return config

    @classmethod
    def for_testing(cls) -> ConverterConfig:
        """Create configuration optimized for testing."""
        config = ConverterConfig()
        config.environment = "testing"
        config.debug_mode = True
        config.log_level = LogLevel.DEBUG
        config.performance.enable_monitoring = False
        config.performance.enable_caching = False
        config.quality.enable_validation = True
        return config

    @classmethod
    def for_production(cls) -> ConverterConfig:
        """Create configuration optimized for production."""
        config = cls.from_environment()
        config.environment = "production"
        config.debug_mode = False
        config.log_level = LogLevel.INFO
        config.performance.enable_monitoring = True
        config.performance.enable_caching = True
        config.quality.enable_validation = True
        return config
```

### 3. Input Validation (`validation/input_validator.py`)

```python
"""Input validation for diagram conversion requests."""

import re
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class ValidationError(Exception):
    """Raised when input validation fails."""
    pass

@dataclass
class ValidationResult:
    """Result of input validation."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    metadata: Dict[str, any]

class InputValidator:
    """Validates input for diagram conversion."""

    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger("export-service.input-validator")

    def validate_conversion_request(
        self,
        mermaid_source: str,
        svg_content: str,
        **kwargs
    ) -> ValidationResult:
        """Validate a complete conversion request."""
        errors = []
        warnings = []
        metadata = {}

        # Validate Mermaid source
        mermaid_result = self.validate_mermaid_source(mermaid_source)
        errors.extend(mermaid_result.errors)
        warnings.extend(mermaid_result.warnings)
        metadata.update(mermaid_result.metadata)

        # Validate SVG content
        svg_result = self.validate_svg_content(svg_content)
        errors.extend(svg_result.errors)
        warnings.extend(svg_result.warnings)
        metadata.update(svg_result.metadata)

        # Validate optional parameters
        param_result = self.validate_parameters(kwargs)
        errors.extend(param_result.errors)
        warnings.extend(param_result.warnings)
        metadata.update(param_result.metadata)

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            metadata=metadata
        )

    def validate_mermaid_source(self, mermaid_source: str) -> ValidationResult:
        """Validate Mermaid source code."""
        errors = []
        warnings = []
        metadata = {
            'source_length': len(mermaid_source) if mermaid_source else 0,
            'line_count': len(mermaid_source.split('\n')) if mermaid_source else 0
        }

        # Check if source is provided
        if not mermaid_source or not mermaid_source.strip():
            errors.append("Mermaid source code is required")
            return ValidationResult(False, errors, warnings, metadata)

        # Check source length
        if len(mermaid_source) > self.config.quality.max_source_length:
            errors.append(f"Mermaid source too long: {len(mermaid_source)} > {self.config.quality.max_source_length}")

        # Check for suspicious content
        if self._contains_suspicious_content(mermaid_source):
            warnings.append("Mermaid source contains potentially suspicious content")

        # Estimate complexity
        complexity = self._estimate_complexity(mermaid_source)
        metadata['estimated_complexity'] = complexity

        if complexity['nodes'] > self.config.quality.max_nodes:
            errors.append(f"Too many nodes: {complexity['nodes']} > {self.config.quality.max_nodes}")

        if complexity['edges'] > self.config.quality.max_edges:
            errors.append(f"Too many edges: {complexity['edges']} > {self.config.quality.max_edges}")

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def validate_svg_content(self, svg_content: str) -> ValidationResult:
        """Validate SVG content."""
        errors = []
        warnings = []
        metadata = {
            'svg_length': len(svg_content) if svg_content else 0
        }

        # Check if SVG is provided
        if not svg_content or not svg_content.strip():
            errors.append("SVG content is required")
            return ValidationResult(False, errors, warnings, metadata)

        # Check if it looks like valid SVG
        if not svg_content.strip().startswith('<svg'):
            errors.append("Content does not appear to be valid SVG")

        # Check for basic SVG structure
        if '<svg' not in svg_content or '</svg>' not in svg_content:
            errors.append("SVG content is missing required svg tags")

        # Check for suspicious content in SVG
        if self._contains_suspicious_svg_content(svg_content):
            warnings.append("SVG content contains potentially suspicious elements")

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def validate_parameters(self, params: Dict) -> ValidationResult:
        """Validate optional parameters."""
        errors = []
        warnings = []
        metadata = {}

        # Validate dimensions
        width = params.get('width', 1000)
        height = params.get('height', 600)

        if not isinstance(width, int) or width <= 0 or width > 10000:
            errors.append(f"Invalid width: {width}. Must be between 1 and 10000")

        if not isinstance(height, int) or height <= 0 or height > 10000:
            errors.append(f"Invalid height: {height}. Must be between 1 and 10000")

        # Validate icon service URL
        icon_url = params.get('icon_service_url')
        if icon_url and not self._is_valid_url(icon_url):
            warnings.append(f"Icon service URL appears invalid: {icon_url}")

        metadata['validated_params'] = list(params.keys())

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def _contains_suspicious_content(self, content: str) -> bool:
        """Check for potentially suspicious content in Mermaid source."""
        suspicious_patterns = [
            r'<script',
            r'javascript:',
            r'vbscript:',
            r'data:text/html',
            r'eval\s*\(',
            r'function\s*\(',
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True

        return False

    def _contains_suspicious_svg_content(self, svg_content: str) -> bool:
        """Check for potentially suspicious content in SVG."""
        suspicious_patterns = [
            r'<script',
            r'<foreignObject',
            r'javascript:',
            r'data:text/html',
            r'xlink:href\s*=\s*["\'](?!data:image)',  # External links
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, svg_content, re.IGNORECASE):
                return True

        return False

    def _estimate_complexity(self, mermaid_source: str) -> Dict[str, int]:
        """Estimate diagram complexity from source."""
        # Count potential nodes and edges using simple patterns

        # Node patterns (very rough estimates)
        node_patterns = [
            r'\b[A-Za-z0-9_-]+\[',  # Node with brackets
            r'\b[A-Za-z0-9_-]+\(',  # Node with parentheses
            r'service\s+\w+',       # Architecture services
            r'group\s+\w+',         # Architecture groups
            r'junction\s+\w+',      # Architecture junctions
        ]

        nodes = set()
        for pattern in node_patterns:
            matches = re.findall(pattern, mermaid_source)
            for match in matches:
                # Extract node name
                node_name = re.sub(r'[^\w-].*', '', match)
                if node_name:
                    nodes.add(node_name)

        # Edge patterns
        edge_patterns = [
            r'-->',
            r'<--',
            r'<-->',
            r'---',
            r'-\.-',
        ]

        edge_count = 0
        for pattern in edge_patterns:
            edge_count += len(re.findall(pattern, mermaid_source))

        return {
            'nodes': len(nodes),
            'edges': edge_count
        }

    def _is_valid_url(self, url: str) -> bool:
        """Basic URL validation."""
        url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
        return bool(re.match(url_pattern, url))
```

### 4. Integration Tests (`tests/integration/test_architecture_integration.py`)

```python
"""Integration tests for architecture diagram conversion."""

import pytest
from unittest.mock import patch, AsyncMock

from app.services.mermaid_drawio_service import MermaidDrawioService
from tests.fixtures.architecture_samples import (
    ARCHITECTURE_COMPLETE,
    ARCHITECTURE_SVG_COMPLETE
)

class TestArchitectureIntegration:
    """Integration tests for complete architecture diagram conversion."""

    @pytest.fixture
    def service(self):
        return MermaidDrawioService()

    @pytest.mark.asyncio
    async def test_complete_architecture_conversion(self, service, mock_icon_service):
        """Test complete architecture diagram conversion end-to-end."""
        # Test with real architecture diagram
        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            mermaid_source=ARCHITECTURE_COMPLETE,
            svg_content=ARCHITECTURE_SVG_COMPLETE,
            icon_service_url="http://localhost:8000",
            width=1200,
            height=800
        )

        # Verify XML structure
        assert "<mxGraphModel" in xml_content
        assert "<mxfile" in xml_content

        # Verify metadata
        assert metadata['converter_type'] == 'ArchitectureMermaidConverter'
        assert metadata['type_name'] == 'architecture'
        assert metadata['nodes_converted'] > 0
        assert metadata['edges_converted'] > 0

        # Verify specific architecture elements
        assert 'service-input' in xml_content or 'input' in xml_content
        assert 'genius' in xml_content  # Group name
        assert 'junctionPBI' in xml_content  # Junction

    @pytest.mark.asyncio
    async def test_architecture_with_icons(self, service, mock_icon_service):
        """Test architecture diagram with icon fetching."""
        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            mermaid_source=ARCHITECTURE_COMPLETE,
            svg_content=ARCHITECTURE_SVG_COMPLETE,
            icon_service_url="http://localhost:8000"
        )

        # Verify icon fetching attempted
        assert metadata['icons_attempted'] > 0

        # Verify icon success rate calculated
        assert 'icon_success_rate' in metadata
        assert 0 <= metadata['icon_success_rate'] <= 100

    @pytest.mark.asyncio
    async def test_architecture_png_conversion(self, service, mock_playwright):
        """Test architecture diagram PNG conversion."""
        png_data, metadata = await service.convert_mermaid_to_drawio_png(
            mermaid_source=ARCHITECTURE_COMPLETE,
            svg_content=ARCHITECTURE_SVG_COMPLETE,
            transparent_background=True
        )

        # Verify PNG data
        assert isinstance(png_data, bytes)
        assert len(png_data) > 0

        # Verify metadata
        assert metadata['embedded_xml'] is True
        assert metadata['transparent_background'] is True
        assert metadata['converter_type'] == 'ArchitectureMermaidConverter'

    @pytest.mark.asyncio
    async def test_performance_monitoring(self, service):
        """Test that performance monitoring works."""
        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            mermaid_source=ARCHITECTURE_COMPLETE,
            svg_content=ARCHITECTURE_SVG_COMPLETE
        )

        # Performance metrics should be included
        expected_metrics = [
            'nodes_converted',
            'edges_converted',
            'canvas_width',
            'canvas_height'
        ]

        for metric in expected_metrics:
            assert metric in metadata

    @pytest.mark.asyncio
    async def test_error_handling(self, service):
        """Test error handling in architecture conversion."""
        # Test with invalid Mermaid source
        with pytest.raises(ValueError) as exc_info:
            await service.convert_mermaid_to_drawio_xml(
                mermaid_source="invalid mermaid content",
                svg_content=ARCHITECTURE_SVG_COMPLETE
            )

        assert "Failed to convert" in str(exc_info.value)

        # Test with invalid SVG
        with pytest.raises(ValueError) as exc_info:
            await service.convert_mermaid_to_drawio_xml(
                mermaid_source=ARCHITECTURE_COMPLETE,
                svg_content="<invalid>svg</invalid>"
            )

        assert "Failed to convert" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_backward_compatibility(self, service):
        """Test that flowchart diagrams still work correctly."""
        flowchart_mermaid = """
        graph TD
            A[Start] --> B{Decision}
            B -->|Yes| C[Process A]
            B -->|No| D[Process B]
            C --> E[End]
            D --> E
        """

        flowchart_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
            <g class="node" id="flowchart-A-0">
                <rect width="80" height="50" x="-40" y="-25"/>
                <text>Start</text>
            </g>
        </svg>'''

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            mermaid_source=flowchart_mermaid,
            svg_content=flowchart_svg
        )

        # Should use flowchart converter
        assert metadata['converter_type'] == 'FlowchartMermaidConverter'
        assert metadata['type_name'] == 'flowchart'

        # Should produce valid XML
        assert "<mxGraphModel" in xml_content
```

### 5. Performance Tests (`tests/performance/test_performance.py`)

```python
"""Performance tests for diagram conversion."""

import pytest
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.services.mermaid_drawio_service import MermaidDrawioService
from tests.fixtures.architecture_samples import ARCHITECTURE_COMPLETE, ARCHITECTURE_SVG_COMPLETE

class TestPerformance:
    """Performance tests for diagram conversion."""

    @pytest.fixture
    def service(self):
        return MermaidDrawioService()

    @pytest.mark.asyncio
    async def test_conversion_performance(self, service):
        """Test conversion performance benchmarks."""
        start_time = time.time()

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            mermaid_source=ARCHITECTURE_COMPLETE,
            svg_content=ARCHITECTURE_SVG_COMPLETE
        )

        end_time = time.time()
        conversion_time = end_time - start_time

        # Performance assertions
        assert conversion_time < 5.0, f"Conversion took {conversion_time:.3f}s, expected < 5.0s"
        assert len(xml_content) > 0

        # Log performance info
        print(f"Conversion time: {conversion_time:.3f}s")
        print(f"Nodes: {metadata.get('nodes_converted', 0)}")
        print(f"Edges: {metadata.get('edges_converted', 0)}")

    @pytest.mark.asyncio
    async def test_concurrent_conversions(self, service):
        """Test multiple concurrent conversions."""
        num_concurrent = 5

        async def single_conversion():
            return await service.convert_mermaid_to_drawio_xml(
                mermaid_source=ARCHITECTURE_COMPLETE,
                svg_content=ARCHITECTURE_SVG_COMPLETE
            )

        start_time = time.time()

        # Run concurrent conversions
        tasks = [single_conversion() for _ in range(num_concurrent)]
        results = await asyncio.gather(*tasks)

        end_time = time.time()
        total_time = end_time - start_time

        # Verify all succeeded
        assert len(results) == num_concurrent
        for xml_content, metadata in results:
            assert len(xml_content) > 0
            assert metadata['nodes_converted'] > 0

        # Performance assertion - should be faster than sequential
        assert total_time < num_concurrent * 2.0, f"Concurrent time {total_time:.3f}s too slow"

        print(f"Concurrent conversions ({num_concurrent}): {total_time:.3f}s")
        print(f"Average per conversion: {total_time / num_concurrent:.3f}s")

    @pytest.mark.asyncio
    async def test_memory_usage(self, service):
        """Test memory usage during conversion."""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Run multiple conversions
        for i in range(10):
            await service.convert_mermaid_to_drawio_xml(
                mermaid_source=ARCHITECTURE_COMPLETE,
                svg_content=ARCHITECTURE_SVG_COMPLETE
            )

            if i % 3 == 0:  # Sample memory usage
                current_memory = process.memory_info().rss / 1024 / 1024
                print(f"Memory after {i+1} conversions: {current_memory:.1f} MB")

        final_memory = process.memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory

        # Memory should not increase excessively
        assert memory_increase < 100, f"Memory increased by {memory_increase:.1f} MB"

        print(f"Initial memory: {initial_memory:.1f} MB")
        print(f"Final memory: {final_memory:.1f} MB")
        print(f"Memory increase: {memory_increase:.1f} MB")
```

## 🚀 Production Deployment Configuration

### Docker Configuration Updates

```dockerfile
# export-service/Dockerfile - Production optimizations
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY pyproject.toml poetry.toml ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --only=main --no-dev

# Copy application code
COPY app/ ./app/

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Environment Configuration

```yaml
# docker-compose.production.yml
version: '3.8'
services:
  export-service:
    build: ./export-service
    environment:
      - ENVIRONMENT=production
      - LOG_LEVEL=INFO
      - ENABLE_PERFORMANCE_MONITORING=true
      - ENABLE_CACHING=true
      - ICON_SERVICE_URL=http://backend:8000
      - MAX_NODES=1000
      - MAX_EDGES=2000
      - ICON_FETCH_TIMEOUT=5.0
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

## ✅ Deployment Checklist

### Pre-Deployment Testing

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Performance tests meet benchmarks
- [ ] Security validation complete
- [ ] Backward compatibility verified
- [ ] Error handling tested
- [ ] Resource usage within limits

### Production Configuration

- [ ] Environment variables configured
- [ ] Logging levels appropriate
- [ ] Monitoring enabled
- [ ] Health checks working
- [ ] Resource limits set
- [ ] Security policies applied

### Monitoring Setup

- [ ] Performance metrics collection
- [ ] Error rate monitoring
- [ ] Resource usage tracking
- [ ] Alert thresholds configured
- [ ] Dashboard created

## 🎯 Success Criteria

- [ ] Complete architecture diagram support functional
- [ ] All existing functionality preserved
- [ ] Performance benchmarks met (< 5s conversion time)
- [ ] Memory usage within acceptable limits (< 100MB increase)
- [ ] Error handling robust and informative
- [ ] Monitoring and observability implemented
- [ ] Production deployment successful
- [ ] Documentation complete and up-to-date

## 📋 Deliverables

1. Complete multi-algorithm architecture
2. Comprehensive test suite (unit, integration, performance)
3. Production configuration and deployment setup
4. Monitoring and observability implementation
5. Documentation and deployment guides
6. Performance benchmarks and optimization
7. Security validation and error handling

## 🔗 Post-Deployment

After successful deployment:

1. Monitor performance metrics and error rates
2. Collect user feedback on architecture diagram support
3. Plan future enhancements (additional diagram types)
4. Document lessons learned and optimization opportunities
5. Consider extending to other Mermaid diagram types (sequence, class, etc.)
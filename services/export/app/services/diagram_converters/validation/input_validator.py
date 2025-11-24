"""Input validation for diagram conversion requests."""

import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from urllib.parse import urlparse

from configs.converter_config import ConverterConfig


class ValidationError(Exception):
    """Raised when input validation fails."""
    pass


@dataclass
class ValidationResult:
    """Result of input validation."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]

    def has_errors(self) -> bool:
        """Check if validation has errors."""
        return len(self.errors) > 0

    def has_warnings(self) -> bool:
        """Check if validation has warnings."""
        return len(self.warnings) > 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "metadata": self.metadata
        }


class InputValidator:
    """Validates input for diagram conversion."""

    def __init__(self, config: ConverterConfig):
        self.config = config
        self.logger = logging.getLogger("export-service.input-validator")

    def validate_conversion_request(
        self,
        mermaid_source: str,
        svg_content: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> ValidationResult:
        """Validate a complete conversion request."""
        errors = []
        warnings = []
        metadata = {}

        # Validate mermaid source
        mermaid_result = self.validate_mermaid_source(mermaid_source)
        errors.extend(mermaid_result.errors)
        warnings.extend(mermaid_result.warnings)
        metadata.update(mermaid_result.metadata)

        # Validate SVG content if provided
        if svg_content:
            svg_result = self.validate_svg_content(svg_content)
            errors.extend(svg_result.errors)
            warnings.extend(svg_result.warnings)
            metadata.update(svg_result.metadata)

        # Validate parameters if provided
        if parameters:
            param_result = self.validate_parameters(parameters)
            errors.extend(param_result.errors)
            warnings.extend(param_result.warnings)
            metadata.update(param_result.metadata)

        # Check overall request complexity
        if metadata.get('estimated_nodes', 0) > self.config.quality.max_nodes:
            errors.append(f"Too many nodes: {metadata['estimated_nodes']} > {self.config.quality.max_nodes}")

        if metadata.get('estimated_edges', 0) > self.config.quality.max_edges:
            errors.append(f"Too many edges: {metadata['estimated_edges']} > {self.config.quality.max_edges}")

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
        metadata = {}

        if not mermaid_source or not mermaid_source.strip():
            errors.append("Mermaid source is empty")
            return ValidationResult(False, errors, warnings, metadata)

        # Check source length
        if len(mermaid_source) > self.config.quality.max_source_length:
            errors.append(f"Mermaid source too long: {len(mermaid_source)} > {self.config.quality.max_source_length}")

        # Check for suspicious content
        if self._contains_suspicious_content(mermaid_source):
            errors.append("Mermaid source contains potentially suspicious content")

        # Estimate complexity
        complexity = self._estimate_complexity(mermaid_source)
        metadata.update(complexity)

        # Check for basic Mermaid syntax
        if not self._has_valid_mermaid_syntax(mermaid_source):
            warnings.append("Source may not contain valid Mermaid syntax")

        # Check for unsupported features
        unsupported = self._detect_unsupported_features(mermaid_source)
        if unsupported:
            warnings.extend([f"Unsupported feature detected: {feature}" for feature in unsupported])

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def validate_svg_content(self, svg_content: str) -> ValidationResult:
        """Validate SVG content."""
        errors = []
        warnings = []
        metadata = {}

        if not svg_content or not svg_content.strip():
            errors.append("SVG content is empty")
            return ValidationResult(False, errors, warnings, metadata)

        # Check if it's valid XML
        try:
            from xml.etree import ElementTree as ET
            ET.fromstring(svg_content)
        except ET.ParseError as e:
            errors.append(f"Invalid SVG XML: {str(e)}")

        # Check for SVG root element
        if not svg_content.strip().startswith('<svg'):
            warnings.append("Content may not be valid SVG (missing <svg> root)")

        # Check for suspicious SVG content
        if self._contains_suspicious_svg_content(svg_content):
            errors.append("SVG content contains potentially suspicious elements")

        # Estimate SVG complexity
        metadata['svg_size'] = len(svg_content)
        metadata['svg_elements'] = len(re.findall(r'<\w+', svg_content))

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def validate_parameters(self, params: Dict[str, Any]) -> ValidationResult:
        """Validate optional parameters."""
        errors = []
        warnings = []
        metadata = {}

        # Validate canvas dimensions
        if 'width' in params:
            try:
                width = int(params['width'])
                if width <= 0 or width > 10000:
                    errors.append(f"Invalid width: {width} (must be 1-10000)")
            except (ValueError, TypeError):
                errors.append("Width must be a valid integer")

        if 'height' in params:
            try:
                height = int(params['height'])
                if height <= 0 or height > 10000:
                    errors.append(f"Invalid height: {height} (must be 1-10000)")
            except (ValueError, TypeError):
                errors.append("Height must be a valid integer")

        # Validate icon service URL if provided
        if 'icon_service_url' in params and params['icon_service_url']:
            if not self._is_valid_url(params['icon_service_url']):
                errors.append("Invalid icon service URL format")

        # Validate output format
        if 'output_format' in params:
            valid_formats = ['xml', 'png', 'svg']
            if params['output_format'] not in valid_formats:
                errors.append(f"Invalid output format: {params['output_format']} (must be one of {valid_formats})")

        return ValidationResult(len(errors) == 0, errors, warnings, metadata)

    def _contains_suspicious_content(self, content: str) -> bool:
        """Check for potentially suspicious content in Mermaid source."""
        suspicious_patterns = [
            r'javascript:',
            r'<script',
            r'eval\s*\(',
            r'document\.',
            r'window\.',
            r'location\.',
            r'\\x[0-9a-fA-F]{2}',  # Hex encoded characters
            r'\\u[0-9a-fA-F]{4}',  # Unicode encoded characters
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True

        return False

    def _contains_suspicious_svg_content(self, svg_content: str) -> bool:
        """Check for potentially suspicious content in SVG."""
        suspicious_patterns = [
            r'<script',
            r'javascript:',
            r'on\w+\s*=',  # Event handlers like onclick, onload
            r'<foreignObject',
            r'<iframe',
            r'<object',
            r'<embed',
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, svg_content, re.IGNORECASE):
                return True

        return False

    def _estimate_complexity(self, mermaid_source: str) -> Dict[str, int]:
        """Estimate diagram complexity from source."""
        # Count different types of elements
        lines = mermaid_source.split('\n')

        # Count nodes (rough estimation)
        node_patterns = [
            r'\b\w+\[.*?\]',  # node[label]
            r'\b\w+\(.*?\)',  # node(label)
            r'\b\w+\{.*?\}',  # node{label}
            r'\bservice\s+\w+',  # architecture services
            r'\bgroup\s+\w+',    # architecture groups
            r'\bjunction\s+\w+', # architecture junctions
        ]

        estimated_nodes = 0
        for pattern in node_patterns:
            estimated_nodes += len(re.findall(pattern, mermaid_source))

        # Count edges (rough estimation)
        edge_patterns = [
            r'-->',
            r'<--',
            r'<-->',
            r'---',
            r'-\.-',
            r'===>',
            r':::',
        ]

        estimated_edges = 0
        for pattern in edge_patterns:
            estimated_edges += len(re.findall(re.escape(pattern), mermaid_source))

        return {
            'estimated_nodes': max(estimated_nodes, 1),  # At least 1 node
            'estimated_edges': estimated_edges,
            'source_lines': len(lines),
            'source_chars': len(mermaid_source)
        }

    def _has_valid_mermaid_syntax(self, content: str) -> bool:
        """Check if content has basic Mermaid syntax indicators."""
        mermaid_indicators = [
            r'^\s*(graph|flowchart|architecture)',
            r'-->',
            r'\[.*?\]',
            r'\(.*?\)',
            r'\{.*?\}',
            r'\bservice\s+\w+',
            r'\bgroup\s+\w+',
        ]

        for pattern in mermaid_indicators:
            if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
                return True

        return False

    def _detect_unsupported_features(self, content: str) -> List[str]:
        """Detect unsupported Mermaid features."""
        unsupported = []

        # Check for diagram types we don't support yet
        unsupported_diagrams = [
            ('sequenceDiagram', r'^\s*sequenceDiagram'),
            ('classDiagram', r'^\s*classDiagram'),
            ('erDiagram', r'^\s*erDiagram'),
            ('gitgraph', r'^\s*gitgraph'),
            ('journey', r'^\s*journey'),
            ('gantt', r'^\s*gantt'),
            ('pie', r'^\s*pie'),
            ('stateDiagram', r'^\s*stateDiagram'),
        ]

        for name, pattern in unsupported_diagrams:
            if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
                unsupported.append(name)

        # Check for complex features
        if re.search(r'subgraph', content, re.IGNORECASE):
            unsupported.append('subgraph (partial support)')

        if re.search(r'click\s+\w+', content, re.IGNORECASE):
            unsupported.append('click events')

        return unsupported

    def _is_valid_url(self, url: str) -> bool:
        """Basic URL validation."""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
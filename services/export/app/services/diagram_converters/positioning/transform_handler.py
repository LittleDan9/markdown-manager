"""Transform accumulation and handling for SVG elements."""

import re
import logging
from typing import Dict
from xml.etree import ElementTree as ET


class TransformHandler:
    """Handles SVG transform accumulation and matrix operations."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.transform-handler")

    def accumulate_transforms(self, element: ET.Element) -> Dict[str, float]:
        """
        Accumulate all transforms from element and its parents.

        Returns combined translation as {x, y, scale_x, scale_y, rotation}
        """
        total_transform = {'x': 0.0, 'y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'rotation': 0.0}

        # Walk up the element tree accumulating transforms
        current = element
        transform_chain = []

        while current is not None:
            transform_attr = current.get('transform')
            if transform_attr:
                transform_chain.append(transform_attr)
                self.logger.debug(f"Found transform: {transform_attr}")

            # Move to parent - handle both ElementTree and lxml Element types
            if hasattr(current, 'getparent'):
                current = current.getparent()
            else:
                # For ElementTree.Element, we need to find parent manually
                # This is a simplified approach - in practice we'd need to track parents
                current = None

        # Apply transforms in reverse order (parent first)
        for transform_str in reversed(transform_chain):
            transform_data = self.parse_transform_string(transform_str)
            total_transform = self.combine_transforms(total_transform, transform_data)

        self.logger.debug(f"Final accumulated transform: {total_transform}")
        return total_transform

    def parse_transform_string(self, transform_str: str) -> Dict[str, float]:
        """
        Parse SVG transform string into components.

        Supports: translate(x,y), scale(x,y), rotate(angle), matrix(...)
        """
        transform_data = {'x': 0.0, 'y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0, 'rotation': 0.0}

        if not transform_str:
            return transform_data

        # Parse translate(x, y)
        translate_match = re.search(r'translate\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)', transform_str)
        if translate_match:
            transform_data['x'] = float(translate_match.group(1))
            transform_data['y'] = float(translate_match.group(2)) if translate_match.group(2) else 0.0

        # Parse scale(x, y) or scale(factor)
        scale_match = re.search(r'scale\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)', transform_str)
        if scale_match:
            scale_x = float(scale_match.group(1))
            scale_y = float(scale_match.group(2)) if scale_match.group(2) else scale_x
            transform_data['scale_x'] = scale_x
            transform_data['scale_y'] = scale_y

        # Parse rotate(angle)
        rotate_match = re.search(r'rotate\(\s*([-\d.]+)\s*\)', transform_str)
        if rotate_match:
            transform_data['rotation'] = float(rotate_match.group(1))

        # Parse matrix(a b c d e f) - extract translation components
        matrix_match = re.search(
            r'matrix\(\s*([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)'
            r'(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)(?:\s+|\s*,\s*)([-\d.]+)\s*\)',
            transform_str
        )
        if matrix_match:
            # Matrix format: matrix(a, b, c, d, e, f)
            # Where e and f are translation components
            transform_data['x'] += float(matrix_match.group(5))  # e
            transform_data['y'] += float(matrix_match.group(6))  # f
            # Could also extract scale and rotation from a,b,c,d but keeping simple for now

        return transform_data

    def combine_transforms(self, base: Dict[str, float], additional: Dict[str, float]) -> Dict[str, float]:
        """Combine two transform dictionaries."""
        return {
            'x': base['x'] + additional['x'] * base['scale_x'],
            'y': base['y'] + additional['y'] * base['scale_y'],
            'scale_x': base['scale_x'] * additional['scale_x'],
            'scale_y': base['scale_y'] * additional['scale_y'],
            'rotation': base['rotation'] + additional['rotation']  # Simple addition for rotation
        }

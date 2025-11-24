"""ViewBox offset handling for accurate SVG positioning."""

import logging
from typing import Dict
from xml.etree import ElementTree as ET


class ViewBoxHandler:
    """Handles SVG viewBox offset calculations."""

    def __init__(self):
        self.logger = logging.getLogger("export-service.viewbox-handler")

    def extract_viewbox_offset(self, root: ET.Element) -> Dict[str, float]:
        """Extract viewBox offset from SVG root element."""
        viewbox_attr = root.get('viewBox')
        if not viewbox_attr:
            return {'offset_x': 0.0, 'offset_y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0}

        try:
            values = viewbox_attr.split()
            if len(values) >= 4:
                viewbox_x = float(values[0])
                viewbox_y = float(values[1])
                viewbox_width = float(values[2])
                viewbox_height = float(values[3])

                # Get actual SVG dimensions
                svg_width = self._get_svg_dimension(root, 'width', viewbox_width)
                svg_height = self._get_svg_dimension(root, 'height', viewbox_height)

                # Calculate scale factors
                scale_x = svg_width / viewbox_width if viewbox_width > 0 else 1.0
                scale_y = svg_height / viewbox_height if viewbox_height > 0 else 1.0

                return {
                    'offset_x': -viewbox_x,
                    'offset_y': -viewbox_y,
                    'scale_x': scale_x,
                    'scale_y': scale_y,
                    'viewbox_width': viewbox_width,
                    'viewbox_height': viewbox_height,
                    'svg_width': svg_width,
                    'svg_height': svg_height
                }

        except (ValueError, IndexError) as e:
            self.logger.warning(f"Failed to parse viewBox '{viewbox_attr}': {str(e)}")

        return {'offset_x': 0.0, 'offset_y': 0.0, 'scale_x': 1.0, 'scale_y': 1.0}

    def _get_svg_dimension(self, root: ET.Element, attr: str, fallback: float) -> float:
        """Get SVG width or height attribute as float."""
        try:
            value = root.get(attr, str(fallback))
            # Remove common units
            value = value.replace('px', '').replace('pt', '').replace('%', '')
            return float(value)
        except ValueError:
            return fallback

    def apply_viewbox_offset(
        self,
        transform: Dict[str, float],
        element_size: Dict[str, float],
        viewbox_offset: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply viewBox offset to element position and size.

        Args:
            transform: Transform data with x, y, scale_x, scale_y
            element_size: Element size with w, h, rx, ry
            viewbox_offset: ViewBox offset data

        Returns:
            Final position dictionary with x, y, w, h
        """
        # Apply viewBox offset to position
        final_x = (transform['x'] + element_size['rx'] + viewbox_offset['offset_x']) * viewbox_offset.get('scale_x', 1.0)
        final_y = (transform['y'] + element_size['ry'] + viewbox_offset['offset_y']) * viewbox_offset.get('scale_y', 1.0)

        # Apply scaling to size
        final_w = element_size['w'] * transform['scale_x'] * viewbox_offset.get('scale_x', 1.0)
        final_h = element_size['h'] * transform['scale_y'] * viewbox_offset.get('scale_y', 1.0)

        return {
            'x': final_x,
            'y': final_y,
            'w': max(final_w, 20),  # Minimum width
            'h': max(final_h, 15),  # Minimum height
        }

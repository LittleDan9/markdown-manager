"""
SVG processing utilities for SVGL
"""
import xml.etree.ElementTree as ET
import re
import logging

logger = logging.getLogger(__name__)


class SvgProcessor:
    """Utilities for processing SVG content"""
    
    @staticmethod
    def extract_body(svg_content: str) -> str:
        """Extract the body content from an SVG (everything inside <svg> tags)"""
        try:
            # Parse the SVG
            root = ET.fromstring(svg_content)

            # Get all content inside the svg tag
            body_parts = []
            for elem in root:
                body_parts.append(ET.tostring(elem, encoding='unicode'))

            return ''.join(body_parts)

        except Exception as e:
            logger.warning(f"Failed to extract SVG body: {e}")
            # Fallback: try to extract manually
            try:
                start = svg_content.find('>') + 1
                end = svg_content.rfind('</')
                if start > 0 and end > start:
                    return svg_content[start:end].strip()
            except Exception:
                pass
            return ""
    
    @staticmethod
    def extract_viewbox(svg_content: str) -> str:
        """Extract viewBox from SVG content"""
        try:
            root = ET.fromstring(svg_content)
            viewbox = root.get('viewBox')

            if viewbox:
                return viewbox

            # Fallback: construct from width/height
            width = root.get('width', '24')
            height = root.get('height', '24')

            # Clean numeric values
            width_num = re.sub(r'[^\d.]', '', str(width))
            height_num = re.sub(r'[^\d.]', '', str(height))

            return f"0 0 {width_num or '24'} {height_num or '24'}"

        except Exception as e:
            logger.warning(f"Failed to extract viewBox: {e}")
            return "0 0 24 24"
    
    @staticmethod
    def generate_icon_name(title: str) -> str:
        """Generate a clean icon name from title"""
        return title.lower().replace(" ", "-").replace(".", "")

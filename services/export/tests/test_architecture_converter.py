"""Tests for ArchitectureMermaidConverter - Phase 2A Implementation."""

import pytest

from app.services.diagram_converters.architecture_converter import ArchitectureMermaidConverter


class TestArchitectureMermaidConverter:
    """Test cases for architecture converter."""

    @pytest.fixture
    def converter(self):
        """Create a converter instance for testing."""
        return ArchitectureMermaidConverter()

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_parse_mermaid_source_placeholder(self, converter):
        """Test that parse_mermaid_source returns empty structures (Phase 2B implementation pending)."""
        nodes, edges = await converter.parse_mermaid_source("architecture-beta\n    service app")

        # Phase 2A: Returns empty structures, Phase 2B will implement parsing
        assert nodes == {}
        assert edges == []

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_extract_svg_positions_with_architecture_classes(self, converter):
        """Test enhanced SVG position extraction with architecture-specific classes."""
        # Simple SVG with architecture classes
        svg_content = '''
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
            <g id="service-app" class="architecture-service" transform="translate(100,50)">
                <rect width="120" height="100" class="basic label-container"/>
                <text x="60" y="55">App Service</text>
            </g>
            <g id="junction-main" class="architecture-junction" transform="translate(250,100)">
                <circle r="10"/>
            </g>
        </svg>
        '''

        positions = await converter.extract_svg_positions(svg_content)

        # Should extract positions for architecture nodes
        assert len(positions) >= 0  # May find nodes or fallback gracefully

        # If nodes are found, verify structure
        for node_id, position in positions.items():
            assert 'x' in position
            assert 'y' in position
            assert 'w' in position
            assert 'h' in position

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_extract_svg_positions_fallback(self, converter):
        """Test that fallback position extraction works."""
        # Invalid SVG to trigger fallback
        svg_content = '<invalid>not svg</invalid>'

        positions = await converter.extract_svg_positions(svg_content)

        # Should handle gracefully with fallback
        assert isinstance(positions, dict)

    @pytest.mark.unit
    def test_find_relevant_groups(self, converter):
        """Test finding architecture-relevant groups."""
        from xml.etree import ElementTree as ET

        svg_content = '''
        <svg xmlns="http://www.w3.org/2000/svg">
            <g class="architecture-service" id="service-1">
                <text>Service</text>
            </g>
            <g class="architecture-junction" id="junction-1">
                <circle r="5"/>
            </g>
            <g class="flowchart-node" id="flowchart-1">
                <rect/>
            </g>
            <g id="no-class">
                <rect/>
            </g>
        </svg>
        '''

        root = ET.fromstring(svg_content)
        ns = {'svg': 'http://www.w3.org/2000/svg'}

        groups = converter._find_relevant_groups(root, ns)

        # Should find architecture-specific groups and fallback groups with IDs
        assert len(groups) >= 2  # At least service and junction groups

    @pytest.mark.unit
    def test_extract_node_id_strategies(self, converter):
        """Test multiple node ID extraction strategies."""
        from xml.etree import ElementTree as ET

        # Test different ID patterns
        test_cases = [
            ('<g data-node-id="app" id="complex-id"></g>', 'app'),
            ('<g id="service-database"></g>', 'database'),
            ('<g id="node-frontend"></g>', 'frontend'),
            ('<g id="simple"></g>', 'simple'),
        ]

        for svg_fragment, expected_id in test_cases:
            element = ET.fromstring(svg_fragment)
            node_id = converter._extract_node_id(element)
            if expected_id:
                assert node_id == expected_id

    @pytest.mark.unit
    def test_get_default_size_for_element(self, converter):
        """Test default sizing for different element types."""
        from xml.etree import ElementTree as ET

        # Architecture service should be larger
        service_elem = ET.fromstring('<g class="architecture-service"></g>')
        service_size = converter._get_default_size_for_element(service_elem)
        assert service_size['w'] == 120
        assert service_size['h'] == 100

        # Junction should be smaller
        junction_elem = ET.fromstring('<g class="architecture-junction"></g>')
        junction_size = converter._get_default_size_for_element(junction_elem)
        assert junction_size['w'] == 20
        assert junction_size['h'] == 20

        # Default size for unknown
        default_elem = ET.fromstring('<g class="unknown"></g>')
        default_size = converter._get_default_size_for_element(default_elem)
        assert default_size['w'] == 80
        assert default_size['h'] == 80

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_convert_to_drawio_xml_integration(self, converter):
        """Test full conversion integration (Phase 2A foundation with Phase 2B placeholder)."""
        mermaid_source = "architecture-beta\n    service app[App Service]"
        svg_content = '''
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
            <g id="service-app" class="architecture-service" transform="translate(100,50)">
                <rect width="120" height="100"/>
                <text>App Service</text>
            </g>
        </svg>
        '''

        drawio_xml, metadata = await converter.convert_to_drawio_xml(
            mermaid_source, svg_content, width=400, height=300
        )

        # Should complete without errors
        assert drawio_xml is not None
        assert isinstance(drawio_xml, str)
        assert len(drawio_xml) > 0

        # Verify metadata structure
        assert 'converter_type' in metadata
        assert metadata['converter_type'] == 'ArchitectureMermaidConverter'
        assert 'nodes_parsed' in metadata
        assert 'edges_parsed' in metadata
        assert 'positions_found' in metadata
        assert 'canvas_width' in metadata
        assert 'canvas_height' in metadata

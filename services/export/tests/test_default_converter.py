"""Tests for DefaultMermaidConverter."""

from unittest.mock import patch
from app.services.diagram_converters.default_converter import DefaultMermaidConverter
from tests.fixtures.phase1_test_data import SIMPLE_ARROW_DIAGRAM, SIMPLE_SVG, EMPTY_SVG


class TestDefaultMermaidConverter:
    """Test cases for default converter."""

    def setup_method(self):
        """Set up test fixtures."""
        self.converter = DefaultMermaidConverter()

    async def test_parse_mermaid_source_simple_arrows(self):
        """Test parsing simple arrow diagrams."""
        nodes, edges = await self.converter.parse_mermaid_source(SIMPLE_ARROW_DIAGRAM)

        assert len(nodes) == 3  # A, B, C
        assert len(edges) == 2  # A->B, B->C

        # Check nodes
        assert "A" in nodes
        assert "B" in nodes
        assert "C" in nodes

        # Check node structure
        assert nodes["A"]["label"] == "A"
        assert nodes["A"]["hasIcon"] is False

        # Check edges
        edge_pairs = [(e["source"], e["target"]) for e in edges]
        assert ("A", "B") in edge_pairs
        assert ("B", "C") in edge_pairs

    async def test_parse_mermaid_source_dashed_arrows(self):
        """Test parsing dashed arrows."""
        source = "A -.-> B"
        nodes, edges = await self.converter.parse_mermaid_source(source)

        assert len(edges) == 1
        assert edges[0]["dashed"] is True

    async def test_parse_mermaid_source_empty(self):
        """Test parsing empty source."""
        nodes, edges = await self.converter.parse_mermaid_source("")

        assert len(nodes) == 0
        assert len(edges) == 0

    async def test_extract_svg_positions_simple(self):
        """Test extracting positions from simple SVG."""
        positions = await self.converter.extract_svg_positions(SIMPLE_SVG)

        assert len(positions) == 2  # A and B
        assert "A" in positions
        assert "B" in positions

        # Check position structure
        pos_a = positions["A"]
        assert "x" in pos_a
        assert "y" in pos_a
        assert "w" in pos_a
        assert "h" in pos_a

    async def test_extract_svg_positions_empty(self):
        """Test extracting positions from empty SVG."""
        positions = await self.converter.extract_svg_positions(EMPTY_SVG)
        assert len(positions) == 0

    async def test_extract_svg_positions_malformed(self):
        """Test handling malformed SVG gracefully."""
        malformed_svg = "<svg><invalid></svg>"
        positions = await self.converter.extract_svg_positions(malformed_svg)
        assert isinstance(positions, dict)

    def test_extract_node_name_from_id_flowchart_pattern(self):
        """Test extracting node names from flowchart IDs."""
        node_name = self.converter._extract_node_name_from_id("flowchart-NodeA-123")
        assert node_name == "NodeA"

    def test_extract_node_name_from_id_simple_pattern(self):
        """Test extracting node names from simple patterns."""
        node_name = self.converter._extract_node_name_from_id("node-B")
        assert node_name == "B"

    def test_extract_node_name_from_id_direct_name(self):
        """Test extracting node names that are direct matches."""
        node_name = self.converter._extract_node_name_from_id("SimpleNode")
        assert node_name == "SimpleNode"

    def test_extract_node_name_from_id_invalid(self):
        """Test handling invalid IDs."""
        node_name = self.converter._extract_node_name_from_id("invalid@id#")
        assert node_name == "invalid"  # Method extracts up to first special character

    async def test_convert_to_drawio_xml_integration(self):
        """Test full conversion integration."""
        with patch.object(self.converter, 'build_drawio_xml') as mock_build:
            mock_build.return_value = ("<xml></xml>", {"nodes_converted": 2})

            xml, metadata = await self.converter.convert_to_drawio_xml(
                SIMPLE_ARROW_DIAGRAM, SIMPLE_SVG
            )

            assert xml == "<xml></xml>"
            assert metadata["converter_type"] == "DefaultMermaidConverter"
            assert metadata["nodes_parsed"] == 3
            assert metadata["edges_parsed"] == 2

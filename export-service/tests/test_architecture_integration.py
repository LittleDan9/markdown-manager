"""Integration tests for architecture converter Phase 2B implementation."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.diagram_converters.architecture_converter import ArchitectureMermaidConverter
from tests.fixtures.architecture_samples import ARCHITECTURE_COMPLETE, ARCHITECTURE_SIMPLE


class TestArchitectureConverterIntegration:
    """Integration tests for complete architecture conversion pipeline."""

    def setup_method(self):
        """Set up test fixtures."""
        self.converter = ArchitectureMermaidConverter()

    @pytest.mark.asyncio
    async def test_parse_mermaid_source_complete(self):
        """Test parsing complete architecture diagram source."""
        nodes, edges = await self.converter.parse_mermaid_source(ARCHITECTURE_COMPLETE)

        # Check nodes were parsed correctly
        assert len(nodes) == 12  # 9 services + 2 groups + 1 junction

        # Check service nodes
        service_nodes = {k: v for k, v in nodes.items() if v.get('type') == 'service'}
        assert len(service_nodes) == 9

        # Check specific service
        assert 'input' in service_nodes
        input_node = service_nodes['input']
        assert input_node['label'] == 'Input'
        assert input_node['icon'] == 'azure:files'
        assert input_node['hasIcon'] is True
        assert input_node['group'] is None

        # Check service with group
        assert 'sftp' in service_nodes
        sftp_node = service_nodes['sftp']
        assert sftp_node['group'] == 'mft'

        # Check group nodes
        group_nodes = {k: v for k, v in nodes.items() if v.get('type') == 'group'}
        assert len(group_nodes) == 2
        assert 'mft' in group_nodes
        assert 'genius' in group_nodes

        # Check junction nodes
        junction_nodes = {k: v for k, v in nodes.items() if v.get('type') == 'junction'}
        assert len(junction_nodes) == 1
        assert 'junctionPBI' in junction_nodes

        # Check edges were parsed correctly
        assert len(edges) == 10

        # Check specific edge
        input_to_sftp = next((e for e in edges if e['source'] == 'input' and e['target'] == 'sftp'), None)
        assert input_to_sftp is not None
        assert input_to_sftp['source_direction'] == 'R'
        assert input_to_sftp['target_direction'] == 'L'
        assert input_to_sftp['bidirectional'] is False
        assert input_to_sftp['dashed'] is False

    @pytest.mark.asyncio
    async def test_parse_mermaid_source_simple(self):
        """Test parsing simple architecture diagram."""
        nodes, edges = await self.converter.parse_mermaid_source(ARCHITECTURE_SIMPLE)

        assert len(nodes) == 3  # frontend, backend, database
        assert len(edges) == 2  # frontend -> backend, backend -> database

        # Check all nodes are services
        for node in nodes.values():
            assert node['type'] == 'service'
            assert node['hasIcon'] is True

    @pytest.mark.asyncio
    async def test_build_drawio_xml_architecture_features(self):
        """Test Draw.io XML generation with architecture-specific features."""
        # Parse nodes and edges
        nodes, edges = await self.converter.parse_mermaid_source(ARCHITECTURE_SIMPLE)

        # Mock positions
        positions = {
            'frontend': {'x': 100, 'y': 100, 'w': 120, 'h': 100},
            'backend': {'x': 300, 'y': 100, 'w': 120, 'h': 100},
            'database': {'x': 500, 'y': 100, 'w': 120, 'h': 100}
        }

        # Generate Draw.io XML
        drawio_xml, stats = await self.converter.build_drawio_xml(
            nodes, edges, positions, icon_service_url=None
        )

        # Check XML was generated
        assert drawio_xml is not None
        assert len(drawio_xml) > 0
        assert 'mxfile' in drawio_xml
        assert 'mxGraphModel' in drawio_xml

        # Check statistics
        assert stats['nodes_converted'] == 3
        assert stats['edges_converted'] == 2
        assert stats['services_created'] == 3
        assert stats['groups_created'] == 0
        assert stats['junctions_created'] == 0

    @pytest.mark.asyncio
    async def test_build_drawio_xml_with_groups_and_junctions(self):
        """Test Draw.io XML generation with groups and junctions."""
        nodes, edges = await self.converter.parse_mermaid_source(ARCHITECTURE_COMPLETE)

        # Mock positions for all nodes
        positions = {}
        for i, node_id in enumerate(nodes.keys()):
            positions[node_id] = {
                'x': 100 + (i % 4) * 200,
                'y': 100 + (i // 4) * 150,
                'w': 120, 'h': 100
            }

        drawio_xml, stats = await self.converter.build_drawio_xml(
            nodes, edges, positions, icon_service_url=None
        )

        # Check all node types were created
        assert stats['services_created'] == 9
        assert stats['groups_created'] == 2
        assert stats['junctions_created'] == 1
        assert stats['nodes_converted'] == 12
        assert stats['edges_converted'] == 10

    @pytest.mark.asyncio
    async def test_directional_edges_in_xml(self):
        """Test that directional edges are properly rendered in Draw.io XML."""
        content = """
        architecture-beta
          service A(icon)[Service A]
          service B(icon)[Service B]

          A:R --> L:B
        """

        nodes, edges = await self.converter.parse_mermaid_source(content)
        positions = {
            'A': {'x': 100, 'y': 100, 'w': 120, 'h': 100},
            'B': {'x': 300, 'y': 100, 'w': 120, 'h': 100}
        }

        drawio_xml, stats = await self.converter.build_drawio_xml(nodes, edges, positions)

        # Check that directional styling is included (URL decoded)
        import urllib.parse
        decoded_xml = urllib.parse.unquote(drawio_xml)
        assert 'exitX=1' in decoded_xml  # Right exit
        assert 'entryX=0' in decoded_xml  # Left entry

    @pytest.mark.asyncio
    async def test_icon_integration(self):
        """Test icon integration in Draw.io XML generation."""
        with patch.object(self.converter, 'fetch_icon_svg', new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3C/svg%3E"

            nodes, edges = await self.converter.parse_mermaid_source(ARCHITECTURE_SIMPLE)
            positions = {
                'frontend': {'x': 100, 'y': 100, 'w': 120, 'h': 100},
                'backend': {'x': 300, 'y': 100, 'w': 120, 'h': 100},
                'database': {'x': 500, 'y': 100, 'w': 120, 'h': 100}
            }

            drawio_xml, stats = await self.converter.build_drawio_xml(
                nodes, edges, positions, icon_service_url="http://test-icon-service"
            )

            # Check icon statistics
            assert stats['icons_attempted'] == 3  # All services have icons
            assert stats['icons_successful'] == 3  # All mocked to succeed
            assert stats['icon_success_rate'] == 100.0

            # Check XML contains image styling (URL decoded)
            import urllib.parse
            decoded_xml = urllib.parse.unquote(drawio_xml)
            assert 'shape=image' in decoded_xml
            assert 'image=data:image/svg+xml' in decoded_xml

    @pytest.mark.asyncio
    async def test_complete_conversion_pipeline(self):
        """Test complete conversion from Mermaid source to Draw.io XML."""
        # Mock SVG content for position extraction
        mock_svg_content = """
        <svg xmlns="http://www.w3.org/2000/svg">
            <g id="frontend" transform="translate(100,100)">
                <rect width="120" height="100"/>
            </g>
            <g id="backend" transform="translate(300,100)">
                <rect width="120" height="100"/>
            </g>
            <g id="database" transform="translate(500,100)">
                <rect width="120" height="100"/>
            </g>
        </svg>
        """

        # Mock the extract_svg_positions method to return predictable positions
        with patch.object(self.converter, 'extract_svg_positions', new_callable=AsyncMock) as mock_extract:
            mock_extract.return_value = {
                'frontend': {'x': 100, 'y': 100, 'w': 120, 'h': 100},
                'backend': {'x': 300, 'y': 100, 'w': 120, 'h': 100},
                'database': {'x': 500, 'y': 100, 'w': 120, 'h': 100}
            }

            # Run complete conversion
            drawio_xml, metadata = await self.converter.convert_to_drawio_xml(
                ARCHITECTURE_SIMPLE, mock_svg_content, icon_service_url=None
            )

            # Check result
            assert drawio_xml is not None
            assert len(drawio_xml) > 0
            assert 'mxfile' in drawio_xml

            # Check metadata
            assert metadata['converter_type'] == 'ArchitectureMermaidConverter'
            assert metadata['nodes_parsed'] == 3
            assert metadata['edges_parsed'] == 2
            assert metadata['positions_found'] == 3

    @pytest.mark.asyncio
    async def test_error_handling_invalid_source(self):
        """Test error handling for invalid Mermaid source."""
        # Mock the parser to raise an exception
        parser_path = 'app.services.diagram_converters.parsing.architecture_parser.ArchitectureParser'
        with patch(f'{parser_path}.parse_architecture_content', side_effect=Exception("Parse error")):
            with pytest.raises(ValueError, match="Failed to parse architecture source"):
                await self.converter.parse_mermaid_source("any content")

    @pytest.mark.asyncio
    async def test_fallback_positions_when_svg_extraction_fails(self):
        """Test fallback behavior when SVG position extraction fails."""
        # Test that the fallback method returns an empty dict
        positions = await self.converter._fallback_position_extraction("<invalid svg>")
        # Fallback should return empty dict rather than crash
        assert isinstance(positions, dict)

    @pytest.mark.asyncio
    async def test_mixed_node_types_styling(self):
        """Test that different node types get appropriate styling."""
        content = """
        architecture-beta
          service app(icon)[Application]
          group vpc[VPC Group]
          junction lb

          app:R --> L:lb
        """

        nodes, edges = await self.converter.parse_mermaid_source(content)
        positions = {
            'app': {'x': 100.0, 'y': 100.0, 'w': 120.0, 'h': 100.0},
            'vpc': {'x': 50.0, 'y': 50.0, 'w': 200.0, 'h': 150.0},
            'lb': {'x': 300.0, 'y': 120.0, 'w': 20.0, 'h': 20.0}
        }

        drawio_xml, stats = await self.converter.build_drawio_xml(nodes, edges, positions)

        # Check that different styling was applied
        assert stats['services_created'] == 1
        assert stats['groups_created'] == 1
        assert stats['junctions_created'] == 1

        # Check XML contains different styles (URL decoded)
        import urllib.parse
        decoded_xml = urllib.parse.unquote(drawio_xml)
        assert 'fillColor=#d5e8d4' in decoded_xml  # Service color
        assert 'fillColor=#e1d5e7' in decoded_xml  # Group color
        assert 'fillColor=#f8cecc' in decoded_xml  # Junction color
        assert 'shape=ellipse' in decoded_xml      # Junction shape
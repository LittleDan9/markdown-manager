"""Test architecture parser functionality."""

import pytest
from unittest.mock import patch
from app.services.diagram_converters.parsing.architecture_parser import (
    ArchitectureParser, ServiceDefinition, GroupDefinition, JunctionDefinition, EdgeDefinition
)
from tests.fixtures.architecture_samples import (
    ARCHITECTURE_COMPLETE, ARCHITECTURE_SERVICES_ONLY, ARCHITECTURE_WITH_GROUPS,
    ARCHITECTURE_WITH_JUNCTIONS, ARCHITECTURE_EDGE_TYPES, ARCHITECTURE_SIMPLE
)


class TestArchitectureParser:
    """Test suite for ArchitectureParser."""

    def setup_method(self):
        """Set up test fixtures."""
        self.parser = ArchitectureParser()

    def test_parse_services_only(self):
        """Test parsing diagram with only services."""
        result = self.parser.parse_architecture_content(ARCHITECTURE_SERVICES_ONLY)

        services = result['services']
        assert len(services) == 3

        # Check input service
        assert 'input' in services
        input_service = services['input']
        assert input_service.id == 'input'
        assert input_service.label == 'Input'
        assert input_service.icon == 'azure:files'
        assert input_service.group is None

        # Check sftp service
        assert 'sftp' in services
        sftp_service = services['sftp']
        assert sftp_service.id == 'sftp'
        assert sftp_service.label == 'SFTP'
        assert sftp_service.icon == 'material-icon-theme:folder-content-open'
        assert sftp_service.group is None

        # Check warehouse service
        assert 'warehouse' in services
        warehouse_service = services['warehouse']
        assert warehouse_service.id == 'warehouse'
        assert warehouse_service.label == 'SQL Warehouse'
        assert warehouse_service.icon == 'dbx:data-warehouse-red'
        assert warehouse_service.group is None

    def test_parse_groups(self):
        """Test parsing diagram with groups."""
        result = self.parser.parse_architecture_content(ARCHITECTURE_WITH_GROUPS)

        groups = result['groups']
        services = result['services']

        # Check group parsing
        assert len(groups) == 1
        assert 'mft' in groups
        mft_group = groups['mft']
        assert mft_group.id == 'mft'
        assert mft_group.label == 'Gainwell MFT'
        assert mft_group.icon == 'logos:progress'
        assert len(mft_group.services) == 2
        assert 'sftp' in mft_group.services
        assert 'landing' in mft_group.services

        # Check service group membership
        assert len(services) == 2
        assert services['sftp'].group == 'mft'
        assert services['landing'].group == 'mft'

    def test_parse_junctions(self):
        """Test parsing diagram with junctions."""
        result = self.parser.parse_architecture_content(ARCHITECTURE_WITH_JUNCTIONS)

        junctions = result['junctions']
        groups = result['groups']

        # Check junction parsing
        assert len(junctions) == 2

        # Junction with group
        assert 'junctionPBI' in junctions
        junction_pbi = junctions['junctionPBI']
        assert junction_pbi.id == 'junctionPBI'
        assert junction_pbi.group == 'genius'

        # Standalone junction
        assert 'standalone' in junctions
        standalone_junction = junctions['standalone']
        assert standalone_junction.id == 'standalone'
        assert standalone_junction.group is None

    def test_parse_edge_types(self):
        """Test parsing different edge types."""
        result = self.parser.parse_architecture_content(ARCHITECTURE_EDGE_TYPES)

        edges = result['edges']
        assert len(edges) == 4

        # Check directional solid edge: A:R --> L:B
        solid_edge = next((e for e in edges if e.source == 'A' and e.target == 'B'), None)
        assert solid_edge is not None
        assert solid_edge.source_direction == 'R'
        assert solid_edge.target_direction == 'L'
        assert solid_edge.arrow_type == 'solid'

        # Check line edge: B:T -- B:C
        line_edge = next((e for e in edges if e.source == 'B' and e.target == 'C'), None)
        assert line_edge is not None
        assert line_edge.source_direction == 'T'
        assert line_edge.target_direction == 'B'
        assert line_edge.arrow_type == 'line'

        # Check reverse edge: C:L <-- R:D (should be swapped to D -> C)
        reverse_edge = next((e for e in edges if e.source == 'D' and e.target == 'C'), None)
        assert reverse_edge is not None
        assert reverse_edge.source_direction == 'R'
        assert reverse_edge.target_direction == 'L'
        assert reverse_edge.arrow_type == 'solid'

    def test_parse_complete_architecture(self):
        """Test parsing complete architecture diagram."""
        result = self.parser.parse_architecture_content(ARCHITECTURE_COMPLETE)

        services = result['services']
        groups = result['groups']
        junctions = result['junctions']
        edges = result['edges']

        # Check counts
        assert len(services) == 9  # input, sftp, landing, clamav, enrich, warehouse, powerbi, portal, user
        assert len(groups) == 2    # mft, genius
        assert len(junctions) == 1 # junctionPBI
        assert len(edges) >= 8     # Should have valid connections (some might be filtered out)

        # Check group memberships are established
        assert groups['mft'].services == ['sftp']
        assert len(groups['genius'].services) == 6  # landing, clamav, enrich, warehouse, powerbi, portal

        # Check a few specific edges
        input_to_sftp = next((e for e in edges if e.source == 'input' and e.target == 'sftp'), None)
        assert input_to_sftp is not None
        assert input_to_sftp.source_direction == 'R'
        assert input_to_sftp.target_direction == 'L'

    def test_validation_invalid_group_references(self):
        """Test validation removes invalid group references."""
        content = """
        architecture-beta
          service app(icon)[App] in nonexistent
          junction j1 in invalid
        """

        result = self.parser.parse_architecture_content(content)

        services = result['services']
        junctions = result['junctions']

        # Invalid group references should be cleared
        assert services['app'].group is None
        assert junctions['j1'].group is None

    def test_validation_invalid_edge_references(self):
        """Test validation removes edges with invalid node references."""
        content = """
        architecture-beta
          service app(icon)[App]
          service db(icon)[Database]

          app:R --> L:db
          app:R --> L:nonexistent
          nonexistent:R --> L:db
        """

        result = self.parser.parse_architecture_content(content)

        edges = result['edges']

        # Only valid edge should remain
        assert len(edges) == 1
        assert edges[0].source == 'app'
        assert edges[0].target == 'db'

    def test_content_normalization(self):
        """Test content normalization removes comments and extra whitespace."""
        content = """
        architecture-beta
          %% This is a comment
          service app(icon)[App]  %% Another comment


          service db(icon)[Database]

          app:R --> L:db
        """

        result = self.parser.parse_architecture_content(content)

        services = result['services']
        edges = result['edges']

        assert len(services) == 2
        assert len(edges) == 1
        assert 'app' in services
        assert 'db' in services

    def test_edge_parsing_simple_arrows(self):
        """Test parsing simple arrow syntax without directions."""
        content = """
        architecture-beta
          service A(icon)[Service A]
          service B(icon)[Service B]
          service C(icon)[Service C]

          A --> B
          B <-- C
        """

        result = self.parser.parse_architecture_content(content)
        edges = result['edges']

        assert len(edges) == 2

        # A --> B
        edge1 = next((e for e in edges if e.source == 'A' and e.target == 'B'), None)
        assert edge1 is not None
        assert edge1.source_direction is None
        assert edge1.target_direction is None
        assert edge1.arrow_type == 'solid'

        # B <-- C (should be C --> B)
        edge2 = next((e for e in edges if e.source == 'C' and e.target == 'B'), None)
        assert edge2 is not None
        assert edge2.source_direction is None
        assert edge2.target_direction is None
        assert edge2.arrow_type == 'solid'

    def test_bidirectional_edges(self):
        """Test parsing bidirectional edges."""
        content = """
        architecture-beta
          service A(icon)[Service A]
          service B(icon)[Service B]

          A:R <--> L:B
        """

        result = self.parser.parse_architecture_content(content)
        edges = result['edges']

        assert len(edges) == 1
        edge = edges[0]
        assert edge.source == 'A'
        assert edge.target == 'B'
        assert edge.source_direction == 'R'
        assert edge.target_direction == 'L'
        assert edge.arrow_type == 'bidirectional'

    def test_empty_content(self):
        """Test parsing empty or minimal content."""
        result = self.parser.parse_architecture_content("architecture-beta")

        assert len(result['services']) == 0
        assert len(result['groups']) == 0
        assert len(result['junctions']) == 0
        assert len(result['edges']) == 0

    def test_malformed_content_error_handling(self):
        """Test error handling for malformed content."""
        # Mock _normalize_content to raise an exception
        with patch.object(self.parser, '_normalize_content', side_effect=Exception("Parsing error")):
            with pytest.raises(ValueError, match="Failed to parse architecture content"):
                self.parser.parse_architecture_content("any content")
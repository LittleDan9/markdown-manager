"""Integration tests for architecture diagram conversion."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import aiohttp

from app.services.mermaid_drawio_service import MermaidDrawioService
from configs.converter_config import ConfigManager


class TestArchitectureIntegration:
    """Integration tests for complete architecture diagram conversion."""

    @pytest.fixture
    def service(self):
        """Create service with test configuration."""
        config = ConfigManager.for_testing()
        return MermaidDrawioService()

    @pytest.fixture
    def mock_icon_service(self):
        """Mock icon service for testing."""
        with patch('app.services.diagram_converters.shared_utils.IconService') as mock:
            instance = mock.return_value
            instance.fetch_icon_svg = AsyncMock(return_value=None)
            instance.get_cache_stats = MagicMock(return_value={"hits": 0, "misses": 0})
            yield instance

    @pytest.fixture
    def mock_playwright(self):
        """Mock playwright for PNG conversion testing."""
        with patch('app.services.mermaid_drawio_service.async_playwright') as mock:
            mock_browser = AsyncMock()
            mock_page = AsyncMock()
            mock_page.set_content = AsyncMock()
            mock_page.screenshot = AsyncMock(return_value=b'fake_png_data')
            mock_browser.new_page = AsyncMock(return_value=mock_page)
            mock.return_value.__aenter__ = AsyncMock(return_value=MagicMock(chromium=MagicMock(launch=AsyncMock(return_value=mock_browser))))
            yield mock

    @pytest.mark.asyncio
    async def test_complete_architecture_conversion(self, service, mock_icon_service):
        """Test complete architecture diagram conversion end-to-end."""
        architecture_source = '''architecture-beta
    service frontend(react)[Frontend App]
    service backend(nodejs)[Backend API]
    service database(postgresql)[Database]

    group infrastructure[Infrastructure]
    service redis(redis)[Cache] in infrastructure
    junction loadbalancer in infrastructure

    frontend:R --> L:backend
    backend:R --> L:database
    backend:B --> T:loadbalancer
    loadbalancer:R --> L:redis
'''

        architecture_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="frontend"><rect x="100" y="100" width="120" height="100"/><text>Frontend App</text></g>
    <g class="architecture-service" data-node-id="backend"><rect x="300" y="100" width="120" height="100"/><text>Backend API</text></g>
    <g class="architecture-service" data-node-id="database"><rect x="500" y="100" width="120" height="100"/><text>Database</text></g>
    <g class="architecture-groups" data-node-id="infrastructure"><rect x="700" y="50" width="200" height="200"/><text>Infrastructure</text></g>
    <g class="architecture-service" data-node-id="redis"><rect x="750" y="100" width="120" height="100"/><text>Cache</text></g>
    <g class="architecture-junction" data-node-id="loadbalancer"><circle cx="800" cy="200" r="10"/></g>
</svg>'''

        # Test conversion
        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            architecture_source, architecture_svg
        )

        # Verify results
        assert xml_content is not None
        assert '<mxfile' in xml_content
        assert 'frontend' in xml_content
        assert 'backend' in xml_content
        assert 'database' in xml_content
        assert 'infrastructure' in xml_content
        assert 'redis' in xml_content
        assert 'loadbalancer' in xml_content

        # Verify metadata
        assert metadata['type'] == 'ARCHITECTURE'
        assert metadata['converter_type'] == 'ArchitectureMermaidConverter'
        assert metadata['nodes_parsed'] >= 5
        assert metadata['edges_parsed'] >= 4

    @pytest.mark.asyncio
    async def test_architecture_with_icons(self, service, mock_icon_service):
        """Test architecture diagram with icon fetching."""
        # Configure mock to return SVG data
        mock_icon_service.fetch_icon_svg.return_value = '<svg><rect fill="blue"/></svg>'

        architecture_source = '''architecture-beta
    service app(react)[Web App]
    service db(postgresql)[Database]
    app:R --> L:db
'''

        architecture_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="app"><rect x="100" y="100" width="120" height="100"/></g>
    <g class="architecture-service" data-node-id="db"><rect x="300" y="100" width="120" height="100"/></g>
</svg>'''

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            architecture_source, architecture_svg
        )

        assert xml_content is not None
        assert metadata['type'] == 'ARCHITECTURE'
        assert 0 <= metadata.get('icon_success_rate', 0) <= 100

    @pytest.mark.asyncio
    async def test_architecture_png_conversion(self, service, mock_playwright):
        """Test architecture diagram PNG conversion."""
        architecture_source = '''architecture-beta
    service frontend[Frontend]
    service backend[Backend]
    frontend --> backend
'''

        architecture_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="frontend"><rect x="100" y="100" width="120" height="100"/></g>
    <g class="architecture-service" data-node-id="backend"><rect x="300" y="100" width="120" height="100"/></g>
</svg>'''

        png_data, metadata = await service.convert_mermaid_to_drawio_png(
            architecture_source, architecture_svg
        )

        assert png_data is not None
        assert len(png_data) > 0
        assert metadata['type'] == 'ARCHITECTURE'
        assert metadata['converter_type'] == 'ArchitectureMermaidConverter'

    @pytest.mark.asyncio
    async def test_performance_monitoring(self, service):
        """Test that performance monitoring works."""
        architecture_source = '''architecture-beta
    service app[Application]
    service db[Database]
    app --> db
'''

        architecture_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="app"><rect x="100" y="100" width="120" height="100"/></g>
    <g class="architecture-service" data-node-id="db"><rect x="300" y="100" width="120" height="100"/></g>
</svg>'''

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            architecture_source, architecture_svg
        )

        # Check that performance metrics are included
        assert 'conversion_time' in metadata
        assert metadata['conversion_time'] >= 0
        assert isinstance(metadata['conversion_time'], (int, float))

    @pytest.mark.asyncio
    async def test_error_handling(self, service):
        """Test error handling in architecture conversion."""
        # Test with invalid Mermaid source
        invalid_source = "this is not valid mermaid syntax"
        invalid_svg = "<not valid xml"

        with pytest.raises(Exception) as exc_info:
            await service.convert_mermaid_to_drawio_xml(invalid_source, invalid_svg)

        # Should have meaningful error message
        assert "failed" in str(exc_info.value).lower() or "error" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_backward_compatibility(self, service):
        """Test that flowchart diagrams still work correctly."""
        flowchart_source = '''flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D
'''

        flowchart_svg = '''<svg viewBox="0 0 1000 600">
    <g data-node-id="A"><rect x="100" y="50" width="80" height="40"/><text>Start</text></g>
    <g data-node-id="B"><polygon points="200,100 250,125 200,150 150,125"/><text>Decision</text></g>
    <g data-node-id="C"><rect x="150" y="200" width="80" height="40"/><text>Process</text></g>
    <g data-node-id="D"><rect x="300" y="200" width="80" height="40"/><text>End</text></g>
</svg>'''

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            flowchart_source, flowchart_svg
        )

        assert xml_content is not None
        assert '<mxGraphModel' in xml_content
        assert metadata['type'] == 'FLOWCHART'
        assert metadata['converter_type'] == 'FlowchartMermaidConverter'

    @pytest.mark.asyncio
    async def test_validation_integration(self, service):
        """Test input validation integration."""
        # Test with source that's too long
        very_long_source = "architecture-beta\n" + "service test[Test]\n" * 10000

        with pytest.raises(Exception) as exc_info:
            await service.convert_mermaid_to_drawio_xml(very_long_source, "<svg></svg>")

        # Should fail due to validation
        assert "too long" in str(exc_info.value).lower() or "validation" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_configuration_integration(self, service):
        """Test configuration system integration."""
        # Test that service respects configuration
        simple_source = '''architecture-beta
    service app[App]
'''

        simple_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="app"><rect x="100" y="100" width="120" height="100"/></g>
</svg>'''

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            simple_source, simple_svg
        )

        # Should complete successfully with test configuration
        assert xml_content is not None
        assert metadata['type'] == 'ARCHITECTURE'

    @pytest.mark.asyncio
    async def test_mixed_diagram_detection(self, service):
        """Test that the system correctly detects different diagram types."""
        test_cases = [
            ('architecture-beta\nservice app[App]', 'ARCHITECTURE'),
            ('flowchart TD\nA --> B', 'FLOWCHART'),
            ('graph TD\nA --> B', 'FLOWCHART'),
            ('unknown diagram type\nstuff', 'DEFAULT'),
        ]

        for source, expected_type in test_cases:
            svg = f'<svg><g data-node-id="test"><rect/></g></svg>'

            xml_content, metadata = await service.convert_mermaid_to_drawio_xml(source, svg)

            assert xml_content is not None
            assert metadata['type'] == expected_type
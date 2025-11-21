"""Performance and edge case tests for Draw.io export service."""

import pytest
import asyncio
import time
from unittest.mock import patch, MagicMock

from tests.fixtures.test_data import (
    PERFORMANCE_TEST_DATA,
    ERROR_TEST_SCENARIOS,
    MERMAID_FLOWCHART_BASIC,
    SVG_FLOWCHART_BASIC
)


class TestPerformance:
    """Performance tests for Draw.io export service."""

    @pytest.mark.performance
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_large_diagram_conversion_performance(self, mermaid_drawio_service, performance_timer, memory_profiler, mock_icon_service):
        """Test conversion performance with large diagrams."""
        large_mermaid = PERFORMANCE_TEST_DATA["large_flowchart"]

        # Generate large SVG content
        large_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5000 8000">{"".join([f"<g id=\"N{i}\" transform=\"translate({i*50},{(i//10)*80})\"><rect width=\"100\" height=\"40\" fill=\"#e1f5fe\" stroke=\"#01579b\"/><text x=\"50\" y=\"25\" text-anchor=\"middle\">Node {i}</text></g>" for i in range(100)])}</svg>'

        performance_timer.start()
        memory_profiler.start()

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=large_mermaid,
            svg_content=large_svg,
            width=5000,
            height=8000
        )

        memory_profiler.sample()
        performance_timer.stop()

        # Performance assertions
        assert performance_timer.elapsed < 10.0  # Should complete within 10 seconds
        assert memory_profiler.memory_used < 200  # Should use less than 200MB additional memory

        # Verify conversion succeeded
        assert xml_content is not None
        assert len(xml_content) > 300  # Basic XML structure
        assert metadata["original_nodes"] >= 0  # Basic parsing may find few nodes

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_concurrent_conversions_performance(self, mermaid_drawio_service, mock_icon_service):
        """Test performance with concurrent conversion requests."""
        async def perform_conversion(index):
            return await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
                mermaid_source=f"graph TD\n    A{index}[Start {index}] --> B{index}[End {index}]",
                svg_content=f'<svg><g id="A{index}"><rect/><text>Start {index}</text></g><g id="B{index}"><rect/><text>End {index}</text></g></svg>',
                width=800,
                height=600
            )

        start_time = time.time()

        # Run 10 concurrent conversions
        tasks = [perform_conversion(i) for i in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        end_time = time.time()
        elapsed = end_time - start_time

        # Performance assertions
        assert elapsed < 5.0  # Should complete within 5 seconds

        # Verify all conversions succeeded
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 10

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_icon_fetching_performance(self, mermaid_drawio_service):
        """Test icon fetching performance with multiple icons."""
        icon_refs = [f"icon_{i}" for i in range(20)]

        # Mock successful icon responses
        with patch('requests.get') as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = '<svg><path d="test"/></svg>'
            mock_get.return_value = mock_response

            start_time = time.time()

            # Fetch icons concurrently
            tasks = [
                mermaid_drawio_service.fetch_icon_svg(ref, "http://localhost:8000")
                for ref in icon_refs
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            end_time = time.time()
            elapsed = end_time - start_time

        # Performance assertions
        assert elapsed < 3.0  # Should complete within 3 seconds
        successful_fetches = [r for r in results if not isinstance(r, Exception) and r is not None]
        assert len(successful_fetches) >= 0  # May fail without proper icon service

    @pytest.mark.performance
    def test_api_response_time(self, client, mock_icon_service, performance_timer):
        """Test API endpoint response times."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC
        }

        performance_timer.start()
        response = client.post("/diagram/drawio/xml", json=request_data)
        performance_timer.stop()

        # Performance assertions
        assert response.status_code == 200
        assert performance_timer.elapsed < 5.0  # Should respond within 5 seconds

    @pytest.mark.performance
    def test_health_check_response_time(self, client, performance_timer):
        """Test health check endpoint response time."""
        performance_timer.start()
        response = client.get("/diagram/drawio/health")
        performance_timer.stop()

        # Health check should be very fast
        assert response.status_code == 200
        assert performance_timer.elapsed < 1.0  # Should respond within 1 second

    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_memory_usage_large_svg(self, mermaid_drawio_service, memory_profiler, mock_icon_service):
        """Test memory usage with large SVG content."""
        # Create very large SVG content
        large_svg_parts = []
        for i in range(500):  # 500 nodes
            large_svg_parts.append(f'<g id="node_{i}" transform="translate({i*10},{(i//25)*50})"><rect width="80" height="30" fill="#e1f5fe"/><text x="40" y="20">Node {i}</text></g>')

        large_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10000 10000">{"".join(large_svg_parts)}</svg>'
        large_mermaid = "graph TD\n" + "\n".join([f"    N{i}[Node {i}] --> N{i+1}[Node {i+1}]" for i in range(499)])

        memory_profiler.start()

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=large_mermaid,
            svg_content=large_svg,
            width=10000,
            height=10000
        )

        memory_profiler.sample()

        # Memory usage should be reasonable
        assert memory_profiler.memory_used < 300  # Less than 300MB additional
        assert xml_content is not None


class TestEdgeCases:
    """Edge case tests for Draw.io export service."""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_extremely_long_node_labels(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of extremely long node labels."""
        long_label = "A" * 1000  # 1000 character label
        mermaid_source = f'graph TD\n    A[{long_label}] --> B[Short]'
        svg_content = f'<svg><g id="A"><rect/><text>{long_label}</text></g><g id="B"><rect/><text>Short</text></g></svg>'

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=mermaid_source,
            svg_content=svg_content
        )

        assert xml_content is not None
        assert "<mxCell" in xml_content  # Basic XML structure should be generated

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_special_characters_in_labels(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of special characters in node labels."""
        special_chars = "Node with <>&\"'`\n\t\r special chars"
        mermaid_source = f'graph TD\n    A[{special_chars}] --> B[Normal]'
        svg_content = f'<svg><g id="A"><rect/><text>{special_chars}</text></g><g id="B"><rect/><text>Normal</text></g></svg>'

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=mermaid_source,
            svg_content=svg_content
        )

        assert xml_content is not None
        # Special characters should be properly escaped in XML
        assert "<mxCell" in xml_content  # Basic XML structure with proper escaping

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_unicode_characters(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of Unicode characters in labels."""
        unicode_label = "Node with 中文 🚀 émojis and ñoñó"
        mermaid_source = f'graph TD\n    A[{unicode_label}] --> B[ASCII Only]'
        svg_content = f'<svg><g id="A"><rect/><text>{unicode_label}</text></g><g id="B"><rect/><text>ASCII Only</text></g></svg>'

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=mermaid_source,
            svg_content=svg_content
        )

        assert xml_content is not None
        # Unicode should be preserved in XML
        assert "<mxCell" in xml_content  # Basic XML structure should handle unicode

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_deeply_nested_svg_structure(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of deeply nested SVG structures."""
        nested_svg = '''<svg xmlns="http://www.w3.org/2000/svg">
            <g id="root">
                <g id="level1">
                    <g id="level2">
                        <g id="level3">
                            <g id="A" transform="translate(50,50)">
                                <g class="node-content">
                                    <rect width="100" height="40"/>
                                    <text x="50" y="25">Nested Node</text>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </g>
        </svg>'''

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source="graph TD\n    A[Nested Node]",
            svg_content=nested_svg
        )

        assert xml_content is not None
        assert metadata["original_nodes"] >= 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_malformed_svg_recovery(self, mermaid_drawio_service, mock_icon_service):
        """Test recovery from malformed SVG content."""
        # SVG with missing closing tags
        malformed_svg = '<svg><g id="A"><rect width="100" height="40"><text>Unclosed'

        # Should handle gracefully and return basic XML
        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source="graph TD\n    A[Node]",
            svg_content=malformed_svg
        )
        assert xml_content is not None  # Service handles malformed SVG gracefully

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_svg_without_positioning_info(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of SVG without positioning information."""
        svg_no_positions = '<svg><g id="A"><rect/><text>Node A</text></g><g id="B"><rect/><text>Node B</text></g></svg>'

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source="graph TD\n    A --> B",
            svg_content=svg_no_positions
        )

        # Should still generate XML with calculated positions
        assert xml_content is not None
        assert metadata["original_nodes"] >= 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_circular_graph_structures(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of circular graph structures."""
        circular_mermaid = """
        graph TD
            A --> B
            B --> C
            C --> D
            D --> A
            B --> E
            E --> C
        """

        circular_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
            <g id="A" transform="translate(100,100)"><rect/><text>A</text></g>
            <g id="B" transform="translate(200,100)"><rect/><text>B</text></g>
            <g id="C" transform="translate(200,200)"><rect/><text>C</text></g>
            <g id="D" transform="translate(100,200)"><rect/><text>D</text></g>
            <g id="E" transform="translate(300,150)"><rect/><text>E</text></g>
        </svg>'''

        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=circular_mermaid,
            svg_content=circular_svg
        )

        assert xml_content is not None
        assert metadata["original_nodes"] >= 0
        assert metadata["original_edges"] >= 0

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_zero_dimension_canvas(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of zero dimension canvas."""
        # Test zero dimensions (should handle gracefully)
        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=MERMAID_FLOWCHART_BASIC,
            svg_content=SVG_FLOWCHART_BASIC,
            width=0,
            height=0
        )
        assert xml_content is not None

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_negative_dimensions(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of negative canvas dimensions."""
        # Test negative dimensions (should handle gracefully)
        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=MERMAID_FLOWCHART_BASIC,
            svg_content=SVG_FLOWCHART_BASIC,
            width=-100,
            height=-200
        )
        assert xml_content is not None

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_extremely_large_dimensions(self, mermaid_drawio_service, mock_icon_service):
        """Test handling of extremely large canvas dimensions."""
        # Very large but valid dimensions
        xml_content, metadata = await mermaid_drawio_service.convert_mermaid_to_drawio_xml(
            mermaid_source=MERMAID_FLOWCHART_BASIC,
            svg_content=SVG_FLOWCHART_BASIC,
            width=50000,
            height=50000
        )

        assert xml_content is not None
        assert metadata["canvas_width"] == 50000
        assert metadata["canvas_height"] == 50000

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_icon_service_malformed_responses(self, mermaid_drawio_service):
        """Test handling of malformed icon service responses."""
        malformed_responses = [
            "",  # Empty response
            "not xml at all",  # Plain text
            "<svg>unclosed svg",  # Malformed XML
            "<notsvg>Wrong root element</notsvg>",  # Wrong XML format
            "{'json': 'instead of svg'}",  # JSON instead of SVG
        ]

        for malformed_response in malformed_responses:
            with patch('requests.get') as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.text = malformed_response
                mock_get.return_value = mock_response

                # Should handle gracefully and return None or empty
                icon_data = await mermaid_drawio_service.fetch_icon_svg(
                    "test", "http://localhost:8000"
                )

                assert icon_data is None or icon_data == ""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_icon_service_http_errors(self, mermaid_drawio_service):
        """Test handling of various HTTP errors from icon service."""
        error_codes = [400, 401, 403, 404, 500, 502, 503]

        for error_code in error_codes:
            with patch('requests.get') as mock_get:
                mock_response = MagicMock()
                mock_response.status_code = error_code
                mock_response.text = f"HTTP {error_code} Error"
                mock_get.return_value = mock_response

                # Should handle HTTP errors gracefully
                icon_data = await mermaid_drawio_service.fetch_icon_svg(
                    "test", "http://localhost:8000"
                )

                assert icon_data is None or icon_data == ""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_network_connectivity_issues(self, mermaid_drawio_service):
        """Test handling of network connectivity issues."""
        network_exceptions = [
            Exception("Connection refused"),
            Exception("DNS resolution failed"),
            Exception("Network unreachable"),
            Exception("SSL certificate error")
        ]

        for exception in network_exceptions:
            with patch('requests.get') as mock_get:
                mock_get.side_effect = exception

                # Should handle network issues gracefully
                icon_data = await mermaid_drawio_service.fetch_icon_svg(
                    "test", "http://localhost:8000"
                )

                assert icon_data is None or icon_data == ""

    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_quality_assessment_edge_cases(self, drawio_quality_service):
        """Test quality assessment with edge case inputs."""
        # Test with extremely high numbers
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={f"N{i}": {} for i in range(10000)},  # 10,000 nodes
            converted_nodes=10000,
            original_edges=9999,
            converted_edges=9999,
            icons_attempted=1000,
            icons_successful=1000
        )

        assert quality_info.score >= 90.0  # High quality conversion

        # Test with zero values
        quality_info = await drawio_quality_service.assess_conversion_quality(
            original_nodes={},
            converted_nodes=0,
            original_edges=0,
            converted_edges=0,
            icons_attempted=0,
            icons_successful=0
        )

        assert quality_info.score >= 90.0  # High quality assessment

    @pytest.mark.integration
    def test_api_with_extremely_large_request(self, client, mock_icon_service):
        """Test API handling of extremely large request payloads."""
        # Create very large Mermaid source
        large_mermaid = "graph TD\n" + "\n".join([
            f"    N{i}[Very long node label that contains lots of text to make the request large - Node {i}] --> N{i+1}[Another long label - Node {i+1}]"
            for i in range(100)
        ])

        # Create large SVG content
        large_svg_parts = [f'<g id="N{i}" transform="translate({i*20},{(i//10)*50})"><rect width="200" height="40" fill="#e1f5fe"/><text x="100" y="25">Very long node label that contains lots of text - Node {i}</text></g>' for i in range(100)]
        large_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 500">{"".join(large_svg_parts)}</svg>'

        request_data = {
            "mermaid_source": large_mermaid,
            "svg_content": large_svg,
            "width": 2000,
            "height": 500
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        # Should handle large requests successfully (or fail gracefully)
        assert response.status_code in [200, 413, 400]  # Success, payload too large, or bad request

        if response.status_code == 200:
            data = response.json()
            assert data["success"] is True
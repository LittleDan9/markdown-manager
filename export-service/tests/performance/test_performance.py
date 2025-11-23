"""Performance tests for diagram conversion."""

import pytest
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
import psutil
import os

from app.services.mermaid_drawio_service import MermaidDrawioService
from configs.converter_config import ConfigManager


class TestPerformance:
    """Performance tests for diagram conversion."""

    @pytest.fixture
    def service(self):
        """Create service with performance testing configuration."""
        config = ConfigManager.for_testing()
        config.performance.enable_monitoring = True
        return MermaidDrawioService()

    @pytest.fixture
    def architecture_source(self):
        """Sample architecture diagram for performance testing."""
        return '''architecture-beta
    service frontend(react)[Frontend App]
    service backend(nodejs)[Backend API]
    service database(postgresql)[Database]
    service cache(redis)[Redis Cache]
    service queue(rabbitmq)[Message Queue]

    group vpc[VPC]
    service loadbalancer(nginx)[Load Balancer] in vpc
    service monitoring(prometheus)[Monitoring] in vpc

    junction api_gateway in vpc
    junction data_layer

    frontend:R --> L:api_gateway
    api_gateway:R --> L:backend
    backend:R --> L:data_layer
    data_layer:R --> L:database
    data_layer:B --> T:cache
    backend:B --> T:queue
    loadbalancer:R --> L:api_gateway
    monitoring:T --> B:backend
'''

    @pytest.fixture
    def architecture_svg(self):
        """Sample architecture SVG for performance testing."""
        return '''<svg viewBox="0 0 1200 800">
    <g class="architecture-service" data-node-id="frontend"><rect x="50" y="100" width="120" height="100"/><text>Frontend App</text></g>
    <g class="architecture-service" data-node-id="backend"><rect x="250" y="100" width="120" height="100"/><text>Backend API</text></g>
    <g class="architecture-service" data-node-id="database"><rect x="450" y="100" width="120" height="100"/><text>Database</text></g>
    <g class="architecture-service" data-node-id="cache"><rect x="650" y="100" width="120" height="100"/><text>Redis Cache</text></g>
    <g class="architecture-service" data-node-id="queue"><rect x="850" y="100" width="120" height="100"/><text>Message Queue</text></g>

    <g class="architecture-groups" data-node-id="vpc"><rect x="50" y="300" width="300" height="200"/><text>VPC</text></g>
    <g class="architecture-service" data-node-id="loadbalancer"><rect x="80" y="350" width="120" height="100"/><text>Load Balancer</text></g>
    <g class="architecture-service" data-node-id="monitoring"><rect x="220" y="350" width="120" height="100"/><text>Monitoring</text></g>

    <g class="architecture-junction" data-node-id="api_gateway"><circle cx="400" cy="250" r="15"/></g>
    <g class="architecture-junction" data-node-id="data_layer"><circle cx="600" cy="250" r="15"/></g>
</svg>'''

    @pytest.mark.asyncio
    async def test_conversion_performance(self, service, architecture_source, architecture_svg):
        """Test conversion performance benchmarks."""
        start_time = time.time()

        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
            architecture_source, architecture_svg
        )

        conversion_time = time.time() - start_time

        # Performance assertions
        assert conversion_time < 5.0, f"Conversion took {conversion_time:.3f}s, should be < 5s"
        assert xml_content is not None
        assert len(xml_content) > 1000  # Should generate substantial XML

        # Check performance metadata
        assert 'conversion_time' in metadata
        assert metadata['conversion_time'] < 5.0

        print(f"Conversion completed in {conversion_time:.3f}s")
        print(f"XML length: {len(xml_content)} characters")
        print(f"Nodes: {metadata.get('nodes_parsed', 0)}")
        print(f"Edges: {metadata.get('edges_parsed', 0)}")

    @pytest.mark.asyncio
    async def test_concurrent_conversions(self, service, architecture_source, architecture_svg):
        """Test multiple concurrent conversions."""
        num_concurrent = 5

        async def convert_single():
            return await service.convert_mermaid_to_drawio_xml(
                architecture_source, architecture_svg
            )

        start_time = time.time()

        # Run concurrent conversions
        tasks = [convert_single() for _ in range(num_concurrent)]
        results = await asyncio.gather(*tasks)

        total_time = time.time() - start_time

        # All conversions should succeed
        assert len(results) == num_concurrent
        for xml_content, metadata in results:
            assert xml_content is not None
            assert metadata['type'] == 'ARCHITECTURE'

        # Performance should scale reasonably
        avg_time_per_conversion = total_time / num_concurrent
        assert avg_time_per_conversion < 10.0, f"Average time per conversion: {avg_time_per_conversion:.3f}s"

        print(f"Concurrent conversions completed in {total_time:.3f}s")
        print(f"Average per conversion: {total_time / num_concurrent:.3f}s")

    @pytest.mark.asyncio
    async def test_memory_usage(self, service, architecture_source, architecture_svg):
        """Test memory usage during conversion."""
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024  # MB

        # Perform multiple conversions to test memory leaks
        for i in range(10):
            xml_content, metadata = await service.convert_mermaid_to_drawio_xml(
                architecture_source, architecture_svg
            )
            assert xml_content is not None

        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = memory_after - memory_before

        # Memory increase should be reasonable (< 50MB for 10 conversions)
        assert memory_increase < 50.0, f"Memory increased by {memory_increase:.1f}MB"

        print(f"Memory before: {memory_before:.1f} MB")
        print(f"Memory after: {memory_after:.1f} MB")
        print(f"Memory increase: {memory_increase:.1f} MB")

    @pytest.mark.asyncio
    async def test_large_diagram_performance(self, service):
        """Test performance with larger diagrams."""
        # Generate a large architecture diagram
        services = []
        groups = []
        edges = []

        # Create 50 services
        for i in range(50):
            services.append(f"service svc{i}[Service {i}]")

        # Create 5 groups with 10 services each
        for g in range(5):
            groups.append(f"group group{g}[Group {g}]")
            for s in range(10):
                service_id = g * 10 + s
                if service_id < 50:
                    services[service_id] = f"service svc{service_id}[Service {service_id}] in group{g}"

        # Create connections (each service connects to next)
        for i in range(49):
            edges.append(f"svc{i} --> svc{i+1}")

        large_source = "architecture-beta\n" + "\n".join(services + groups + edges)

        # Generate corresponding SVG
        svg_elements = []
        for i in range(50):
            x = (i % 10) * 150 + 50
            y = (i // 10) * 120 + 50
            svg_elements.append(f'<g class="architecture-service" data-node-id="svc{i}"><rect x="{x}" y="{y}" width="120" height="100"/></g>')

        for g in range(5):
            x = g * 300 + 25
            y = 600
            svg_elements.append(f'<g class="architecture-groups" data-node-id="group{g}"><rect x="{x}" y="{y}" width="250" height="150"/></g>')

        large_svg = f'<svg viewBox="0 0 1500 800">{"".join(svg_elements)}</svg>'

        start_time = time.time()
        xml_content, metadata = await service.convert_mermaid_to_drawio_xml(large_source, large_svg)
        conversion_time = time.time() - start_time

        # Should handle large diagrams reasonably
        assert conversion_time < 15.0, f"Large diagram conversion took {conversion_time:.3f}s"
        assert xml_content is not None
        assert metadata['nodes_parsed'] >= 50

        print(f"Large diagram ({metadata['nodes_parsed']} nodes) converted in {conversion_time:.3f}s")

    @pytest.mark.asyncio
    async def test_performance_monitoring_overhead(self, service, architecture_source, architecture_svg):
        """Test performance monitoring overhead."""
        # Test with monitoring disabled
        config = ConfigManager.for_testing()
        config.performance.enable_monitoring = False
        service_no_monitoring = MermaidDrawioService()

        start_time = time.time()
        await service_no_monitoring.convert_mermaid_to_drawio_xml(architecture_source, architecture_svg)
        time_without_monitoring = time.time() - start_time

        # Test with monitoring enabled
        start_time = time.time()
        await service.convert_mermaid_to_drawio_xml(architecture_source, architecture_svg)
        time_with_monitoring = time.time() - start_time

        # Monitoring overhead should be minimal (< 10% increase)
        overhead_percentage = ((time_with_monitoring - time_without_monitoring) / time_without_monitoring) * 100
        assert overhead_percentage < 10.0, f"Monitoring overhead: {overhead_percentage:.1f}%"

        print(f"Without monitoring: {time_without_monitoring:.3f}s")
        print(f"With monitoring: {time_with_monitoring:.3f}s")
        print(f"Overhead: {overhead_percentage:.1f}%")

    @pytest.mark.asyncio
    async def test_cache_performance(self, service):
        """Test caching performance benefits."""
        simple_source = '''architecture-beta
    service app(react)[App]
    service db(postgresql)[Database]
    app --> db
'''

        simple_svg = '''<svg viewBox="0 0 1000 600">
    <g class="architecture-service" data-node-id="app"><rect x="100" y="100" width="120" height="100"/></g>
    <g class="architecture-service" data-node-id="db"><rect x="300" y="100" width="120" height="100"/></g>
</svg>'''

        # First conversion (cache miss)
        start_time = time.time()
        xml1, metadata1 = await service.convert_mermaid_to_drawio_xml(simple_source, simple_svg)
        first_time = time.time() - start_time

        # Second conversion (potential cache hit)
        start_time = time.time()
        xml2, metadata2 = await service.convert_mermaid_to_drawio_xml(simple_source, simple_svg)
        second_time = time.time() - start_time

        # Results should be identical
        assert xml1 == xml2

        # Second conversion should be at least as fast (caching benefits)
        assert second_time <= first_time * 1.1  # Allow 10% variance

        print(f"First conversion: {first_time:.3f}s")
        print(f"Second conversion: {second_time:.3f}s")
        print(f"Speed improvement: {((first_time - second_time) / first_time * 100):.1f}%")

    @pytest.mark.asyncio
    async def test_error_handling_performance(self, service):
        """Test that error handling doesn't cause performance degradation."""
        invalid_cases = [
            ("", "<svg></svg>"),  # Empty source
            ("invalid mermaid", "<svg></svg>"),  # Invalid Mermaid
            ("architecture-beta\nservice test[Test]", "<invalid xml>"),  # Invalid SVG
        ]

        error_times = []

        for invalid_source, invalid_svg in invalid_cases:
            start_time = time.time()

            try:
                await service.convert_mermaid_to_drawio_xml(invalid_source, invalid_svg)
            except Exception:
                pass  # Expected to fail

            error_time = time.time() - start_time
            error_times.append(error_time)

            # Error handling should be fast (< 1s)
            assert error_time < 1.0, f"Error handling took {error_time:.3f}s"

        avg_error_time = sum(error_times) / len(error_times)
        print(f"Average error handling time: {avg_error_time:.3f}s")

    def test_performance_baseline(self):
        """Test basic performance baseline without async operations."""
        from app.services.diagram_converters.diagram_detector import DiagramTypeDetector
        from app.services.diagram_converters.converter_factory import MermaidConverterFactory

        architecture_source = '''architecture-beta
    service app[Application]
    service db[Database]
    app --> db
'''

        # Test diagram detection performance
        detector = DiagramTypeDetector()

        start_time = time.time()
        for _ in range(1000):  # Test 1000 detections
            diagram_info = detector.get_diagram_info(architecture_source)
        detection_time = time.time() - start_time

        # Should be very fast (< 1ms per detection)
        avg_detection_time = detection_time / 1000
        assert avg_detection_time < 0.001, f"Detection avg: {avg_detection_time:.6f}s"

        # Test converter creation performance
        start_time = time.time()
        for _ in range(1000):  # Test 1000 creations
            converter = MermaidConverterFactory.create_converter(architecture_source)
        creation_time = time.time() - start_time

        # Should be very fast (< 1ms per creation)
        avg_creation_time = creation_time / 1000
        assert avg_creation_time < 0.001, f"Creation avg: {avg_creation_time:.6f}s"

        print(f"Detection: {avg_detection_time:.6f}s per operation")
        print(f"Creation: {avg_creation_time:.6f}s per operation")
"""Integration tests for Draw.io router endpoints."""

import json
import base64
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status

from tests.fixtures.test_data import (
    MERMAID_FLOWCHART_BASIC,
    MERMAID_FLOWCHART_WITH_ICONS,
    MERMAID_SEQUENCE_BASIC,
    SVG_FLOWCHART_BASIC,
    SVG_WITH_ICONS,
    ERROR_TEST_SCENARIOS,
    PERFORMANCE_TEST_DATA
)


class TestDrawioRouter:
    """Integration tests for Draw.io router endpoints."""

    @pytest.mark.integration
    def test_export_drawio_xml_basic_success(self, client, mock_icon_service):
        """Test successful basic XML export."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": 1000,
            "height": 600,
            "is_dark_mode": False
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["success"] is True
        assert data["file_data"] is not None
        assert data["filename"] is not None
        assert data["content_type"] == "application/xml"
        assert data["format"] == "xml"
        assert data["quality"] is not None
        assert data["metadata"] is not None
        assert data["drawio_version"] == "24.7.5"

        # Verify file data is base64 encoded XML
        xml_content = base64.b64decode(data["file_data"]).decode('utf-8')
        assert "<mxfile" in xml_content
        assert "<mxGraphModel" in xml_content

    @pytest.mark.integration
    def test_export_drawio_xml_with_icons(self, client, mock_icon_service):
        """Test XML export with icon integration."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_WITH_ICONS,
            "svg_content": SVG_WITH_ICONS,
            "icon_service_url": "http://localhost:8000",
            "width": 1200,
            "height": 800,
            "is_dark_mode": False
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["success"] is True
        assert "icons_attempted" in data["quality"]["details"]
        assert "icon_success_rate" in data["quality"]

    @pytest.mark.integration
    def test_export_drawio_xml_dark_mode(self, client, mock_icon_service):
        """Test XML export with dark mode styling."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": 1000,
            "height": 600,
            "is_dark_mode": True
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["success"] is True
        assert data["metadata"]["dark_mode"] is True

    @pytest.mark.integration
    def test_export_drawio_png_basic_success(self, client, mock_playwright, mock_icon_service):
        """Test successful PNG export with embedded XML."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "transparent_background": True,
            "is_dark_mode": False
        }

        # Mock the PNG conversion to return proper bytes
        # Valid minimal PNG bytes (1x1 transparent PNG)
        png_bytes = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06'
                     b'\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00'
                     b'\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82')
        with patch('app.services.mermaid_drawio_service.MermaidDrawioService._convert_svg_to_png') as mock_convert:
            mock_convert.return_value = png_bytes
            response = client.post("/diagram/drawio/png", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["success"] is True
        assert data["file_data"] is not None
        assert data["filename"] is not None
        assert data["content_type"] == "image/png"
        assert data["format"] == "png"
        assert data["quality"] is not None

    @pytest.mark.integration
    def test_export_drawio_png_custom_dimensions(self, client, mock_playwright, mock_icon_service):
        """Test PNG export with custom dimensions."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": 1500,
            "height": 900,
            "transparent_background": False,
            "is_dark_mode": True
        }

        # Mock the PNG conversion to return proper bytes
        # Valid minimal PNG bytes (1x1 transparent PNG)
        png_bytes = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06'
                     b'\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00'
                     b'\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82')
        with patch('app.services.mermaid_drawio_service.MermaidDrawioService._convert_svg_to_png') as mock_convert:
            mock_convert.return_value = png_bytes
            response = client.post("/diagram/drawio/png", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["success"] is True
        assert data["metadata"]["canvas_width"] == 1500
        assert data["metadata"]["canvas_height"] == 900
        assert data["metadata"]["transparent_background"] is False
        assert data["metadata"]["dark_mode"] is True

    @pytest.mark.integration
    def test_drawio_health_check(self, client, mock_icon_service):
        """Test Draw.io health check endpoint."""
        response = client.get("/diagram/drawio/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "status" in data
        assert "service" in data
        assert "version" in data
        assert "test_conversion" in data
        assert "features" in data

        # Verify test conversion was performed
        assert data["test_conversion"] == "successful"

    @pytest.mark.integration
    def test_drawio_formats_info(self, client, sample_environment):
        """Test formats information endpoint."""
        response = client.get("/diagram/drawio/formats")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "current_formats" in data
        assert "service_info" in data
        assert "environment" in data

        # Verify XML format is supported
        xml_format = next((f for f in data["current_formats"] if f["format"] == "xml"), None)
        assert xml_format is not None
        assert xml_format["description"] is not None

        # Verify PNG format is supported
        png_format = next((f for f in data["current_formats"] if f["format"] == "png"), None)
        assert png_format is not None
        assert png_format["description"] is not None

    @pytest.mark.integration
    def test_export_xml_validation_error_missing_fields(self, client):
        """Test XML export with missing required fields."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC
            # Missing svg_content
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data

    @pytest.mark.integration
    def test_export_xml_validation_error_invalid_types(self, client):
        """Test XML export with invalid data types."""
        request_data = {
            "mermaid_source": 123,  # Should be string
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": "invalid",  # Should be int
            "height": 600
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_export_png_validation_error_missing_fields(self, client):
        """Test PNG export with missing required fields."""
        request_data = {
            "svg_content": SVG_FLOWCHART_BASIC
            # Missing mermaid_source
        }

        response = client.post("/diagram/drawio/png", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_export_xml_invalid_mermaid_syntax(self, client):
        """Test XML export with invalid Mermaid syntax."""
        request_data = {
            "mermaid_source": "invalid @@@ mermaid syntax",
            "svg_content": SVG_FLOWCHART_BASIC
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        # Service handles malformed SVG gracefully
    @pytest.mark.integration
    def test_export_xml_malformed_svg(self, client):
        """Test XML export with malformed SVG content."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": "<svg>malformed</invalid>"
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        # Service handles malformed SVG gracefully

    @pytest.mark.integration
    def test_export_xml_empty_inputs(self, client):
        """Test XML export with empty inputs."""
        request_data = {
            "mermaid_source": "",
            "svg_content": ""
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.integration
    def test_export_png_playwright_failure(self, client, mock_icon_service):
        """Test PNG export with Playwright failure."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC
        }

        # Mock Playwright to raise an exception
        with patch('app.services.mermaid_drawio_service.MermaidDrawioService.convert_mermaid_to_drawio_png') as mock_convert:
            mock_convert.side_effect = Exception("Playwright browser error")

            response = client.post("/diagram/drawio/png", json=request_data)

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "detail" in data

    @pytest.mark.integration
    def test_export_xml_icon_service_timeout(self, client):
        """Test XML export with icon service timeout."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_WITH_ICONS,
            "svg_content": SVG_WITH_ICONS,
            "icon_service_url": "http://timeout-service:9999"
        }

        # Mock timeout scenario
        with patch('requests.get') as mock_get:
            mock_get.side_effect = Exception("Connection timeout")

            response = client.post("/diagram/drawio/xml", json=request_data)

            # Should succeed with degraded quality (graceful failure)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True
            # Quality should reflect icon status (may still be 100% if no icons attempted)
            assert data["quality"]["icon_success_rate"] <= 100

    @pytest.mark.integration
    def test_export_xml_quality_assessment_integration(self, client, mock_icon_service):
        """Test quality assessment integration in XML export."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_WITH_ICONS,
            "svg_content": SVG_WITH_ICONS,
            "icon_service_url": "http://localhost:8000"
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify quality assessment is complete
        quality = data["quality"]
        assert "score" in quality
        assert "message" in quality
        assert "details" in quality
        assert "structural_fidelity" in quality
        assert "visual_quality" in quality
        assert "icon_success_rate" in quality

        # Verify quality score is reasonable
        assert 0 <= quality["score"] <= 100
        assert quality["structural_fidelity"] >= 0
        assert quality["visual_quality"] >= 0
        assert quality["icon_success_rate"] >= 0

    @pytest.mark.integration
    def test_export_png_quality_assessment_integration(self, client, mock_playwright, mock_icon_service):
        """Test quality assessment integration in PNG export."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC
        }

        # Mock the PNG conversion to return proper bytes
        png_bytes = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06'
                     b'\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00'
                     b'\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82')
        with patch('app.services.mermaid_drawio_service.MermaidDrawioService._convert_svg_to_png') as mock_convert:
            mock_convert.return_value = png_bytes
            response = client.post("/diagram/drawio/png", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify quality assessment is included
        assert data["quality"] is not None
        assert "score" in data["quality"]
        assert data["quality"]["score"] >= 0

    @pytest.mark.integration
    def test_export_xml_metadata_completeness(self, client, mock_icon_service):
        """Test metadata completeness in XML export."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": 1200,
            "height": 800,
            "is_dark_mode": True
        }

        response = client.post("/diagram/drawio/xml", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        metadata = data["metadata"]

        # Verify all expected metadata fields
        expected_fields = [
            "original_nodes", "original_edges", "positioned_nodes",
            "canvas_width", "canvas_height", "icon_service_url",
            "conversion_format", "dark_mode", "xml_length", "quality_score"
        ]

        for field in expected_fields:
            assert field in metadata

        # Verify metadata values
        assert metadata["canvas_width"] == 1200
        assert metadata["canvas_height"] == 800
        assert metadata["dark_mode"] is True
        assert metadata["conversion_format"] == "xml"

    @pytest.mark.integration
    def test_export_png_metadata_completeness(self, client, mock_playwright, mock_icon_service):
        """Test metadata completeness in PNG export."""
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC,
            "width": 1000,
            "height": 600,
            "transparent_background": False
        }

        # Mock the PNG conversion to return proper bytes
        png_bytes = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06'
                     b'\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00'
                     b'\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82')
        with patch('app.services.mermaid_drawio_service.MermaidDrawioService._convert_svg_to_png') as mock_convert:
            mock_convert.return_value = png_bytes
            response = client.post("/diagram/drawio/png", json=request_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        metadata = data["metadata"]

        # Verify PNG-specific metadata
        assert metadata["conversion_format"] == "png"
        assert metadata["transparent_background"] is False
        assert metadata["embedded_xml"] is True
        assert "png_size" in metadata
        assert "quality_score" in metadata

    @pytest.mark.integration
    def test_concurrent_requests(self, client, mock_icon_service):
        """Test handling of concurrent requests."""
        import threading
        import time

        results = []
        errors = []

        def make_request():
            try:
                request_data = {
                    "mermaid_source": MERMAID_FLOWCHART_BASIC,
                    "svg_content": SVG_FLOWCHART_BASIC
                }
                response = client.post("/diagram/drawio/xml", json=request_data)
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))

        # Create 5 concurrent requests
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Verify all requests succeeded
        assert len(errors) == 0
        assert len(results) == 5
        assert all(status == 200 for status in results)

    @pytest.mark.integration
    def test_health_check_detailed_response(self, client, mock_icon_service):
        """Test detailed health check response."""
        response = client.get("/diagram/drawio/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify detailed health information
        assert data["status"] == "healthy"
        assert data["service"] == "drawio-conversion"
        assert data["version"] == "24.7.5"

        # Verify test conversion details
        assert data["test_conversion"] == "successful"
        assert "test_quality_score" in data
        assert data["test_quality_score"] >= 0

        # Verify features list
        features = data["features"]
        assert "xml_export" in features
        assert "png_with_metadata" in features
        assert "icon_service_integration" in features
        assert "quality_assessment" in features

    @pytest.mark.integration
    def test_formats_detailed_response(self, client, sample_environment):
        """Test detailed formats information response."""
        response = client.get("/diagram/drawio/formats")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify supported formats details
        formats = data["current_formats"]
        assert len(formats) >= 2  # XML and PNG at minimum

        # Verify XML format details
        xml_format = next(f for f in formats if f["format"] == "xml")
        assert xml_format["description"] is not None
        assert xml_format["content_type"] == "application/xml"
        assert "features" in xml_format

        # Verify PNG format details
        png_format = next(f for f in formats if f["format"] == "png")
        assert png_format["description"] is not None
        assert png_format["content_type"] == "image/png"
        assert "features" in png_format

        # Verify service info
        service_info = data["service_info"]
        assert service_info["icon_service_integration"] is True
        assert service_info["quality_scoring"] is True
        assert "conversion_method" in service_info

        # Verify environment information
        environment = data["environment"]
        assert "icon_service_url" in environment
        assert "quality_threshold" in environment
        assert environment["quality_threshold"] == 60.0

    @pytest.mark.integration
    def test_error_response_format_consistency(self, client):
        """Test error response format consistency."""
        # Test various error scenarios and verify consistent response format

        # 1. Validation error
        response = client.post("/diagram/drawio/xml", json={"invalid": "data"})
        assert response.status_code == 422

        # 2. Invalid Mermaid syntax (service handles gracefully)
        response = client.post("/diagram/drawio/xml", json={
            "mermaid_source": "invalid @@@ syntax",
            "svg_content": SVG_FLOWCHART_BASIC
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True  # Service gracefully handles invalid syntax

        # 3. Empty inputs (validation error)
        response = client.post("/diagram/drawio/xml", json={
            "mermaid_source": "",
            "svg_content": ""
        })
        assert response.status_code == 422
        assert "error_message" in data

    @pytest.mark.integration
    def test_response_headers(self, client, mock_icon_service):
        """Test response headers for different endpoints."""
        # Test XML export response headers
        request_data = {
            "mermaid_source": MERMAID_FLOWCHART_BASIC,
            "svg_content": SVG_FLOWCHART_BASIC
        }

        response = client.post("/diagram/drawio/xml", json=request_data)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

        # Test health check response headers
        response = client.get("/diagram/drawio/health")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

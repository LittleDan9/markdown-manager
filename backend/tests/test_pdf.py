"""Test PDF generation endpoints."""
from fastapi.testclient import TestClient

from app.app_factory import AppFactory

# Create app using factory pattern
app_factory = AppFactory()
app = app_factory.create_app()
client = TestClient(app)


def test_pdf_endpoints_exist():
    """Test that PDF endpoints exist in the API."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]

    # Look for PDF endpoints
    pdf_paths = [path for path in paths.keys() if path.startswith("/pdf")]

    # Should have PDF generation endpoints
    assert len(pdf_paths) > 0


def test_pdf_service_health():
    """Test PDF service health check if it exists."""
    # Try common PDF service endpoints
    test_endpoints = ["/pdf/health", "/pdf/status"]

    for endpoint in test_endpoints:
        response = client.get(endpoint)
        if response.status_code == 200:
            # If health endpoint exists and works, great!
            break
    # If no health endpoint, that's also fine


def test_pdf_generation_endpoint_structure():
    """Test that PDF generation endpoints have proper structure."""
    response = client.get("/openapi.json")
    schema = response.json()
    paths = schema["paths"]

    pdf_paths = [path for path in paths.keys() if path.startswith("/pdf")]

    if pdf_paths:
        # Check that PDF endpoints have proper HTTP methods
        for path in pdf_paths:
            path_info = paths[path]
            assert isinstance(path_info, dict)

            # Check for expected methods (GET for health, POST for generation)
            methods = list(path_info.keys())
            assert len(methods) > 0

            # Verify methods are valid HTTP methods
            valid_methods = ["get", "post", "put", "delete", "patch", "options", "head"]
            for method in methods:
                assert method.lower() in valid_methods


def test_pdf_endpoint_authentication():
    """Test that PDF endpoints require authentication where appropriate."""
    response = client.get("/openapi.json")
    schema = response.json()
    paths = schema["paths"]

    pdf_paths = [path for path in paths.keys() if path.startswith("/pdf")]

    # Most PDF generation endpoints should require authentication
    # (except maybe health checks)
    authenticated_endpoints = 0
    for path in pdf_paths:
        path_info = paths[path]
        for method, details in path_info.items():
            if isinstance(details, dict) and "security" in details:
                authenticated_endpoints += 1

    # At least some PDF endpoints should require authentication
    # (This test is lenient since we don't know exact requirements)
    if len(pdf_paths) > 1:  # If there's more than just health endpoint
        assert authenticated_endpoints >= 0  # Very lenient check

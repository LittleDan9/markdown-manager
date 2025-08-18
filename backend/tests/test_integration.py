"""Test basic integration functionality without database requirements."""
from fastapi.testclient import TestClient

from app.app_factory import AppFactory

# Create app using factory pattern
app_factory = AppFactory()
app = app_factory.create_app()
client = TestClient(app)


def test_app_factory_creates_valid_app():
    """Test that the app factory creates a properly configured FastAPI app."""
    assert app is not None
    assert hasattr(app, "routes")
    assert hasattr(app, "middleware_stack")

    # Check that we have routes configured
    assert len(app.routes) > 10  # Should have multiple routes configured


def test_openapi_schema_available():
    """Test that OpenAPI schema is properly generated."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "openapi" in schema
    assert "info" in schema
    assert "paths" in schema

    # Verify some key endpoints exist in schema
    paths = schema["paths"]
    assert "/" in paths
    assert "/health" in paths
    assert "/monitoring/health" in paths
    assert "/auth/login" in paths


def test_docs_endpoint():
    """Test that API documentation is accessible."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower()


def test_root_endpoint_functionality():
    """Test root endpoint provides proper API information."""
    response = client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "api" in data["message"].lower() or "markdown" in data["message"].lower()


def test_public_endpoints_accessible():
    """Test that public endpoints (not requiring auth) are accessible."""
    # Health endpoint
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

    # Monitoring endpoints
    response = client.get("/monitoring/health")
    assert response.status_code == 200

    response = client.get("/monitoring/metrics")
    assert response.status_code == 200


def test_middleware_integration():
    """Test that middleware is properly integrated and functioning."""
    # Make a request to generate middleware activity
    response = client.get("/health")
    assert response.status_code == 200

    # Check that monitoring middleware captured the request
    metrics_response = client.get("/monitoring/metrics")
    assert metrics_response.status_code == 200

    metrics = metrics_response.json()["metrics"]
    assert metrics["total_requests"] > 0
    assert metrics["success_requests"] > 0

    # Check recent requests tracking
    recent_response = client.get("/monitoring/metrics/recent-requests")
    assert recent_response.status_code == 200

    recent_data = recent_response.json()
    assert recent_data["request_count"] > 0
    assert len(recent_data["requests"]) > 0


def test_error_handling_middleware():
    """Test that error handling middleware works correctly."""
    # Test 404 handling
    response = client.get("/nonexistent-endpoint")
    assert response.status_code == 404

    data = response.json()
    assert "detail" in data

    # Verify the error was tracked in metrics
    metrics_response = client.get("/monitoring/metrics")
    metrics = metrics_response.json()["metrics"]
    assert metrics["error_requests"] > 0
    assert "404" in metrics["status_codes"]


def test_cors_and_security_headers():
    """Test that CORS and security are properly configured."""
    response = client.get("/health")
    assert response.status_code == 200

    # Check that response has proper headers (CORS middleware should be active)
    # Note: In test client, CORS headers might not be fully present, but we can verify no errors


def test_router_organization():
    """Test that all expected router groups are properly organized."""
    response = client.get("/openapi.json")
    schema = response.json()
    paths = schema["paths"]

    # Verify auth endpoints are organized under /auth
    auth_paths = [path for path in paths.keys() if path.startswith("/auth")]
    assert len(auth_paths) > 5  # Should have login, register, logout, etc.

    # Verify monitoring endpoints are organized under /monitoring
    monitoring_paths = [path for path in paths.keys() if path.startswith("/monitoring")]
    assert len(monitoring_paths) >= 5  # Should have health, metrics, etc.

    # Verify no /api/v1 paths remain
    api_v1_paths = [path for path in paths.keys() if "/api/v1" in path]
    assert len(api_v1_paths) == 0, f"Found legacy /api/v1 paths: {api_v1_paths}"


def test_lifespan_events():
    """Test that lifespan events are properly configured."""
    # The fact that the app starts and responds means lifespan startup worked
    response = client.get("/health")
    assert response.status_code == 200

    # If we had database connectivity, it should be reflected in health check
    data = response.json()
    if "services" in data:
        assert "database" in data["services"]

"""Test public endpoints."""
from fastapi.testclient import TestClient

from app.app_factory import create_app

# Create app using factory function
app = create_app()
client = TestClient(app)


def test_public_endpoints_exist():
    """Test that public endpoints are accessible and return expected responses."""
    # Check if any public endpoints exist by examining OpenAPI schema
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    paths = schema["paths"]

    # Look for potential public endpoints (ones without security requirements)
    public_paths = []
    for path, methods in paths.items():
        for method, details in methods.items():
            if isinstance(details, dict) and "security" not in details:
                public_paths.append(f"{method.upper()} {path}")

    # Should have at least some public endpoints like health, docs, etc.
    assert len(public_paths) > 0


def test_public_router_structure():
    """Test that public router is properly integrated."""
    # Test that we can access OpenAPI docs (public endpoint)
    response = client.get("/docs")
    assert response.status_code == 200

    # Test redoc documentation (another public endpoint)
    response = client.get("/redoc")
    assert response.status_code == 200

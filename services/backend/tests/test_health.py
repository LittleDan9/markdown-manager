"""Test the health endpoint."""
from fastapi.testclient import TestClient

from app.app_factory import create_app

# Create app using factory function
app = create_app()
client = TestClient(app)


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    # In test environment, services may be degraded due to missing external dependencies
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data
    assert "services" in data


def test_root_endpoint():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data

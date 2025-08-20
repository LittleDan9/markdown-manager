"""Test the health endpoint."""
from fastapi.testclient import TestClient

from app.app_factory import AppFactory

# Create app using factory pattern
app_factory = AppFactory()
app = app_factory.create_app()
client = TestClient(app)


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_root_endpoint():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data

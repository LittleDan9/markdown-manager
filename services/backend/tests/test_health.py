"""Test the health endpoint."""
import pytest


async def test_health_check(sync_client):
    """Test health check endpoint."""
    response = await sync_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    # In test environment, services may be degraded due to missing external dependencies
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data
    assert "services" in data


async def test_root_endpoint(sync_client):
    """Test root endpoint."""
    response = await sync_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data

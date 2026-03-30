"""Test the monitoring endpoints added in Phase 5."""
import pytest


async def test_monitoring_health(sync_client):
    """Test basic monitoring health endpoint."""
    response = await sync_client.get("/monitoring/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "markdown-manager-api"


async def test_monitoring_health_detailed(sync_client):
    """Test detailed monitoring health endpoint."""
    response = await sync_client.get("/monitoring/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "markdown-manager-api"
    assert "timestamp" in data
    # System metrics may or may not be available depending on psutil installation
    assert "system" in data


async def test_monitoring_metrics(sync_client):
    """Test monitoring metrics endpoint."""
    response = await sync_client.get("/monitoring/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "metrics" in data

    metrics = data["metrics"]
    assert "uptime_seconds" in metrics
    assert "total_requests" in metrics
    assert "requests_per_second" in metrics
    assert "average_response_time" in metrics
    assert "success_rate" in metrics


async def test_monitoring_recent_requests(sync_client):
    """Test recent requests tracking endpoint."""
    response = await sync_client.get("/monitoring/metrics/recent-requests")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "time_window_minutes" in data
    assert "request_count" in data
    assert "requests" in data
    assert isinstance(data["requests"], list)


async def test_monitoring_metrics_reset(sync_client):
    """Test metrics reset endpoint."""
    response = await sync_client.post("/monitoring/metrics/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "message" in data
    assert "reset" in data["message"].lower()


async def test_middleware_request_tracking(sync_client):
    """Test that middleware is properly tracking requests."""
    # Make a few requests to generate metrics
    await sync_client.get("/health")
    await sync_client.get("/monitoring/health")

    # Check that metrics were recorded
    response = await sync_client.get("/monitoring/metrics")
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics"]

    # Should have at least the requests we just made
    assert metrics["total_requests"] >= 2

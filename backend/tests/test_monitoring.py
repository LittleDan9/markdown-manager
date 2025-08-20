"""Test the monitoring endpoints added in Phase 5."""
from fastapi.testclient import TestClient

from app.app_factory import AppFactory

# Create app using factory pattern
app_factory = AppFactory()
app = app_factory.create_app()
client = TestClient(app)


def test_monitoring_health():
    """Test basic monitoring health endpoint."""
    response = client.get("/monitoring/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "markdown-manager-api"


def test_monitoring_health_detailed():
    """Test detailed monitoring health endpoint."""
    response = client.get("/monitoring/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "markdown-manager-api"
    assert "timestamp" in data
    # System metrics may or may not be available depending on psutil installation
    assert "system" in data


def test_monitoring_metrics():
    """Test monitoring metrics endpoint."""
    response = client.get("/monitoring/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "metrics" in data

    metrics = data["metrics"]
    assert "uptime_seconds" in metrics
    assert "total_requests" in metrics
    assert "success_requests" in metrics
    assert "error_requests" in metrics
    assert "requests_per_second" in metrics
    assert "average_response_time_ms" in metrics
    assert "success_rate_percent" in metrics
    assert "status_codes" in metrics


def test_monitoring_recent_requests():
    """Test recent requests tracking endpoint."""
    response = client.get("/monitoring/metrics/recent-requests")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "time_window_minutes" in data
    assert "request_count" in data
    assert "requests" in data
    assert isinstance(data["requests"], list)


def test_monitoring_metrics_reset():
    """Test metrics reset endpoint."""
    response = client.post("/monitoring/metrics/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "message" in data
    assert "reset" in data["message"].lower()


def test_middleware_request_tracking():
    """Test that middleware is properly tracking requests."""
    # Make a few requests to generate metrics
    client.get("/health")
    client.get("/monitoring/health")

    # Check that metrics were recorded
    response = client.get("/monitoring/metrics")
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics"]

    # Should have at least the requests we just made
    assert metrics["total_requests"] >= 2
    assert metrics["success_requests"] >= 2
    assert metrics["success_rate_percent"] > 0

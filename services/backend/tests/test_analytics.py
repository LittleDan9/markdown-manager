"""Tests for the analytics ingestion endpoint."""
import pytest


class TestAnalyticsEndpoint:
    """Test POST /analytics/events endpoint."""

    async def test_accepts_valid_batch(self, client):
        """Should accept a valid event batch and return 202."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [
                {
                    "event_type": "session_start",
                    "is_authenticated": False,
                    "user_id": None,
                },
                {
                    "event_type": "document_create",
                    "event_data": {"category": "General"},
                    "is_authenticated": False,
                },
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 202
        assert response.json() == {"status": "accepted"}

    async def test_accepts_authenticated_events(self, client):
        """Should accept events from authenticated users."""
        payload = {
            "session_id": "def12345-1234-1234-1234-123456789abc",
            "events": [
                {
                    "event_type": "document_edit",
                    "is_authenticated": True,
                    "user_id": 42,
                }
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 202

    async def test_rejects_unknown_event_type(self, client):
        """Should reject events with unknown type."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [
                {
                    "event_type": "malicious_event",
                    "is_authenticated": False,
                }
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 422

    async def test_rejects_empty_events_list(self, client):
        """Should reject batch with no events."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 422

    async def test_rejects_missing_session_id(self, client):
        """Should reject batch without session_id."""
        payload = {
            "events": [
                {"event_type": "session_start", "is_authenticated": False}
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 422

    async def test_rejects_oversized_batch(self, client):
        """Should reject batch with more than 50 events."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [
                {"event_type": "document_edit", "is_authenticated": False}
                for _ in range(51)
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 422

    async def test_strips_negative_user_id(self, client):
        """Should normalize user_id=-1 (guest) to null."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [
                {
                    "event_type": "session_start",
                    "is_authenticated": False,
                    "user_id": -1,
                }
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 202

    async def test_rate_limiting(self, client):
        """Should enforce rate limiting per session (50 requests/window)."""
        session_id = "ratelim0-1234-1234-1234-123456789abc"

        # Send 50 requests (one event each) to exhaust the limit
        for _ in range(50):
            payload = {
                "session_id": session_id,
                "events": [
                    {"event_type": "document_edit", "is_authenticated": False}
                ],
            }
            response = await client.post("/analytics/events", json=payload)
            assert response.status_code == 202

        # 51st request should be rate limited
        payload = {
            "session_id": session_id,
            "events": [
                {"event_type": "document_edit", "is_authenticated": False}
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 429
        assert "Rate limit" in response.json()["detail"]

    async def test_different_sessions_independent_rate_limits(self, client):
        """Different session_ids should have independent rate limits."""
        # Fill up session A with 50 requests
        for _ in range(50):
            payload = {
                "session_id": "sessiona-1234-1234-1234-12345678abc",
                "events": [
                    {"event_type": "document_edit", "is_authenticated": False}
                ],
            }
            await client.post("/analytics/events", json=payload)

        # Session B should still work
        payload = {
            "session_id": "sessionb-1234-1234-1234-12345678abc",
            "events": [
                {"event_type": "session_start", "is_authenticated": False}
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 202

    async def test_all_valid_event_types(self, client):
        """All defined event types should be accepted."""
        valid_types = [
            "session_start",
            "document_create",
            "document_edit",
            "document_delete",
            "feature_attempt_blocked",
            "login_modal_opened",
            "registration_completed",
        ]
        for event_type in valid_types:
            payload = {
                "session_id": f"type-test-1234-1234-123456789abc",
                "events": [
                    {"event_type": event_type, "is_authenticated": False}
                ],
            }
            response = await client.post("/analytics/events", json=payload)
            assert response.status_code == 202, (
                f"Event type '{event_type}' was rejected"
            )

    async def test_event_data_is_optional(self, client):
        """event_data should be optional (null or omitted)."""
        payload = {
            "session_id": "abc12345-1234-1234-1234-123456789abc",
            "events": [
                {"event_type": "session_start", "is_authenticated": False},
                {
                    "event_type": "feature_attempt_blocked",
                    "event_data": {"feature": "git_integration"},
                    "is_authenticated": False,
                },
            ],
        }
        response = await client.post("/analytics/events", json=payload)
        assert response.status_code == 202

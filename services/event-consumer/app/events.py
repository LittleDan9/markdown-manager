"""Simple events validation for configurable consumer."""

import logging
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

logger = logging.getLogger(__name__)


class EventTypes:
    """Event type constants."""
    USER_CREATED = "UserCreated"
    USER_UPDATED = "UserUpdated"
    USER_DISABLED = "UserDisabled"


class EventEnvelope:
    """Event envelope structure."""

    def __init__(self, data: Dict[str, Any]):
        self.event_id = data.get("event_id")
        self.event_type = data.get("event_type")
        self.topic = data.get("topic")
        self.schema_version = data.get("schema_version", 1)
        self.occurred_at = data.get("occurred_at")
        self.tenant_id = data.get("tenant_id")
        self.aggregate_id = data.get("aggregate_id")
        self.aggregate_type = data.get("aggregate_type", "user")
        self.payload = data.get("payload", {})


class UserCreatedPayload:
    """UserCreated event payload."""

    def __init__(self, data: Dict[str, Any]):
        self.tenant_id = UUID(data.get("tenant_id"))
        self.user_id = UUID(data.get("user_id"))
        self.email = data.get("email")
        self.display_name = data.get("display_name")
        self.status = data.get("status", "active")
        self.created_at = data.get("created_at")


class UserUpdatedPayload:
    """UserUpdated event payload."""

    def __init__(self, data: Dict[str, Any]):
        self.tenant_id = UUID(data.get("tenant_id"))
        self.user_id = UUID(data.get("user_id"))
        self.email = data.get("email")
        self.display_name = data.get("display_name")
        self.status = data.get("status", "active")
        self.updated_at = data.get("updated_at")


class UserDisabledPayload:
    """UserDisabled event payload."""

    def __init__(self, data: Dict[str, Any]):
        self.tenant_id = UUID(data.get("tenant_id"))
        self.user_id = UUID(data.get("user_id"))
        self.disabled_at = data.get("disabled_at")


class EventValidator:
    """Simple event validator."""

    def validate_event(self, event_data: Dict[str, Any]) -> Optional[Tuple[EventEnvelope, Any]]:
        """Validate and parse event data."""
        try:
            envelope = EventEnvelope(event_data)

            # Validate required fields
            if not all([
                envelope.event_id,
                envelope.event_type,
                envelope.tenant_id,
                envelope.aggregate_id
            ]):
                logger.error("Missing required envelope fields")
                return None

            # Parse payload based on event type
            payload_data = envelope.payload

            if envelope.event_type == EventTypes.USER_CREATED:
                payload = UserCreatedPayload(payload_data)
            elif envelope.event_type == EventTypes.USER_UPDATED:
                payload = UserUpdatedPayload(payload_data)
            elif envelope.event_type == EventTypes.USER_DISABLED:
                payload = UserDisabledPayload(payload_data)
            else:
                logger.warning(f"Unknown event type: {envelope.event_type}")
                return None

            return envelope, payload

        except Exception as e:
            logger.error(f"Event validation failed: {e}")
            return None
"""Event validation utilities using Pydantic models."""

import json
from pathlib import Path
from typing import Any, Dict, Optional
from enum import Enum

try:
    from .models import (
        EnvelopeV1,
        UserCreated,
        UserUpdated,
        UserDisabled,
    )
except ImportError:
    # Fallback if models haven't been generated yet
    EnvelopeV1 = None
    UserCreated = None
    UserUpdated = None
    UserDisabled = None


class EventTypes(str, Enum):
    """Supported event types."""
    USER_CREATED = "UserCreated"
    USER_UPDATED = "UserUpdated"
    USER_DISABLED = "UserDisabled"


class Topics(str, Enum):
    """Redis stream topics."""
    IDENTITY_USER_V1 = "identity.user.v1"


class EventValidator:
    """Validates events using Pydantic models."""

    def __init__(self):
        self.payload_models = {
            EventTypes.USER_CREATED: UserCreated,
            EventTypes.USER_UPDATED: UserUpdated,
            EventTypes.USER_DISABLED: UserDisabled,
        }

    def validate_envelope(self, event_data: Dict[str, Any]) -> bool:
        """Validate event envelope structure."""
        if EnvelopeV1 is None:
            raise RuntimeError("Pydantic models not generated. Run: datamodel-codegen")

        try:
            EnvelopeV1.model_validate(event_data)
            return True
        except Exception as e:
            print(f"Envelope validation failed: {e}")
            return False

    def validate_payload(self, event_type: str, payload: Dict[str, Any]) -> bool:
        """Validate event payload based on event type."""
        if event_type not in self.payload_models:
            print(f"Unknown event type: {event_type}")
            return False

        model_class = self.payload_models[event_type]
        if model_class is None:
            raise RuntimeError("Pydantic models not generated. Run: datamodel-codegen")

        try:
            model_class.model_validate(payload)
            return True
        except Exception as e:
            print(f"Payload validation failed for {event_type}: {e}")
            return False

    def validate_event(self, event_data: Dict[str, Any]) -> bool:
        """Validate complete event including envelope and payload."""
        # Validate envelope
        if not self.validate_envelope(event_data):
            return False

        # Validate payload
        event_type = event_data.get("event_type")
        payload = event_data.get("payload", {})

        return self.validate_payload(event_type, payload)

    def create_envelope(
        self,
        event_id: str,
        event_type: str,
        topic: str,
        tenant_id: str,
        aggregate_id: str,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None,
        aggregate_type: str = "user",
        schema_version: int = 1,
    ) -> Dict[str, Any]:
        """Create a valid event envelope."""
        from datetime import datetime, timezone

        envelope = {
            "event_id": event_id,
            "event_type": event_type,
            "topic": topic,
            "schema_version": schema_version,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": tenant_id,
            "aggregate_id": aggregate_id,
            "aggregate_type": aggregate_type,
            "payload": payload,
        }

        if correlation_id:
            envelope["correlation_id"] = correlation_id

        return envelope


# Global validator instance
event_validator = EventValidator()
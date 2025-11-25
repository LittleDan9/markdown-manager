"""Event validation utilities using the generated Pydantic models."""

from typing import Any, Dict, Union
from pydantic import ValidationError

from .models.envelope_v1 import EventEnvelopeV1

# Import from generated models with correct path
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'models', 'identity_user.v1'))

from UserCreated import UserCreatedEvent as UserCreated
from UserUpdated import UserUpdatedEvent as UserUpdated
from UserDisabled import UserDisabledEvent as UserDisabled
from .constants import EventTypes


def validate_envelope(data: Dict[str, Any]) -> bool:
    """Validate event envelope structure."""
    try:
        EventEnvelopeV1(**data)
        return True
    except ValidationError as e:
        print(f"Envelope validation failed: {e}")
        return False


def validate_user_created(data: Dict[str, Any]) -> bool:
    """Validate UserCreated payload."""
    try:
        UserCreated(**data)
        return True
    except ValidationError as e:
        print(f"UserCreated validation failed: {e}")
        return False


def validate_user_updated(data: Dict[str, Any]) -> bool:
    """Validate UserUpdated payload."""
    try:
        UserUpdated(**data)
        return True
    except ValidationError as e:
        print(f"UserUpdated validation failed: {e}")
        return False


def validate_user_disabled(data: Dict[str, Any]) -> bool:
    """Validate UserDisabled payload."""
    try:
        UserDisabled(**data)
        return True
    except ValidationError as e:
        print(f"UserDisabled validation failed: {e}")
        return False


def validate_event(event_data: Dict[str, Any]) -> bool:
    """
    Validate complete event (envelope + payload).

    Args:
        event_data: Dictionary containing the complete event

    Returns:
        bool: True if valid, False otherwise
    """
    # First validate envelope
    if not validate_envelope(event_data):
        return False

    # Then validate payload based on event type
    event_type = event_data.get("event_type")
    payload = event_data.get("payload", {})

    if event_type == EventTypes.USER_CREATED:
        return validate_user_created(payload)
    elif event_type == EventTypes.USER_UPDATED:
        return validate_user_updated(payload)
    elif event_type == EventTypes.USER_DISABLED:
        return validate_user_disabled(payload)
    else:
        print(f"Unknown event type: {event_type}")
        return False


__all__ = [
    "validate_event",
    "validate_envelope",
    "validate_user_created",
    "validate_user_updated",
    "validate_user_disabled",
]
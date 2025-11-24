"""
Events Core Package - Event schemas and Pydantic models for markdown-manager microservices.

This package provides:
- JSON Schema definitions for all domain events
- Generated Pydantic models for type safety and validation
- Event validation utilities
- Constants for event types and topics
"""

# Import models - using actual generated class names
from .models.envelope_v1 import EventEnvelopeV1

# Import from generated models with their actual class names
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'models', 'identity_user.v1'))

from UserCreated import UserCreatedEvent as UserCreated
from UserUpdated import UserUpdatedEvent as UserUpdated
from UserDisabled import UserDisabledEvent as UserDisabled

# Import validators
from .validators import (
    validate_event,
    validate_envelope,
    validate_user_created,
    validate_user_updated,
    validate_user_disabled,
)

# Import constants
from .constants import EventTypes, Topics

__version__ = "1.0.0"
__all__ = [
    # Models (generated)
    "EventEnvelopeV1",
    "UserCreated",
    "UserUpdated",
    "UserDisabled",
    # Validators
    "validate_event",
    "validate_envelope",
    "validate_user_created",
    "validate_user_updated",
    "validate_user_disabled",
    # Constants
    "EventTypes",
    "Topics",
]
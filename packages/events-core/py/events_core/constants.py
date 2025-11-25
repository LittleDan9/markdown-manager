"""Constants for event types and topics."""

from typing import Final


class EventTypes:
    """Event type constants."""
    USER_CREATED: Final[str] = "UserCreated"
    USER_UPDATED: Final[str] = "UserUpdated"
    USER_DISABLED: Final[str] = "UserDisabled"


class Topics:
    """Stream topic constants."""
    IDENTITY_USER_V1: Final[str] = "identity.user.v1"
    SPELL_USER_DICT_V1: Final[str] = "spell.user-dict.v1"


__all__ = ["EventTypes", "Topics"]
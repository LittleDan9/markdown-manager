"""Constants for event types and topics."""

from typing import Final


class EventTypes:
    """Event type constants."""
    USER_CREATED: Final[str] = "UserCreated"
    USER_UPDATED: Final[str] = "UserUpdated"
    USER_DISABLED: Final[str] = "UserDisabled"
    DICTIONARY_WORD_ADDED: Final[str] = "DictionaryWordAdded"
    DICTIONARY_WORD_REMOVED: Final[str] = "DictionaryWordRemoved"
    AI_PROVIDER_STATE_PUBLISHED: Final[str] = "AIProviderStatePublished"
    AI_USAGE_PUBLISHED: Final[str] = "AIUsagePublished"


class Topics:
    """Stream topic constants."""
    IDENTITY_USER_V1: Final[str] = "identity.user.v1"
    SPELL_USER_DICT_V1: Final[str] = "spell.user-dict.v1"
    DICTIONARY_WORD_V1: Final[str] = "dictionary.word.v1"
    AI_PROVIDER_V1: Final[str] = "ai.provider.v1"
    AI_USAGE_V1: Final[str] = "ai.usage.v1"


__all__ = ["EventTypes", "Topics"]
"""DateTime utility functions for timezone-aware operations."""

from datetime import datetime, timezone
from typing import Optional


def parse_github_datetime(datetime_str: Optional[str]) -> Optional[datetime]:
    """
    Parse GitHub API datetime string to timezone-aware datetime.

    GitHub API returns dates in ISO 8601 format:
    - "2023-12-31T23:59:59Z" (UTC with Z suffix)
    - "2023-12-31T23:59:59.123Z" (UTC with microseconds and Z suffix)
    - "2023-12-31T23:59:59+00:00" (UTC with explicit timezone offset)

    Args:
        datetime_str: GitHub API datetime string

    Returns:
        Timezone-aware datetime object or None if input is None/invalid
    """
    if not datetime_str:
        return None

    try:
        # Handle GitHub's Z suffix format (most common)
        if datetime_str.endswith('Z'):
            # Remove Z and add explicit UTC timezone
            clean_str = datetime_str[:-1] + '+00:00'
            return datetime.fromisoformat(clean_str)

        # Handle explicit timezone offset format
        if '+' in datetime_str[-6:] or '-' in datetime_str[-6:]:
            return datetime.fromisoformat(datetime_str)

        # Fallback: assume UTC if no timezone info
        dt = datetime.fromisoformat(datetime_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    except (ValueError, TypeError) as e:
        # Log the error but don't crash the application
        print(f"Warning: Failed to parse datetime '{datetime_str}': {e}")
        return None


def utc_now() -> datetime:
    """Get current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)


def ensure_timezone_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensure datetime object is timezone-aware.

    Args:
        dt: DateTime object that may or may not have timezone info

    Returns:
        Timezone-aware datetime object or None if input is None
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        # Assume UTC for naive datetime objects
        return dt.replace(tzinfo=timezone.utc)

    return dt
"""Shared retry utilities for LLM provider rate-limit handling."""
import asyncio
import logging
import re

logger = logging.getLogger(__name__)

# Default retry schedule: wait times in seconds for each attempt
_DEFAULT_BACKOFF = (1, 3, 6)
_MAX_RETRIES = len(_DEFAULT_BACKOFF)

# Regex to extract retry-after seconds from error messages
_RETRY_AFTER_RE = re.compile(r"retry after (\d+(?:\.\d+)?)s", re.IGNORECASE)


def _parse_retry_after(error_msg: str) -> float | None:
    """Extract retry-after seconds from an error message, if present."""
    m = _RETRY_AFTER_RE.search(error_msg)
    if m:
        return float(m.group(1))
    return None


def is_rate_limit_error(error: Exception) -> bool:
    """Check if an error is a rate-limit (429) error."""
    msg = str(error).lower()
    return "rate limit" in msg or "429" in msg


async def retry_on_rate_limit(coro_factory, provider_name: str = "LLM"):
    """Retry an async callable on rate-limit errors with exponential backoff.

    Args:
        coro_factory: A zero-argument callable that returns a new awaitable each time.
            Must be a factory (not a single coroutine) because coroutines can't be re-awaited.
        provider_name: Name for logging.

    Returns:
        The result of coro_factory() on success.

    Raises:
        The original RuntimeError if all retries are exhausted or the error is not rate-limit.
    """
    last_error = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return await coro_factory()
        except RuntimeError as e:
            if not is_rate_limit_error(e):
                raise
            last_error = e
            if attempt >= _MAX_RETRIES:
                break
            # Use retry-after from the error message if available, else use backoff schedule
            wait = _parse_retry_after(str(e)) or _DEFAULT_BACKOFF[attempt]
            # Cap wait time to prevent absurd delays
            wait = min(wait, 30.0)
            logger.warning(
                "%s rate limited (attempt %d/%d), retrying in %.1fs: %s",
                provider_name, attempt + 1, _MAX_RETRIES + 1, wait, e,
            )
            await asyncio.sleep(wait)

    raise last_error


async def retry_stream_on_rate_limit(stream_factory, provider_name: str = "LLM"):
    """Retry an async generator factory on rate-limit errors with exponential backoff.

    Like retry_on_rate_limit but for async generators (streaming providers).
    Retries if the first iteration raises a rate-limit error.

    Args:
        stream_factory: A zero-argument callable that returns a new async iterator each time.
        provider_name: Name for logging.

    Yields:
        Tokens from the successful stream.

    Raises:
        The original RuntimeError if all retries are exhausted or the error is not rate-limit.
    """
    last_error = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async for token in stream_factory():
                yield token
            return  # Stream completed successfully
        except RuntimeError as e:
            if not is_rate_limit_error(e):
                raise
            last_error = e
            if attempt >= _MAX_RETRIES:
                break
            wait = _parse_retry_after(str(e)) or _DEFAULT_BACKOFF[attempt]
            wait = min(wait, 30.0)
            logger.warning(
                "%s rate limited (attempt %d/%d), retrying in %.1fs: %s",
                provider_name, attempt + 1, _MAX_RETRIES + 1, wait, e,
            )
            await asyncio.sleep(wait)

    raise last_error

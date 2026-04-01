"""
Shared resilient HTTP client for third-party icon API requests.

Provides connection pooling, exponential backoff retries, rate-limit
handling (429 + Retry-After), and configurable timeout tiers.
"""
import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Timeout tiers (seconds)
TIMEOUT_METADATA = 10.0
TIMEOUT_DEFAULT = 30.0
TIMEOUT_BULK = 60.0

_MAX_RETRIES = 3
_BACKOFF_BASE = 1.0  # 1s, 2s, 4s
_DEFAULT_RETRY_AFTER = 5.0


class ResilientHttpClient:
    """Async HTTP client with retry, backoff, and rate-limit awareness.

    Intended to be instantiated once per provider and reused across requests.
    Call ``aclose()`` (or use as an async context manager) to release the
    underlying connection pool.
    """

    def __init__(
        self,
        base_url: str = "",
        timeout: float = TIMEOUT_DEFAULT,
        max_retries: int = _MAX_RETRIES,
    ):
        self._base_url = base_url
        self._timeout = timeout
        self._max_retries = max_retries
        self._client: Optional[httpx.AsyncClient] = None

    # -- lifecycle ----------------------------------------------------------

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=10,
                    keepalive_expiry=30,
                ),
            )
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        await self._ensure_client()
        return self

    async def __aexit__(self, *exc):
        await self.aclose()

    # -- public API ---------------------------------------------------------

    async def get(
        self,
        url: str,
        *,
        params: Optional[dict] = None,
        timeout: Optional[float] = None,
    ) -> httpx.Response:
        """GET with automatic retries and rate-limit handling."""
        return await self._request("GET", url, params=params, timeout=timeout)

    # -- internal -----------------------------------------------------------

    async def _request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[dict] = None,
        timeout: Optional[float] = None,
    ) -> httpx.Response:
        client = await self._ensure_client()
        last_exc: Optional[Exception] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                kwargs: dict = {}
                if params:
                    kwargs["params"] = params
                if timeout:
                    kwargs["timeout"] = timeout

                response = await client.request(method, url, **kwargs)

                if response.status_code == 429:
                    retry_after = self._parse_retry_after(response)
                    logger.warning(
                        "Rate-limited (429) on %s %s — retrying in %.1fs (attempt %d/%d)",
                        method, url, retry_after, attempt, self._max_retries,
                    )
                    await asyncio.sleep(retry_after)
                    continue

                response.raise_for_status()
                return response

            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                # Retry on server errors (5xx); fail fast on client errors
                if 500 <= status < 600 and attempt < self._max_retries:
                    delay = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        "Server error %d on %s %s — retrying in %.1fs (attempt %d/%d)",
                        status, method, url, delay, attempt, self._max_retries,
                    )
                    await asyncio.sleep(delay)
                    last_exc = exc
                    continue
                raise

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout) as exc:
                if attempt < self._max_retries:
                    delay = _BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(
                        "%s on %s %s — retrying in %.1fs (attempt %d/%d)",
                        type(exc).__name__, method, url, delay, attempt, self._max_retries,
                    )
                    await asyncio.sleep(delay)
                    last_exc = exc
                    continue
                raise

        # All retries exhausted (only reachable via 429 loop)
        if last_exc:
            raise last_exc
        raise httpx.ReadTimeout(f"All {self._max_retries} retries exhausted for {method} {url}")

    @staticmethod
    def _parse_retry_after(response: httpx.Response) -> float:
        raw = response.headers.get("Retry-After")
        if raw is not None:
            try:
                return max(float(raw), 0.5)
            except (ValueError, TypeError):
                pass
        return _DEFAULT_RETRY_AFTER

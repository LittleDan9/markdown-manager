"""GitHub Models LLM provider — uses the GitHub Models inference API at
``models.github.ai`` which has slightly different paths and model ID formats
compared to standard OpenAI-compatible APIs."""
from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx

# Models that have rejected optional params (temperature, max_completion_tokens)
# get cached here so we don't waste a request on every call.
_stripped_models: set[str] = set()

from .base import LLMProvider

logger = logging.getLogger(__name__)

GITHUB_MODELS_BASE_URL = "https://models.github.ai"
GITHUB_MODELS_DEFAULT_MODEL = "openai/gpt-4o-mini"


class GitHubModelsProvider(LLMProvider):
    """LLM provider using the GitHub Models inference API.

    Key differences from standard OpenAI-compatible APIs:
    - Base URL: ``https://models.github.ai``
    - Chat completions: ``POST /inference/chat/completions``
    - Model catalog: ``GET /catalog/models``
    - Model IDs use ``publisher/model`` format (e.g. ``openai/gpt-4o-mini``)
    """

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str = GITHUB_MODELS_BASE_URL,
        org_name: str | None = None,
    ):
        if not api_key:
            raise ValueError("api_key is required for GitHub Models provider")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model or GITHUB_MODELS_DEFAULT_MODEL
        self._org_name = org_name or ""

    def _inference_url(self, path: str) -> str:
        """Return the inference endpoint, routed through the org if configured."""
        if self._org_name:
            return f"{self._base_url}/orgs/{self._org_name}{path}"
        return f"{self._base_url}{path}"

    @property
    def provider_name(self) -> str:
        return "github"

    @property
    def model_name(self) -> str:
        return self._model

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _catalog_headers(self) -> dict[str, str]:
        """Headers for the GitHub Models catalog REST API (different from inference)."""
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
        }

    async def stream(
        self,
        prompt: str,
        system_prompt: str = "",
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from the GitHub Models ``/inference/chat/completions`` endpoint."""
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self._model,
            "messages": messages,
            "stream": True,
        }

        # Some GitHub-hosted models (e.g. gpt-5) reject temperature and
        # max_completion_tokens.  We attempt the call with them, and on a
        # 400 "Unsupported" error we retry once without these parameters.
        optional_params = {
            "temperature": 0.3,
            "max_completion_tokens": 2048,
        }

        async for token in self._stream_with_retry(payload, optional_params):
            yield token

    async def _do_stream(self, payload: dict) -> AsyncIterator[str]:
        """Execute a single streaming request and yield tokens."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                self._inference_url("/inference/chat/completions"),
                json=payload,
                headers=self._headers(),
            ) as response:
                if response.status_code == 429:
                    body = await response.aread()
                    retry_after = response.headers.get("retry-after", "")
                    detail = "Rate limited by GitHub Models"
                    if retry_after:
                        detail += f" (retry after {retry_after}s)"
                    try:
                        err_data = json.loads(body)
                        msg = err_data.get("error", {}).get("message", "")
                        if msg:
                            detail += f": {msg}"
                    except (json.JSONDecodeError, AttributeError):
                        pass
                    raise RuntimeError(detail)
                if response.status_code != 200:
                    body = await response.aread()
                    detail = f"GitHub Models API error {response.status_code}"
                    try:
                        err_data = json.loads(body)
                        msg = err_data.get("error", {}).get("message", "")
                        if msg:
                            detail += f": {msg}"
                    except (json.JSONDecodeError, AttributeError):
                        pass
                    raise RuntimeError(detail)
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        choices = data.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            if token := delta.get("content"):
                                yield token
                    except json.JSONDecodeError:
                        continue

    async def _stream_with_retry(
        self, payload: dict, optional_params: dict
    ) -> AsyncIterator[str]:
        """Try streaming with optional_params; on 400 'Unsupported' retry without them.

        Models that reject optional params are cached in ``_stripped_models``
        so subsequent calls skip the doomed first attempt entirely.
        """
        if self._model in _stripped_models or not optional_params:
            async for token in self._do_stream(payload):
                yield token
            return

        attempt_payload = {**payload, **optional_params}
        try:
            async for token in self._do_stream(attempt_payload):
                yield token
        except RuntimeError as exc:
            if "Unsupported" in str(exc):
                _stripped_models.add(self._model)
                logging.getLogger(__name__).warning(
                    "Model %s cached as stripped-params; retrying without %s: %s",
                    self._model, list(optional_params.keys()), exc,
                )
                async for token in self._do_stream(payload):
                    yield token
            else:
                raise

    async def health_check(self) -> bool:
        """Validate the API key by listing the model catalog."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self._base_url}/catalog/models",
                    headers=self._catalog_headers(),
                )
                return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[dict]:
        """Fetch available models with metadata from the GitHub Models catalog."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self._base_url}/catalog/models",
                    headers=self._catalog_headers(),
                )
                response.raise_for_status()
                data = response.json()

                # The catalog may return a bare JSON array or a dict wrapper
                items: list = []
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    # Try common wrapper keys
                    items = data.get("models") or data.get("data") or data.get("value") or []
                    if not isinstance(items, list):
                        items = []
                    logger.info(
                        "GitHub Models catalog returned dict with keys=%s, extracted %d items",
                        list(data.keys()), len(items),
                    )
                else:
                    logger.warning(
                        "GitHub Models catalog returned unexpected type: %s",
                        type(data).__name__,
                    )

                models = []
                for m in items:
                    if "id" not in m:
                        continue
                    entry: dict = {"id": m["id"]}
                    if m.get("name"):
                        entry["name"] = m["name"]
                    if m.get("publisher"):
                        entry["publisher"] = m["publisher"]
                    if m.get("summary"):
                        entry["description"] = m["summary"][:200]
                    limits = m.get("limits") or m.get("model_limits") or {}
                    if limits.get("max_input_tokens"):
                        entry["context_window"] = limits["max_input_tokens"]
                    if limits.get("max_output_tokens"):
                        entry["max_output"] = limits["max_output_tokens"]
                    if m.get("rate_limit_tier"):
                        entry["tier"] = m["rate_limit_tier"]
                    models.append(entry)
                models.sort(key=lambda x: x["id"])
                logger.info("GitHub Models catalog: %d models fetched", len(models))
                return models
        except Exception as exc:
            logger.warning("Failed to list models from GitHub Models: %s", exc)
            return []

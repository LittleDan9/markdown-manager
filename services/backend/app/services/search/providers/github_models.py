"""GitHub Models LLM provider — uses the GitHub Models inference API at
``models.github.ai`` which has slightly different paths and model ID formats
compared to standard OpenAI-compatible APIs."""
from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx

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
    ):
        if not api_key:
            raise ValueError("api_key is required for GitHub Models provider")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model or GITHUB_MODELS_DEFAULT_MODEL

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
            "temperature": 0.3,
            "max_tokens": 2048,
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/inference/chat/completions",
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

    async def health_check(self) -> bool:
        """Validate the API key by listing the model catalog."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self._base_url}/catalog/models",
                    headers=self._headers(),
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
                    headers=self._headers(),
                )
                response.raise_for_status()
                data = response.json()
                models = []
                for m in (data if isinstance(data, list) else []):
                    if "id" not in m:
                        continue
                    entry: dict = {"id": m["id"]}
                    if m.get("name"):
                        entry["name"] = m["name"]
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
                return models
        except Exception as exc:
            logger.warning("Failed to list models from GitHub Models: %s", exc)
            return []

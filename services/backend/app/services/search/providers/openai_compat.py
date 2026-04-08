"""OpenAI-compatible LLM provider — works with OpenAI, xAI Grok, and any API
that implements the ``/chat/completions`` SSE streaming contract."""
from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx

from .base import LLMProvider

logger = logging.getLogger(__name__)

# Well-known base URLs (no trailing slash).
OPENAI_BASE_URL = "https://api.openai.com/v1"
XAI_BASE_URL = "https://api.x.ai/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "xai": "grok-3-mini-fast",
    "gemini": "gemini-2.0-flash",
}


class OpenAICompatProvider(LLMProvider):
    """LLM provider using the OpenAI-compatible ``/chat/completions`` API.

    Works for OpenAI, xAI (Grok), and any service that exposes the same
    streaming SSE interface.
    """

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        base_url: str = OPENAI_BASE_URL,
        provider_id: str = "openai",
    ):
        if not api_key:
            raise ValueError("api_key is required for OpenAI-compatible providers")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model or DEFAULT_MODELS.get(provider_id, "gpt-4o-mini")
        self._provider_id = provider_id

    @property
    def provider_name(self) -> str:
        return self._provider_id

    @property
    def model_name(self) -> str:
        return self._model

    async def stream(
        self,
        prompt: str,
        system_prompt: str = "",
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from an OpenAI-compatible ``/chat/completions`` endpoint."""
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
            "max_completion_tokens": 2048,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code == 429:
                    body = await response.aread()
                    retry_after = response.headers.get("retry-after", "")
                    detail = f"Rate limited by {self._provider_id}"
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
                    detail = f"{self._provider_id} API error {response.status_code}"
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
                    data_str = line[6:]  # strip "data: " prefix
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
        """Validate the API key by listing models (lightweight call)."""
        headers = {"Authorization": f"Bearer {self._api_key}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self._base_url}/models",
                    headers=headers,
                )
                return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[dict]:
        """Fetch available models with metadata from the provider."""
        headers = {"Authorization": f"Bearer {self._api_key}"}
        try:
            # Gemini native endpoint has richer metadata (token limits, description)
            if "generativelanguage.googleapis.com" in self._base_url:
                return await self._list_gemini_native_models(headers)

            # xAI has a richer /v1/language-models endpoint with pricing
            if self._provider_id == "xai":
                return await self._list_xai_models(headers)

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self._base_url}/models",
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
                models = []
                for m in data.get("data", []):
                    if "id" not in m:
                        continue
                    models.append({
                        "id": m["id"],
                        "owned_by": m.get("owned_by", ""),
                    })
                models.sort(key=lambda x: x["id"])
                return models
        except Exception as exc:
            logger.warning("Failed to list models from %s: %s", self._base_url, exc)
            return []

    async def _list_gemini_native_models(self, headers: dict) -> list[dict]:
        """Use Gemini's native ``/v1beta/models`` for richer metadata."""
        # Strip the /openai suffix to reach the native endpoint
        native_base = self._base_url.replace("/openai", "")
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{native_base}/models",
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            models = []
            for m in data.get("models", []):
                # Gemini model names are like "models/gemini-2.0-flash"
                raw_name = m.get("name", "")
                model_id = raw_name.replace("models/", "") if raw_name.startswith("models/") else raw_name
                if not model_id:
                    continue
                entry: dict = {"id": model_id}
                if m.get("displayName"):
                    entry["name"] = m["displayName"]
                if m.get("description"):
                    entry["description"] = m["description"][:200]
                if m.get("inputTokenLimit"):
                    entry["context_window"] = m["inputTokenLimit"]
                if m.get("outputTokenLimit"):
                    entry["max_output"] = m["outputTokenLimit"]
                models.append(entry)
            models.sort(key=lambda x: x["id"])
            return models

    async def _list_xai_models(self, headers: dict) -> list[dict]:
        """Use xAI's ``/v1/language-models`` for pricing metadata."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{self._base_url}/language-models",
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            models = []
            for m in data.get("models", data.get("data", [])):
                model_id = m.get("id", "")
                if not model_id:
                    continue
                entry: dict = {"id": model_id}
                # xAI pricing fields (per-token, we convert to per-1M)
                if m.get("prompt_text_token_price"):
                    try:
                        entry["input_price"] = float(m["prompt_text_token_price"]) * 1_000_000
                    except (ValueError, TypeError):
                        pass
                if m.get("completion_text_token_price"):
                    try:
                        entry["output_price"] = float(m["completion_text_token_price"]) * 1_000_000
                    except (ValueError, TypeError):
                        pass
                models.append(entry)
            models.sort(key=lambda x: x["id"])
            return models

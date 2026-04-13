"""Ollama LLM provider — streams tokens from a local/remote Ollama instance."""
from __future__ import annotations

import json
import logging
import os
from typing import AsyncIterator

import httpx

from .base import LLMProvider

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = "http://ollama:11434"
DEFAULT_MODEL = "qwen2.5:1.5b"


class OllamaProvider(LLMProvider):
    """LLM provider backed by Ollama's ``/api/chat`` multi-turn endpoint."""

    def __init__(self, url: str = DEFAULT_OLLAMA_URL, model: str = DEFAULT_MODEL):
        self._url = url.rstrip("/")
        self._model = model

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def max_history_chars(self) -> int:
        return 2000

    @property
    def max_history_turns(self) -> int:
        return 6

    async def stream(
        self,
        prompt: str,
        system_prompt: str = "",
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from Ollama's ``/api/chat`` endpoint."""
        num_thread = int(os.environ.get("OLLAMA_NUM_THREAD", 0)) or None

        options: dict = {
            "num_ctx": 4096,
            "num_predict": 512,
            "temperature": 0.3,
        }
        if num_thread:
            options["num_thread"] = num_thread

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
            "options": options,
            "keep_alive": "10m",
        }

        # No read timeout — CPU prefill can take minutes for large prompts.
        async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0)) as client:
            async with client.stream(
                "POST",
                f"{self._url}/api/chat",
                json=payload,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    detail = f"Ollama error {response.status_code}"
                    try:
                        err_data = json.loads(body)
                        if msg := err_data.get("error", ""):
                            detail += f": {msg}"
                    except (json.JSONDecodeError, AttributeError):
                        pass
                    raise RuntimeError(detail)
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        message = data.get("message", {})
                        if token := message.get("content", ""):
                            yield token
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

    async def health_check(self) -> bool:
        """Return True if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[dict]:
        """List locally-available Ollama models via ``/api/tags``."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self._url}/api/tags")
                response.raise_for_status()
                data = response.json()
                models = []
                for m in data.get("models", []):
                    name = m.get("name", "")
                    if not name:
                        continue
                    entry: dict = {"id": name, "name": name}
                    details = m.get("details") or {}
                    if details.get("parameter_size"):
                        entry["parameter_size"] = details["parameter_size"]
                    if m.get("size"):
                        # Convert bytes to human-readable
                        size_gb = m["size"] / (1024 ** 3)
                        entry["size"] = f"{size_gb:.1f} GB" if size_gb >= 1 else f"{m['size'] / (1024 ** 2):.0f} MB"
                    models.append(entry)
                models.sort(key=lambda x: x["id"])
                return models
        except Exception as exc:
            logger.warning("Failed to list Ollama models: %s", exc)
            return []

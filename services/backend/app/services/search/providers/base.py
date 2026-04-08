"""Abstract base class for LLM providers."""
from __future__ import annotations

import abc
from typing import AsyncIterator


class LLMProvider(abc.ABC):
    """Interface that all LLM providers must implement."""

    @property
    @abc.abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier (e.g. 'ollama', 'openai', 'xai')."""

    @property
    @abc.abstractmethod
    def model_name(self) -> str:
        """Return the active model name."""

    # ------------------------------------------------------------------
    # History / multi-turn capability hints
    # ------------------------------------------------------------------

    @property
    def max_history_chars(self) -> int:
        """Max total characters of conversation history to include in prompts.

        Providers with small context windows (e.g. Ollama 4096) should override
        with a lower value.  Cloud providers with large context windows can
        keep the default.
        """
        return 8000

    @property
    def max_history_turns(self) -> int:
        """Max number of conversation turns (user+assistant pairs) to retain."""
        return 20

    @abc.abstractmethod
    def stream(
        self,
        prompt: str,
        system_prompt: str = "",
        history: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """Stream response tokens for the given prompt.

        *prompt* is the fully-assembled user/context prompt.
        *system_prompt* is an optional system-level instruction that providers
        may place in a dedicated system role (OpenAI-compatible) or prepend
        to the prompt (Ollama).
        *history* is an optional list of prior conversation turns, each a dict
        with ``role`` and ``content`` keys, ordered oldest-first.

        Yields individual token strings as they arrive.

        Implementations should be async generators (``async def`` with ``yield``).
        """
        ...  # pragma: no cover

    @abc.abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable and functional."""

    async def list_models(self) -> list[dict]:
        """Return available models from the provider.

        Each model is a dict with at least ``id`` (str).  Optional metadata
        keys: ``name``, ``description``, ``context_window`` (int, input
        tokens), ``max_output`` (int, output tokens), ``input_price`` (float,
        per-1M-token), ``output_price`` (float), ``owned_by``, ``tier``.

        Default implementation returns an empty list. Providers that support
        model listing should override this.
        """
        return []

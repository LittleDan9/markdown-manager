"""Factory for creating LLM provider instances."""
from __future__ import annotations

from .base import LLMProvider
from .ollama import OllamaProvider, DEFAULT_OLLAMA_URL, DEFAULT_MODEL
from .openai_compat import OpenAICompatProvider, OPENAI_BASE_URL, XAI_BASE_URL, GEMINI_BASE_URL
from .github_models import GitHubModelsProvider, GITHUB_MODELS_BASE_URL


def get_provider(
    provider_type: str,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> LLMProvider:
    """Create an LLMProvider instance for the given provider type.

    Parameters
    ----------
    provider_type:
        One of ``"ollama"``, ``"openai"``, ``"xai"``, or ``"github"``.
    api_key:
        API key (required for openai/xai/github; ignored for ollama).
    model:
        Model override.  Falls back to provider-specific defaults.
    base_url:
        Base URL override.  Falls back to well-known defaults.
    """
    if provider_type == "ollama":
        return OllamaProvider(
            url=base_url or DEFAULT_OLLAMA_URL,
            model=model or DEFAULT_MODEL,
        )

    if provider_type == "github":
        if not api_key:
            raise ValueError("api_key is required for provider 'github'")
        return GitHubModelsProvider(
            api_key=api_key,
            model=model,
            base_url=base_url or GITHUB_MODELS_BASE_URL,
        )

    if provider_type in ("openai", "xai", "gemini"):
        if not api_key:
            raise ValueError(f"api_key is required for provider '{provider_type}'")
        default_urls = {
            "openai": OPENAI_BASE_URL,
            "xai": XAI_BASE_URL,
            "gemini": GEMINI_BASE_URL,
        }
        return OpenAICompatProvider(
            api_key=api_key,
            model=model,
            base_url=base_url or default_urls[provider_type],
            provider_id=provider_type,
        )

    raise ValueError(f"Unknown provider type: {provider_type!r}")

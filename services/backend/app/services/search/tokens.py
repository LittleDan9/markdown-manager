"""Token counting utilities and per-model context window configuration.

Uses tiktoken for accurate OpenAI/GitHub-Models token counts, with a
character-based fallback for Ollama and other providers.
"""
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

# Per-message overhead (role, delimiters, etc.) — OpenAI uses ~4 tokens per message
_MSG_OVERHEAD_TOKENS = 4
# Reply priming tokens
_REPLY_OVERHEAD_TOKENS = 3

# ---------------------------------------------------------------------------
# Model context windows (input token limits)
# ---------------------------------------------------------------------------
_MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    # OpenAI
    "gpt-4o": 128_000,
    "gpt-4o-mini": 128_000,
    "gpt-4-turbo": 128_000,
    "gpt-4": 8_192,
    "gpt-3.5-turbo": 16_385,
    "o1": 200_000,
    "o1-mini": 128_000,
    "o1-preview": 128_000,
    "o3": 200_000,
    "o3-mini": 200_000,
    "o4-mini": 200_000,
    # Google Gemini
    "gemini-2.0-flash": 1_048_576,
    "gemini-2.5-flash": 1_048_576,
    "gemini-2.5-pro": 1_048_576,
    "gemini-2.0-flash-lite": 1_048_576,
    "gemini-1.5-flash": 1_048_576,
    "gemini-1.5-pro": 2_097_152,
    # xAI Grok
    "grok-3-mini-fast": 131_072,
    "grok-3-mini": 131_072,
    "grok-3": 131_072,
    "grok-2": 131_072,
    # GitHub Models (mapped to their underlying context)
    "ai21-jamba-1.5-large": 256_000,
    "ai21-jamba-1.5-mini": 256_000,
    "cohere-command-r": 128_000,
    "cohere-command-r-plus": 128_000,
    "meta-llama-3.1-405b-instruct": 128_000,
    "meta-llama-3.1-70b-instruct": 128_000,
    "mistral-large": 128_000,
    "mistral-small": 32_000,
    # Local Ollama models
    "qwen2.5:1.5b": 4_096,
    "qwen2.5:3b": 4_096,
    "qwen2.5:7b": 32_768,
    "llama3.2:3b": 8_192,
    "llama3.1:8b": 128_000,
    "mistral:7b": 32_768,
    "phi3:mini": 4_096,
}

# Prefix-match rules: (prefix, context_window)
_MODEL_PREFIX_WINDOWS: list[tuple[str, int]] = [
    ("gpt-4o", 128_000),
    ("gpt-4-turbo", 128_000),
    ("gpt-4", 8_192),
    ("gpt-3.5", 16_385),
    ("o1", 128_000),
    ("o3", 200_000),
    ("o4", 200_000),
    ("gemini-2", 1_048_576),
    ("gemini-1.5", 1_048_576),
    ("grok-3", 131_072),
    ("grok-2", 131_072),
    ("meta-llama", 128_000),
    ("mistral", 32_000),
    ("cohere", 128_000),
    ("qwen2.5", 4_096),
    ("llama3", 8_192),
]

# Reserve tokens for the model's response
_RESPONSE_RESERVE = 4096

# Conservative default for unknown models
_DEFAULT_CONTEXT_WINDOW = 8192

# Fallback: approximate chars per token when tiktoken isn't available
_CHARS_PER_TOKEN_FALLBACK = 4


@lru_cache(maxsize=8)
def _get_tiktoken_encoding(model: str):
    """Get a tiktoken encoding for a model, cached. Returns None if unavailable."""
    try:
        import tiktoken
        try:
            return tiktoken.encoding_for_model(model)
        except KeyError:
            # Unknown model — use cl100k_base (GPT-4 / GPT-3.5 family)
            return tiktoken.get_encoding("cl100k_base")
    except ImportError:
        logger.debug("tiktoken not installed, using character fallback")
        return None


def _is_tiktoken_model(model: str) -> bool:
    """Check if the model is likely an OpenAI-compatible model for tiktoken."""
    prefixes = ("gpt-", "o1", "o3", "o4", "text-", "davinci", "curie", "babbage", "ada")
    return model.startswith(prefixes)


def estimate_tokens(text: str, model: str = "gpt-4o") -> int:
    """Estimate token count for a string.

    Uses tiktoken for OpenAI-compatible models, character heuristic otherwise.
    """
    if not text:
        return 0

    if _is_tiktoken_model(model):
        enc = _get_tiktoken_encoding(model)
        if enc is not None:
            return len(enc.encode(text))

    # Fallback: character-based estimate
    return len(text) // _CHARS_PER_TOKEN_FALLBACK


def estimate_messages_tokens(messages: list[dict], model: str = "gpt-4o") -> int:
    """Estimate total token count for a messages array (OpenAI chat format).

    Accounts for per-message overhead (role, delimiters) and reply priming.
    """
    total = _REPLY_OVERHEAD_TOKENS
    for msg in messages:
        total += _MSG_OVERHEAD_TOKENS
        content = msg.get("content") or ""
        total += estimate_tokens(content, model)
    return total


def get_model_context_window(model: str) -> int:
    """Get the context window size for a model."""
    # Exact match first
    if model in _MODEL_CONTEXT_WINDOWS:
        return _MODEL_CONTEXT_WINDOWS[model]

    # Prefix match
    model_lower = model.lower()
    for prefix, window in _MODEL_PREFIX_WINDOWS:
        if model_lower.startswith(prefix):
            return window

    return _DEFAULT_CONTEXT_WINDOW


def get_context_budget(model: str) -> int:
    """Get the usable input token budget for a model (window minus response reserve).

    For small-context models (< 8192), reserves 25% for the response instead of
    a fixed 4096 to avoid leaving zero budget for input.
    """
    window = get_model_context_window(model)
    if window < 8192:
        return int(window * 0.75)
    return window - _RESPONSE_RESERVE


def truncate_text_to_tokens(text: str, max_tokens: int, model: str = "gpt-4o") -> str:
    """Truncate text to fit within max_tokens, keeping head and tail.

    Preserves the beginning and end of the text (most useful context),
    replacing the middle with an ellipsis marker.
    """
    if not text:
        return text
    current = estimate_tokens(text, model)
    if current <= max_tokens:
        return text

    # Binary search for the right split point
    # Keep ~60% from head, ~40% from tail
    head_ratio = 0.6
    target_chars = int(len(text) * (max_tokens / current))
    head_chars = int(target_chars * head_ratio)
    tail_chars = target_chars - head_chars

    if head_chars < 100:
        head_chars = 100
    if tail_chars < 100:
        tail_chars = 100

    head = text[:head_chars]
    tail = text[-tail_chars:]
    truncated = f"{head}\n\n[... content truncated for context limit ...]\n\n{tail}"

    # Verify and adjust if still over budget
    if estimate_tokens(truncated, model) > max_tokens:
        # Aggressive fallback: just use head
        char_budget = max_tokens * _CHARS_PER_TOKEN_FALLBACK
        return text[:char_budget]

    return truncated

"""Conversation memory management for chat history compression.

Provides rolling-window summarization to keep conversation history compact
and context caching to avoid rebuilding context on every message.
"""
import logging

from app.services.search.tokens import estimate_messages_tokens, get_context_budget

logger = logging.getLogger(__name__)

# Summarize when history tokens exceed this fraction of the model's context budget
_SUMMARIZE_BUDGET_FRACTION = 0.35
# Absolute minimum token threshold before summarization is considered
_SUMMARIZE_MIN_TOKENS = 2000
# Never summarize the most recent N messages, regardless of size
KEEP_RECENT = 4
# Maximum tokens for the rolling conversation summary
MAX_SUMMARY_TOKENS = 500
# Fallback character cap (in case token counting fails)
MAX_SUMMARY_CHARS = 2000


def compress_history(
    history: list[dict],
    model: str = "gpt-4o",
) -> tuple[list[dict], list[dict] | None]:
    """Decide whether history needs compression based on token count.

    Returns:
        (effective_history, messages_to_summarize)
        - If no compression needed: (history, None)
        - If compression needed: (recent_messages_only, older_messages_to_summarize)
    """
    if len(history) <= KEEP_RECENT:
        return history, None

    # Calculate token-based threshold
    budget = get_context_budget(model)
    threshold = max(int(budget * _SUMMARIZE_BUDGET_FRACTION), _SUMMARIZE_MIN_TOKENS)

    history_tokens = estimate_messages_tokens(history, model)
    logger.debug(
        "compress_history: %d messages, %d tokens, threshold=%d (model=%s, budget=%d)",
        len(history), history_tokens, threshold, model, budget,
    )

    if history_tokens <= threshold:
        return history, None

    # Find the split point: keep recent messages that fit within a token budget,
    # with a minimum of KEEP_RECENT messages.
    keep_token_budget = threshold // 2
    keep_count = KEEP_RECENT
    for i in range(len(history) - KEEP_RECENT - 1, -1, -1):
        candidate_recent = history[i:]
        candidate_tokens = estimate_messages_tokens(candidate_recent, model)
        if candidate_tokens <= keep_token_budget:
            keep_count = len(candidate_recent)
        else:
            break

    older = history[:-keep_count]
    recent = history[-keep_count:]

    if not older:
        return history, None

    logger.info(
        "Compressing history: summarizing %d older messages (%d tokens), keeping %d recent",
        len(older), estimate_messages_tokens(older, model), len(recent),
    )
    return recent, older


def cap_summary(summary: str, model: str = "gpt-4o") -> str:
    """Truncate summary to stay within token budget, keeping the newest portion."""
    from app.services.search.tokens import estimate_tokens

    if not summary:
        return summary

    tokens = estimate_tokens(summary, model)
    if tokens <= MAX_SUMMARY_TOKENS:
        return summary

    # Keep newest lines that fit within the budget
    lines = summary.split("\n")
    result_lines: list[str] = []
    for line in reversed(lines):
        candidate = "\n".join([line] + result_lines)
        if estimate_tokens(candidate, model) > MAX_SUMMARY_TOKENS:
            break
        result_lines.insert(0, line)

    if result_lines:
        return "\n".join(result_lines)

    # Fallback: character-based truncation
    if len(summary) > MAX_SUMMARY_CHARS:
        return summary[-MAX_SUMMARY_CHARS:]
    return summary


def build_summarize_prompt(messages_to_summarize: list[dict]) -> list[dict]:
    """Build messages to ask the LLM to summarize conversation history."""
    conversation_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in messages_to_summarize
    )
    return [
        {
            "role": "system",
            "content": (
                "Summarize the following conversation concisely in 2-3 sentences. "
                "Preserve key facts, decisions, and topics discussed. "
                "Write in third person as a factual summary."
            ),
        },
        {"role": "user", "content": conversation_text},
    ]

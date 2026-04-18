"""Parse LLM response text into logical sections separated by thematic breaks (---)."""
from __future__ import annotations

import re
from typing import TypedDict


class ResponseSection(TypedDict):
    type: str        # "context", "primary_content", or "follow_up"
    label: str       # Human-readable label for UI display
    content: str     # Raw markdown content of this section
    confidence: float  # 0.0–1.0 confidence in the type classification


# Matches a markdown thematic break: a line with 3+ dashes and optional whitespace
_THEMATIC_BREAK = re.compile(r"^\s*-{3,}\s*$")

# Matches a fenced code block opening/closing (``` or ~~~, with optional language tag)
_FENCE = re.compile(r"^\s*(`{3,}|~{3,})")


def parse_sections(text: str) -> list[ResponseSection]:
    """Split *text* on ``---`` thematic breaks (outside fenced code blocks)
    and classify each section heuristically.

    Returns a list of :class:`ResponseSection` dicts.  If the text contains
    no thematic breaks, a single ``primary_content`` section is returned.
    """
    if not text or not text.strip():
        return []

    sections_raw = _split_on_breaks(text)

    # Filter empty sections
    sections_raw = [s.strip() for s in sections_raw if s.strip()]

    if not sections_raw:
        return []

    if len(sections_raw) == 1:
        return [_make_section("primary_content", "Content", sections_raw[0], 1.0)]

    return _classify_sections(sections_raw)


def _split_on_breaks(text: str) -> list[str]:
    """Split *text* on ``---`` lines that are NOT inside fenced code blocks."""
    lines = text.split("\n")
    sections: list[str] = []
    current_lines: list[str] = []
    in_fence = False
    fence_char: str | None = None

    for line in lines:
        fence_match = _FENCE.match(line)
        if fence_match:
            char = fence_match.group(1)[0]  # '`' or '~'
            if not in_fence:
                in_fence = True
                fence_char = char
            elif char == fence_char:
                in_fence = False
                fence_char = None
            current_lines.append(line)
            continue

        if not in_fence and _THEMATIC_BREAK.match(line):
            # This is a section boundary — don't include the --- line itself
            sections.append("\n".join(current_lines))
            current_lines = []
            continue

        current_lines.append(line)

    # Flush remaining content
    if current_lines:
        sections.append("\n".join(current_lines))

    return sections


def _classify_sections(sections: list[str]) -> list[ResponseSection]:
    """Assign type/label/confidence to an ordered list of raw section texts."""
    total_chars = sum(len(s) for s in sections)
    results: list[ResponseSection] = []

    for idx, content in enumerate(sections):
        is_first = idx == 0
        is_last = idx == len(sections) - 1

        # --- Follow-up detection (last section) ---
        if is_last:
            q_conf = _question_confidence(content)
            if q_conf >= 0.5:
                results.append(_make_section("follow_up", "Follow-up questions", content, q_conf))
                continue

        # --- Context detection (first section) ---
        if is_first:
            # Short preamble relative to total = higher confidence it's context
            ratio = len(content) / total_chars if total_chars else 0
            if ratio < 0.35:
                confidence = min(1.0, 0.6 + (0.35 - ratio))
                results.append(_make_section("context", "Context", content, round(confidence, 2)))
                continue

        # --- Default: primary content ---
        results.append(_make_section("primary_content", "Content", content, 0.9))

    return results


def _question_confidence(text: str) -> float:
    """Return confidence (0–1) that *text* is a follow-up questions section."""
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    if not lines:
        return 0.0

    question_lines = sum(1 for ln in lines if ln.rstrip().endswith("?"))
    # Also count numbered/bulleted items ending with ?
    ratio = question_lines / len(lines) if lines else 0

    # Boost confidence if most lines are questions
    if ratio >= 0.6:
        return min(1.0, 0.5 + ratio * 0.5)
    return round(ratio * 0.5, 2)


def _make_section(
    section_type: str,
    label: str,
    content: str,
    confidence: float,
) -> ResponseSection:
    return ResponseSection(
        type=section_type,
        label=label,
        content=content.strip(),
        confidence=round(confidence, 2),
    )

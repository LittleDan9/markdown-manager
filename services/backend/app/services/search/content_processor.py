"""Document content processor — extracts and normalises content before embedding.

Handles mermaid-aware text extraction so that diagram content (node labels,
edge descriptions, diagram types) is semantically searchable alongside regular
markdown prose.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Mermaid DSL → natural language
# ---------------------------------------------------------------------------

# Matches fenced code blocks:  ```mermaid ... ```
_MERMAID_FENCE_RE = re.compile(
    r"```\s*mermaid\s*\n(.*?)```",
    re.DOTALL | re.IGNORECASE,
)

# Node definitions:  A[Label]  A(Label)  A{Label}  A([Label])  etc.
# Matches word chars followed by an opening bracket, then captures label text
_NODE_LABEL_RE = re.compile(r'\w+[\[({<]([^\])}>\n]+?)[\])}>\]]')

# Edge labels:  -->|label|  --label-->  ==label==>
_EDGE_LABEL_RE = re.compile(r'(?:-->|==>|-.->)\s*[\|"]([^|\"\n]+)[\|"]')

# Arrows that carry text:  -- label -->
_ARROW_TEXT_RE = re.compile(r'--\s+([a-zA-Z][^\-\n]+?)\s+-->')

# Typical diagram type declarations at the top of a mermaid block
_DIAGRAM_TYPES: dict[str, str] = {
    "graph": "flowchart",
    "flowchart": "flowchart",
    "sequencediagram": "sequence diagram",
    "classDiagram": "class diagram",
    "statediagram": "state diagram",
    "erdiagram": "entity relationship diagram",
    "gantt": "gantt chart",
    "pie": "pie chart",
    "gitgraph": "git graph",
    "mindmap": "mindmap",
    "architecture-beta": "architecture diagram",
    "architecture": "architecture diagram",
    "c4context": "C4 context diagram",
    "journey": "user journey",
    "timeline": "timeline",
    "block-beta": "block diagram",
}


def _detect_diagram_type(source: str) -> str:
    first_line = source.strip().split("\n")[0].strip().lower().split()[0] if source.strip() else ""
    return _DIAGRAM_TYPES.get(first_line, "diagram")


def _mermaid_to_natural_language(mermaid_source: str) -> str:
    """Convert a mermaid DSL block into a natural language description for embedding."""
    diagram_type = _detect_diagram_type(mermaid_source)
    parts: list[str] = [f"{diagram_type}:"]

    # Extract node labels
    for match in _NODE_LABEL_RE.finditer(mermaid_source):
        label = match.group(1).strip()
        if label and len(label) > 1:
            parts.append(label)

    # Extract edge labels
    for match in _EDGE_LABEL_RE.finditer(mermaid_source):
        label = match.group(1).strip()
        if label:
            parts.append(f"connects via {label}")

    # Extract arrow-carried text
    for match in _ARROW_TEXT_RE.finditer(mermaid_source):
        label = match.group(1).strip()
        if label:
            parts.append(label)

    # If no labels found, fall back to raw cleaned-up source lines
    if len(parts) == 1:
        raw_lines = [
            re.sub(r'[^\w\s]', ' ', line).strip()
            for line in mermaid_source.splitlines()
            if line.strip() and not line.strip().startswith('%')
        ]
        parts.extend(line for line in raw_lines if line)

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Markdown prose extraction
# ---------------------------------------------------------------------------

def _strip_markdown_syntax(text: str) -> str:
    """Remove common markdown syntax leaving readable prose."""
    # Remove fenced code blocks (non-mermaid)
    text = re.sub(r"```(?!mermaid).*?```", "", text, flags=re.DOTALL)
    # Remove inline code
    text = re.sub(r"`[^`]+`", "", text)
    # Remove images ![alt](url)
    text = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", text)
    # Keep link text, remove URL: [text](url) → text
    text = re.sub(r"\[([^\]]+)\]\([^\)]*\)", r"\1", text)
    # Remove heading markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic markers
    text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@dataclass
class ProcessedContent:
    text: str          # Final text to embed
    has_mermaid: bool  # Whether any mermaid blocks were found
    summary: str       # Structural summary: headings + first paragraph per section


# ---------------------------------------------------------------------------
# Summary extraction
# ---------------------------------------------------------------------------

# Matches ATX headings: ## Heading Text
_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
# Matches fenced code blocks (to strip from summary)
_CODE_FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
# Matches blank lines
_BLANK_LINES_RE = re.compile(r"\n{2,}")


def extract_summary(title: str, content: str, max_chars: int = 800) -> str:
    """
    Build a compact structural summary of a markdown document.

    Extracts:
    - Document title
    - All H1-H3 headings (preserving hierarchy)
    - The first non-empty paragraph under each heading (up to ~120 chars)
    - Natural-language descriptions of any mermaid diagrams

    This gives the LLM a map of what the document covers without sending the
    full raw content, and is computed once at index time rather than per query.
    """
    # Extract mermaid blocks BEFORE stripping, so we can describe them
    mermaid_blocks = _MERMAID_FENCE_RE.findall(content)

    # Strip mermaid + other code blocks and fences before extracting prose
    stripped = _CODE_FENCE_RE.sub("", content)
    # Remove image syntax
    stripped = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", stripped)
    # Normalise links: keep text
    stripped = re.sub(r"\[([^\]]+)\]\([^\)]*\)", r"\1", stripped)

    lines = stripped.splitlines()
    parts: list[str] = [f"# {title}"]
    i = 0
    current_section_lines: list[str] = []

    def _flush_section():
        """Add up to one short paragraph from buffered section lines."""
        para = " ".join(
            line.strip()
            for line in current_section_lines
            if line.strip() and not line.strip().startswith("#")
        )
        # Remove residual markdown markers
        para = re.sub(r"[*_`]{1,3}", "", para).strip()
        if para:
            # Take first sentence or first 120 chars, whichever is shorter
            dot = para.find(". ")
            snippet = para[: dot + 1] if 0 < dot < 120 else para[:120]
            parts.append(f"  {snippet}")

    while i < len(lines):
        line = lines[i]
        m = _HEADING_RE.match(line)
        if m:
            _flush_section()
            current_section_lines = []
            level = len(m.group(1))
            heading_text = m.group(2).strip()
            prefix = "  " * (level - 1) + "-"
            parts.append(f"{prefix} {heading_text}")
        else:
            current_section_lines.append(line)
        i += 1

    _flush_section()

    # Append mermaid diagram descriptions
    if mermaid_blocks:
        parts.append("- Diagrams:")
        for block in mermaid_blocks:
            desc = _mermaid_to_natural_language(block)
            # Take first 120 chars of each diagram description
            parts.append(f"  {desc[:120]}")

    summary = "\n".join(parts)
    # Trim to max_chars at a line boundary to avoid cutting mid-sentence
    if len(summary) > max_chars:
        trimmed = summary[:max_chars]
        last_newline = trimmed.rfind("\n")
        summary = trimmed[:last_newline] if last_newline > 0 else trimmed

    return summary


def prepare_document_content(title: str, content: str) -> ProcessedContent:
    """
    Prepare document content for embedding.

    1. Extracts mermaid blocks and converts them to natural language.
    2. Strips remaining markdown syntax from prose.
    3. Concatenates: title + prose + mermaid descriptions.

    The result is plain text suitable for passing to the embedding model.
    """
    mermaid_blocks = _MERMAID_FENCE_RE.findall(content)
    has_mermaid = bool(mermaid_blocks)

    # Remove mermaid blocks from prose so they're not double-counted
    prose = _MERMAID_FENCE_RE.sub("", content)
    prose = _strip_markdown_syntax(prose)

    # Convert mermaid blocks to natural language
    mermaid_descriptions = [
        _mermaid_to_natural_language(block) for block in mermaid_blocks
    ]

    parts = [title]
    if prose:
        parts.append(prose)
    parts.extend(mermaid_descriptions)

    return ProcessedContent(
        text=" ".join(parts),
        has_mermaid=has_mermaid,
        summary=extract_summary(title, content),
    )

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
        parts.extend(l for l in raw_lines if l)

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
    )

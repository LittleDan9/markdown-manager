"""Help documentation API — serves user guide topics from static markdown files."""

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/help", tags=["help"])

_HELP_DIR = Path(__file__).resolve().parents[2] / "docs" / "help"


def _read_topic(slug: str) -> dict:
    """Read a single help topic by slug and return {slug, title, content}."""
    path = _HELP_DIR / f"{slug}.md"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Help topic '{slug}' not found")
    # Guard against path traversal
    try:
        path.resolve().relative_to(_HELP_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Help topic '{slug}' not found")
    text = path.read_text(encoding="utf-8")
    # Extract title from first markdown heading
    title = slug.replace("-", " ").title()
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            break
    return {"slug": slug, "title": title, "content": text}


@router.get("/topics")
async def list_topics():
    """Return list of all help topics (slug + title, no content)."""
    if not _HELP_DIR.is_dir():
        return []
    topics = []
    for path in sorted(_HELP_DIR.glob("*.md")):
        slug = path.stem
        text = path.read_text(encoding="utf-8")
        title = slug.replace("-", " ").title()
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                title = stripped[2:].strip()
                break
        topics.append({"slug": slug, "title": title})
    return topics


@router.get("/topics/{slug}")
async def get_topic(slug: str):
    """Return a single help topic with full markdown content."""
    return _read_topic(slug)

"""API endpoints for syntax highlighting."""
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.syntax_highlighting import syntax_highlighter

router = APIRouter()


class HighlightRequest(BaseModel):
    """Request model for syntax highlighting."""

    code: str
    language: Optional[str] = None


class HighlightResponse(BaseModel):
    """Response model for syntax highlighting."""

    highlighted_code: str
    language: Optional[str] = None
    is_supported: bool


class LanguageInfo(BaseModel):
    """Language information model."""

    name: str
    aliases: List[str]
    filenames: List[str]
    mimetypes: List[str]


@router.post("/highlight", response_model=HighlightResponse)
async def highlight_code(request: HighlightRequest) -> HighlightResponse:
    """Highlight code using Pygments syntax highlighter."""
    try:
        highlighted = syntax_highlighter.highlight_code(request.code, request.language)

        is_supported = (
            syntax_highlighter.is_language_supported(request.language)
            if request.language
            else False
        )

        return HighlightResponse(
            highlighted_code=highlighted,
            language=request.language,
            is_supported=is_supported,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error highlighting code: {str(e)}"
        )


@router.get("/languages")
async def get_available_languages() -> dict[str, object]:
    """Get all available languages for syntax highlighting."""
    try:
        languages = syntax_highlighter.get_available_languages()
        return {"languages": languages}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving languages: {str(e)}"
        )


@router.get("/languages/{language}", response_model=LanguageInfo)
async def get_language_info(language: str) -> LanguageInfo:
    """Get information about a specific language."""
    try:
        info = syntax_highlighter.get_language_info(language)
        if not info:
            raise HTTPException(
                status_code=404, detail=f"Language '{language}' not found"
            )

        return LanguageInfo(**info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving language info: {str(e)}"
        )


@router.get("/languages/{language}/check")
async def check_language_support(language: str) -> dict[str, object]:
    """Check if a language is supported for highlighting."""
    try:
        is_supported = syntax_highlighter.is_language_supported(language)
        return {"language": language, "is_supported": is_supported}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking language support: {str(e)}"
        )

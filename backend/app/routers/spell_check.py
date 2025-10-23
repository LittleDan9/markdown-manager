"""
Spell Check Router - Phase 3 API Integration
Created: October 22, 2025 by AI Agent
Purpose: FastAPI endpoints for spell-check-service with custom dictionary integration
Dependencies: spell_check_service.py, custom_dictionary.py, FastAPI
Integration: Main API routing for spell check functionality with backend-provided custom words
"""

import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession

from ..services.spell_check_service import (
    spell_check_client,
    SpellIssue
)
from ..core.auth import get_current_user_optional
from ..database import get_db
from ..models.user import User
from ..crud import custom_dictionary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spell-check", tags=["spell-check"])


async def get_combined_custom_words(
    user: Optional[User],
    db: Optional[AsyncSession],
    additional_words: List[str] = None,
    category_id: Optional[int] = None,
    folder_path: Optional[str] = None
) -> List[str]:
    """
    Get combined custom words from database and additional words provided

    Args:
        user: Current user (if authenticated)
        db: Database session
        additional_words: Additional custom words provided in request
        category_id: Category ID for scoped words
        folder_path: Folder path for scoped words

    Returns:
        Combined list of unique custom words
    """
    all_words = set()

    # Add words provided in request
    if additional_words:
        all_words.update(word.lower().strip() for word in additional_words if word.strip())

    # Add words from database if user is authenticated
    if user and db:
        try:
            # Get user-level words (always included)
            user_words = await custom_dictionary.get_user_level_dictionary_words(db, int(user.id))
            all_words.update(word.lower() for word in user_words)

            # Get category-specific words if category_id provided
            if category_id:
                category_words = await custom_dictionary.get_category_dictionary_words(db, int(user.id), category_id)
                all_words.update(word.lower() for word in category_words)

            # Get folder-specific words if folder_path provided
            if folder_path:
                folder_words = await custom_dictionary.get_folder_dictionary_words(db, int(user.id), folder_path)
                all_words.update(word.lower() for word in folder_words)

        except Exception as e:
            logger.warning(f"Failed to fetch custom dictionary words for user {user.id}: {e}")
            # Continue with just the additional words

    return list(all_words)


# Request/Response Models for API
class SpellCheckApiRequest(BaseModel):
    """API request model for spell checking"""
    text: str = Field(..., min_length=1, max_length=1048576, description="Text to check for spelling")
    customWords: List[str] = Field(default_factory=list, description="Custom words to ignore")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional spell check options")

    @validator('text')
    def validate_text(cls, v):
        if not v or not v.strip():
            raise ValueError('Text cannot be empty or only whitespace')
        return v

    @validator('customWords')
    def validate_custom_words(cls, v):
        if v and len(v) > 1000:
            raise ValueError('Too many custom words (limit: 1000)')
        return v


class SpellCheckApiResponse(BaseModel):
    """API response model for spell checking"""
    results: Dict[str, List[SpellIssue]]
    statistics: Dict[str, Any]
    metadata: Dict[str, Any]


# API Endpoints
@router.post("/", response_model=SpellCheckApiResponse)
async def check_text_spelling(
    request: SpellCheckApiRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
) -> SpellCheckApiResponse:
    """
    Check text for spelling errors

    This endpoint accepts text and returns spelling issues found by the spell-check service.
    It integrates user-specific custom dictionary words from the database.

    - **text**: The text content to check for spelling errors
    - **customWords**: Optional list of custom words to ignore during checking
    - **options**: Additional options for spell checking (future extensibility)

    Returns detailed spelling issues with suggestions and metadata.
    """
    try:
        logger.info(f"Spell check request - text length: {len(request.text)}, "
                    f"custom words: {len(request.customWords)}, "
                    f"user: {current_user.email if current_user else 'anonymous'}")

        # Get combined custom words from database and request
        combined_custom_words = await get_combined_custom_words(
            user=current_user,
            db=db,
            additional_words=request.customWords
        )

        # Call spell check service with combined custom words
        # Note: For Phase 4, we call the service directly via HTTP rather than using
        # the complex Phase 3 client to avoid Pydantic validation issues
        import httpx
        import os

        service_url = os.getenv("SPELL_CHECK_SERVICE_URL", "http://localhost:8003")

        async with httpx.AsyncClient(timeout=30.0) as client:
            service_response = await client.post(
                f"{service_url}/check",
                json={
                    "text": request.text,
                    "customWords": combined_custom_words,
                    "options": request.options
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "markdown-manager-backend/1.0"
                }
            )
            service_response.raise_for_status()
            response_data = service_response.json()

        # Extract all analysis results safely and normalize format
        spelling_issues = []
        grammar_issues = []
        style_issues = []

        if response_data.get('results', {}).get('spelling'):
            spelling_issues = response_data['results']['spelling']

        if response_data.get('results', {}).get('grammar'):
            # Transform grammar issues to match expected format
            for issue in response_data['results']['grammar']:
                # Extract word from originalText or first word of message
                word = issue.get('originalText', 'unknown')
                if not word and issue.get('message'):
                    word = issue.get('message', '').split()[0] if issue.get('message') else 'unknown'

                grammar_issues.append({
                    "word": word,
                    "suggestions": issue.get('suggestions', []),
                    "position": issue.get('position', {}),
                    "lineNumber": issue.get('lineNumber', 1),
                    "column": issue.get('column', 1),
                    "type": "grammar",
                    "severity": issue.get('severity', 'warning'),
                    "confidence": issue.get('confidence', 0.8),
                    "message": issue.get('message') or '',
                    "rule": issue.get('rule', '')
                })

        if response_data.get('results', {}).get('style'):
            # Transform style issues to match expected format
            for issue in response_data['results']['style']:
                # Extract word from originalText or first word of message
                word = issue.get('originalText', 'unknown')
                if not word and issue.get('message'):
                    word = issue.get('message', '').split()[0] if issue.get('message') else 'unknown'

                style_issues.append({
                    "word": word,
                    "suggestions": issue.get('suggestions', []),
                    "position": issue.get('position', {}),
                    "lineNumber": issue.get('lineNumber', 1),
                    "column": issue.get('column', 1),
                    "type": "style",
                    "severity": issue.get('severity', 'info'),
                    "confidence": issue.get('confidence', 0.6),
                    "message": issue.get('message') or '',
                    "rule": issue.get('rule', '')
                })

        total_issues = len(spelling_issues) + len(grammar_issues) + len(style_issues)

        api_response = SpellCheckApiResponse(
            results={
                "spelling": spelling_issues,
                "grammar": grammar_issues,
                "style": style_issues
            },
            statistics={
                "words_checked": len(request.text.split()) if request.text else 0,
                "custom_words_applied": len(combined_custom_words),
                "issues_found": total_issues,
                "processing_time": response_data.get('processingTime', 0)
            },
            metadata={
                "service": "spell-check-service",
                "version": "phase4",
                "custom_dictionary_enabled": bool(current_user),
                "language": response_data.get('language', 'en-US'),
                "service_response": "phase4_direct_call"
            }
        )

        logger.info(f"Spell check completed - found {api_response.statistics['issues_found']} issues")
        return api_response

    except Exception as e:
        logger.error(f"Error in spell check endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Spell check failed: {str(e)}"
        )


@router.get("/health")
async def check_spell_service_health() -> Dict[str, Any]:
    """
    Check the health status of the spell-check service

    Returns health information and service capabilities.
    """
    try:
        health_info = await spell_check_client.health_check()
        return {
            "status": "healthy",
            "service": health_info,
            "backend_integration": "active"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "backend_integration": "error"
        }


@router.get("/info")
async def get_spell_service_info() -> Dict[str, Any]:
    """
    Get information about the spell-check service capabilities

    Returns service version, features, and configuration.
    """
    try:
        info = await spell_check_client.get_service_info()
        return {
            "service": info,
            "integration": {
                "custom_dictionary": True,
                "phase": "3",
                "features": ["spelling", "contextual_suggestions", "style_guides", "readability"]
            }
        }
    except Exception as e:
        logger.error(f"Info request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve service information"
        )

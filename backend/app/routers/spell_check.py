"""
Spell Check Router - Phase 1 API Integration
Created: October 22, 2025 by AI Agent
Purpose: FastAPI endpoints for spell-check-service
Dependencies: spell_check_service.py, FastAPI
Integration: Main API routing for spell check functionality
"""

import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, validator

from ..services.spell_check_service import (
    spell_check_client,
    SpellIssue,
    check_spelling,
    check_document_spelling
)
from ..core.auth import get_current_user_optional
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spell-check", tags=["spell-check"])


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
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> SpellCheckApiResponse:
    """
    Check text for spelling errors
    
    This endpoint accepts text and returns spelling issues found by the spell-check service.
    
    - **text**: The text content to check for spelling errors
    - **customWords**: Optional list of custom words to ignore during checking
    - **options**: Additional options for spell checking (future extensibility)
    
    Returns detailed spelling issues with suggestions and metadata.
    """
    try:
        logger.info(f"Spell check request - text length: {len(request.text)}, "
                    f"custom words: {len(request.customWords)}, "
                    f"user: {current_user.username if current_user else 'anonymous'}")
        
        # Call spell check service
        response = await check_spelling(
            text=request.text,
            custom_words=request.customWords,
            options=request.options
        )
        
        # Format response for API
        api_response = SpellCheckApiResponse(
            results={
                "spelling": response.results.spelling
            },
            statistics={
                "issuesFound": len(response.results.spelling),
                "processingTime": response.processingTime,
                "textLength": len(request.text),
                "customWordsCount": len(request.customWords),
                "language": response.language
            },
            metadata={
                "service": response.service,
                "version": response.version,
                "timestamp": response.statistics.get("timestamp"),
                "performance": response.statistics
            }
        )
        
        logger.info(f"Spell check completed - found {len(response.results.spelling)} issues")
        return api_response
        
    except ValueError as e:
        logger.warning(f"Invalid spell check request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Spell check service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spell check service is currently unavailable"
        )


@router.get("/health")
async def check_spell_service_health() -> Dict[str, Any]:
    """
    Check the health status of the spell-check service
    
    Returns health information and service capabilities.
    """
    try:
        health_data = await spell_check_client.health_check()
        return {
            "status": "healthy",
            "service": health_data,
            "timestamp": health_data.get("timestamp")
        }
    except Exception as e:
        logger.error(f"Spell check service health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spell check service is unhealthy"
        )


@router.get("/info")
async def get_spell_service_info() -> Dict[str, Any]:
    """
    Get information about the spell-check service capabilities
    
    Returns service information, supported languages, and configuration.
    """
    try:
        info_data = await spell_check_client.get_service_info()
        return info_data
    except Exception as e:
        logger.error(f"Failed to get spell check service info: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve spell check service information"
        )


# Document-specific endpoints
@router.post("/document", response_model=SpellCheckApiResponse)
async def check_document_content_spelling(
    request: SpellCheckApiRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> SpellCheckApiResponse:
    """
    Check document content for spelling errors with optimized chunking
    
    This endpoint is optimized for longer documents and uses intelligent
    chunking to process large content efficiently.
    
    - **text**: The document content to check
    - **customWords**: Custom words to ignore (useful for technical documents)
    - **options**: Additional options including chunking preferences
    
    Returns comprehensive spelling analysis with performance metadata.
    """
    try:
        logger.info(f"Document spell check request - content length: {len(request.text)}, "
                    f"user: {current_user.username if current_user else 'anonymous'}")
        
        # Extract chunking options
        enable_chunking = request.options.get("enableChunking", True)
        chunk_size = min(request.options.get("chunkSize", 10000), 50000)  # Cap at 50KB chunks
        
        # Call document spell check service
        spelling_issues = await check_document_spelling(
            content=request.text,
            custom_words=request.customWords,
            enable_chunking=enable_chunking,
            chunk_size=chunk_size
        )
        
        # Format response
        api_response = SpellCheckApiResponse(
            results={
                "spelling": spelling_issues
            },
            statistics={
                "issuesFound": len(spelling_issues),
                "textLength": len(request.text),
                "customWordsCount": len(request.customWords),
                "chunksProcessed": max(1, len(request.text) // chunk_size) if enable_chunking else 1,
                "chunkingEnabled": enable_chunking
            },
            metadata={
                "service": "spell-check-service",
                "processingType": "document",
                "chunkSize": chunk_size if enable_chunking else len(request.text)
            }
        )
        
        logger.info(f"Document spell check completed - found {len(spelling_issues)} issues "
                    f"across {api_response.statistics['chunksProcessed']} chunks")
        return api_response
        
    except ValueError as e:
        logger.warning(f"Invalid document spell check request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Document spell check service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document spell check service is currently unavailable"
        )
"""Markdown Lint API Router - Proxy to markdown-lint-service."""

import logging
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/markdown-lint", tags=["markdown-lint"])


class LintRequest(BaseModel):
    """Request model for markdown linting."""
    text: str
    rules: Dict[str, Any]
    chunk_offset: int = 0


class LintResponse(BaseModel):
    """Response model for markdown linting."""
    issues: list
    processed_length: int
    rule_count: int


class RuleDefinitionsResponse(BaseModel):
    """Response model for rule definitions."""
    rules: Dict[str, Any]


@router.post("/process", response_model=LintResponse)
async def process_markdown(
    request: LintRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Process markdown text for linting issues.
    
    Proxies the request to the internal markdown-lint-service.
    Adds user context and forwards the request.
    """
    lint_service_url = "http://markdown-lint-service:8002/lint"
    
    logger.info(f"Processing markdown lint request for user {current_user.id}, text length: {len(request.text)}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                lint_service_url,
                json={
                    "text": request.text,
                    "rules": request.rules,
                    "chunk_offset": request.chunk_offset
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "markdown-manager-backend/1.0"
                }
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Markdown lint service returned {len(result.get('issues', []))} issues")
            
            return LintResponse(**result)
    
    except httpx.RequestError as e:
        logger.error(f"Markdown lint service request error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Markdown lint service unavailable: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"Markdown lint service HTTP error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Markdown lint service error: {e.response.text}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in markdown lint processing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during markdown linting"
        )


@router.get("/rules/definitions", response_model=RuleDefinitionsResponse)
async def get_rule_definitions():
    """
    Get available markdownlint rule definitions.
    
    Proxies the request to the internal markdown-lint-service.
    No authentication required as rule definitions are static.
    """
    lint_service_url = "http://markdown-lint-service:8002/rules/definitions"
    
    logger.info("Fetching markdown lint rule definitions")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                lint_service_url,
                headers={
                    "User-Agent": "markdown-manager-backend/1.0"
                }
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Retrieved {len(result.get('rules', {}))} rule definitions")
            
            return RuleDefinitionsResponse(**result)
    
    except httpx.RequestError as e:
        logger.error(f"Markdown lint service request error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Markdown lint service unavailable: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"Markdown lint service HTTP error: {e.response.status_code}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Failed to retrieve rule definitions"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching rule definitions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching rule definitions"
        )


@router.get("/health")
async def check_lint_service_health():
    """
    Check the health of the markdown-lint-service.
    
    Returns the service health status for monitoring purposes.
    No authentication required for health checks.
    """
    lint_service_url = "http://markdown-lint-service:8002/health"
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(lint_service_url)
            response.raise_for_status()
            
            result = response.json()
            return {
                "status": "healthy",
                "service": "markdown-lint-proxy",
                "downstream": result
            }
    
    except Exception as e:
        logger.warning(f"Markdown lint service health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "markdown-lint-proxy",
            "error": str(e)
        }

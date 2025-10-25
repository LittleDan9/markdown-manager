"""Markdown Lint API Router - Proxy to markdown-lint-service."""

import logging
from typing import Any, Dict, Optional
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_current_user_optional
from app.database import get_db
from app.models import User
from app.services.markdown_lint_rule import MarkdownLintRuleService
from app.configs.settings import get_settings

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


class RuleConfigurationRequest(BaseModel):
    """Request model for rule configuration."""
    rules: Dict[str, Any]
    description: str | None = None
    enabled: bool = True


class RuleConfigurationResponse(BaseModel):
    """Response model for rule configuration."""
    rules: Dict[str, Any]
    description: str | None = None
    enabled: bool = True
    updated_at: str | None = None


@router.post("/process", response_model=LintResponse)
async def process_markdown(
    request: LintRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Process markdown text for linting issues.

    Proxies the request to the internal markdown-lint-service.
    Authentication is optional - authenticated users get full access,
    unauthenticated users are rate-limited by nginx.
    """
    settings = get_settings()
    lint_service_url = settings.markdown_lint_service_url + "/lint"

    user_context = f"user {current_user.id}" if current_user else "unauthenticated user"
    logger.info(f"Processing markdown lint request for {user_context}, text length: {len(request.text)}")

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
    settings = get_settings()
    lint_service_url = settings.markdown_lint_service_url + "/rules/definitions"

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


@router.get("/rules/recommended-defaults", response_model=RuleDefinitionsResponse)
async def get_recommended_defaults():
    """
    Get recommended default markdown lint rules for new users.

    Proxies the request to the internal markdown-lint-service.
    No authentication required as recommended defaults are static.
    """
    settings = get_settings()
    lint_service_url = settings.markdown_lint_service_url + "/rules/recommended-defaults"

    logger.info("Fetching recommended default lint rules")

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
            logger.info("Retrieved recommended default rules")

            # Return the rules portion to match the expected response model
            return RuleDefinitionsResponse(rules=result.get("rules", {}))

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
            detail="Failed to retrieve recommended defaults"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching recommended defaults: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching recommended defaults"
        )


@router.get("/health")
async def check_lint_service_health():
    """
    Check the health of the markdown-lint-service.

    Returns the service health status for monitoring purposes.
    No authentication required for health checks.
    """
    settings = get_settings()
    lint_service_url = settings.markdown_lint_service_url + "/health"

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


# Rule Management Endpoints

@router.get("/user/defaults", response_model=RuleConfigurationResponse)
async def get_user_defaults(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's default markdown lint rules.

    Returns the user's default rule configuration or 404 if not set.
    This endpoint returns NULL (404) when user has no configuration,
    allowing clients to fall back to recommended defaults.
    """
    rules_record = await MarkdownLintRuleService.get_user_defaults_record(db, current_user.id)

    if rules_record is None:
        raise HTTPException(status_code=404, detail="User default rules not found")

    return RuleConfigurationResponse(
        rules=rules_record.rules,
        description=rules_record.description,
        enabled=rules_record.enabled,
        updated_at=rules_record.updated_at.isoformat() if rules_record.updated_at else None
    )


@router.put("/user/defaults", response_model=RuleConfigurationResponse)
async def save_user_defaults(
    request: RuleConfigurationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save or update user's default markdown lint rules.

    Creates new defaults if they don't exist, or updates existing ones.
    """
    try:
        rule = await MarkdownLintRuleService.save_user_defaults(
            db, current_user.id, request.rules, request.description, request.enabled
        )
        return RuleConfigurationResponse(
            rules=rule.rules,
            description=rule.description,
            enabled=rule.enabled,
            updated_at=rule.updated_at.isoformat() if rule.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/user/defaults")
async def delete_user_defaults(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete user's default markdown lint rules.

    Returns 404 if no defaults were found to delete.
    """
    deleted = await MarkdownLintRuleService.delete_user_defaults(db, current_user.id)

    if not deleted:
        raise HTTPException(status_code=404, detail="User default rules not found")

    return {"message": "User default rules deleted successfully"}


@router.get("/categories/{category_id}/rules", response_model=RuleConfigurationResponse)
async def get_category_rules(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get category-specific markdown lint rules.

    Returns the category's rule configuration or 404 if not set.
    """
    rules = await MarkdownLintRuleService.get_category_rules(db, current_user.id, category_id)

    if rules is None:
        raise HTTPException(status_code=404, detail=f"Rules for category {category_id} not found")

    return RuleConfigurationResponse(rules=rules)


@router.put("/categories/{category_id}/rules", response_model=RuleConfigurationResponse)
async def save_category_rules(
    category_id: int,
    request: RuleConfigurationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save or update category-specific markdown lint rules.

    Creates new category rules if they don't exist, or updates existing ones.
    """
    try:
        rule = await MarkdownLintRuleService.save_category_rules(
            db, current_user.id, category_id, request.rules, request.description
        )
        return RuleConfigurationResponse(
            rules=rule.rules,
            description=rule.description,
            updated_at=rule.updated_at.isoformat() if rule.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/categories/{category_id}/rules")
async def delete_category_rules(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete category-specific markdown lint rules.

    Returns 404 if no category rules were found to delete.
    """
    deleted = await MarkdownLintRuleService.delete_category_rules(db, current_user.id, category_id)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Rules for category {category_id} not found")

    return {"message": f"Category {category_id} rules deleted successfully"}


@router.get("/folders/{folder_path:path}/rules", response_model=RuleConfigurationResponse)
async def get_folder_rules(
    folder_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get folder-specific markdown lint rules.

    Returns the folder's rule configuration or 404 if not set.
    The folder_path should be URL-encoded.
    """
    # Decode the folder path
    decoded_path = unquote(folder_path)
    rules = await MarkdownLintRuleService.get_folder_rules(db, current_user.id, decoded_path)

    if rules is None:
        raise HTTPException(status_code=404, detail=f"Rules for folder '{decoded_path}' not found")

    return RuleConfigurationResponse(rules=rules)


@router.put("/folders/{folder_path:path}/rules", response_model=RuleConfigurationResponse)
async def save_folder_rules(
    folder_path: str,
    request: RuleConfigurationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save or update folder-specific markdown lint rules.

    Creates new folder rules if they don't exist, or updates existing ones.
    The folder_path should be URL-encoded.
    """
    # Decode the folder path
    decoded_path = unquote(folder_path)

    try:
        rule = await MarkdownLintRuleService.save_folder_rules(
            db, current_user.id, decoded_path, request.rules, request.description
        )
        return RuleConfigurationResponse(
            rules=rule.rules,
            description=rule.description,
            updated_at=rule.updated_at.isoformat() if rule.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/folders/{folder_path:path}/rules")
async def delete_folder_rules(
    folder_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete folder-specific markdown lint rules.

    Returns 404 if no folder rules were found to delete.
    The folder_path should be URL-encoded.
    """
    # Decode the folder path
    decoded_path = unquote(folder_path)
    deleted = await MarkdownLintRuleService.delete_folder_rules(db, current_user.id, decoded_path)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Rules for folder '{decoded_path}' not found")

    return {"message": f"Folder '{decoded_path}' rules deleted successfully"}

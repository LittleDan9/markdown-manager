"""Markdown Lint API Router - User preferences and rule management."""

import logging
from typing import Any, Dict
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services.markdown_lint_rule import MarkdownLintRuleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/markdown-lint", tags=["markdown-lint"])


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

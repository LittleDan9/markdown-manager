"""Spell check settings schemas."""
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class SpellCheckSettingsRequest(BaseModel):
    """Request model for saving spell check settings."""

    analysis_types: Optional[Dict[str, Any]] = None
    grammar_rules: Optional[Dict[str, Any]] = None
    style_settings: Optional[Dict[str, Any]] = None
    code_spell_settings: Optional[Dict[str, Any]] = None
    selected_language: Optional[str] = None
    selected_style_guide: Optional[str] = None


class SpellCheckSettingsResponse(BaseModel):
    """Response model for spell check settings."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    analysis_types: Dict[str, Any]
    grammar_rules: Dict[str, Any]
    style_settings: Dict[str, Any]
    code_spell_settings: Dict[str, Any]
    selected_language: str
    selected_style_guide: str
    created_at: datetime
    updated_at: datetime

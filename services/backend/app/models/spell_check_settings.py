from __future__ import annotations

"""Spell check settings model for per-user writing analysis preferences."""
from typing import TYPE_CHECKING, Any, Dict

from sqlalchemy import ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User


class SpellCheckSettings(BaseModel):
    """Per-user spell check and writing analysis settings."""

    __tablename__ = "spell_check_settings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_spell_check_settings_user"),
    )

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Analysis toggles: {spelling, grammar, style, readability}
    analysis_types: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=lambda: {
            "spelling": True, "grammar": True, "style": True, "readability": True
        }
    )

    # Grammar rule toggles: {sentenceLength, passiveVoice, repeatedWords, capitalization, punctuation}
    grammar_rules: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=lambda: {
            "sentenceLength": True,
            "passiveVoice": True,
            "repeatedWords": True,
            "capitalization": True,
            "punctuation": True,
            "maxSentenceWords": 30,
        }
    )

    # Style analyzer settings: {passive, illusion, so, thereIs, weasel, adverb, tooWordy, cliches, eprime}
    style_settings: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=lambda: {
            "passive": True,
            "illusion": True,
            "so": True,
            "thereIs": True,
            "weasel": True,
            "adverb": True,
            "tooWordy": True,
            "cliches": True,
            "eprime": False,
        }
    )

    # Code spell check settings: {enabled, checkComments, checkStrings, checkIdentifiers}
    code_spell_settings: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=lambda: {
            "enabled": False,
            "checkComments": True,
            "checkStrings": False,
            "checkIdentifiers": True,
        }
    )

    selected_language: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en-US"
    )

    selected_style_guide: Mapped[str] = mapped_column(
        String(50), nullable=False, default="none"
    )

    # Relationships
    user: Mapped["User"] = relationship("User")

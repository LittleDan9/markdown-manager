"""GitHub settings schemas for API requests and responses."""
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GitHubSettingsBase(BaseModel):
    """Base GitHub settings schema."""

    auto_convert_diagrams: bool = Field(
        default=False,
        description="Automatically convert advanced diagrams for GitHub compatibility"
    )
    diagram_format: str = Field(
        default="svg",
        description="Export format for diagrams (svg or png)",
        pattern="^(svg|png)$"
    )
    fallback_to_standard: bool = Field(
        default=True,
        description="Convert architecture-beta to standard flowcharts when possible"
    )
    auto_sync_enabled: bool = Field(
        default=True,
        description="Enable automatic synchronization with GitHub"
    )
    default_commit_message: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Default commit message template"
    )
    auto_push_enabled: bool = Field(
        default=False,
        description="Automatically push changes to GitHub"
    )

    @field_validator("diagram_format")
    @classmethod
    def validate_diagram_format(cls, v: str) -> str:
        """Validate diagram format is either svg or png."""
        if v.lower() not in ["svg", "png"]:
            raise ValueError("diagram_format must be either 'svg' or 'png'")
        return v.lower()


class GitHubSettingsCreate(GitHubSettingsBase):
    """GitHub settings creation schema."""

    github_account_id: Optional[int] = Field(
        default=None,
        description="Optional GitHub account ID for account-specific settings"
    )


class GitHubSettingsUpdate(BaseModel):
    """GitHub settings update schema."""

    auto_convert_diagrams: Optional[bool] = None
    diagram_format: Optional[str] = Field(
        default=None,
        pattern="^(svg|png)$"
    )
    fallback_to_standard: Optional[bool] = None
    auto_sync_enabled: Optional[bool] = None
    default_commit_message: Optional[str] = Field(
        default=None,
        max_length=255
    )
    auto_push_enabled: Optional[bool] = None

    @field_validator("diagram_format")
    @classmethod
    def validate_diagram_format(cls, v: Optional[str]) -> Optional[str]:
        """Validate diagram format is either svg or png."""
        if v is not None and v.lower() not in ["svg", "png"]:
            raise ValueError("diagram_format must be either 'svg' or 'png'")
        return v.lower() if v is not None else v


class GitHubSettingsResponse(GitHubSettingsBase):
    """GitHub settings response schema."""

    id: int
    user_id: int
    github_account_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GitHubSettingsDefaults(BaseModel):
    """Default GitHub settings when no user settings exist."""

    auto_convert_diagrams: bool = False
    diagram_format: str = "svg"
    fallback_to_standard: bool = True
    auto_sync_enabled: bool = True
    default_commit_message: Optional[str] = None
    auto_push_enabled: bool = False

    model_config = ConfigDict(from_attributes=True)

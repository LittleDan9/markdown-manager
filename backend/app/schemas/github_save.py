"""
Pydantic schemas for GitHub save operations with diagram conversion.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RenderedDiagram(BaseModel):
    """Frontend-rendered diagram data"""

    diagram_code: str = Field(..., description="Original mermaid diagram code")
    svg_content: str = Field(..., description="Rendered SVG content from frontend")
    hash: Optional[str] = Field(default=None, description="Hash of the diagram code for consistency")


class GitHubSaveRequest(BaseModel):
    """Request schema for saving document to GitHub with diagram conversion"""

    repository_id: int = Field(..., description="ID of the GitHub repository")
    file_path: str = Field(..., description="Path within repository for the file")
    commit_message: str = Field(..., description="Commit message for the save operation")
    branch: str = Field(default="main", description="Target branch for the commit")
    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")
    base_branch: Optional[str] = Field(default=None, description="Base branch for new branch creation")
    auto_convert_diagrams: Optional[bool] = Field(
        default=None,
        description="Override user settings for diagram conversion (optional)"
    )
    rendered_diagrams: Optional[List[RenderedDiagram]] = Field(
        default=None,
        description="Pre-rendered diagram SVG content from frontend (optional)"
    )


class DiagramConversionInfo(BaseModel):
    """Information about a converted diagram"""

    filename: str = Field(..., description="Generated filename for the diagram image")
    path: str = Field(..., description="Full path in repository where diagram was uploaded")
    hash: str = Field(..., description="Hash of the original diagram content")
    format: str = Field(..., description="Image format (svg or png)")
    sha: Optional[str] = Field(default=None, description="GitHub SHA of uploaded image")
    size: int = Field(..., description="Size of the uploaded image in bytes")
    original_code: str = Field(..., description="Original Mermaid diagram code")


class GitHubSaveResponse(BaseModel):
    """Response schema for GitHub save operation"""

    success: bool = Field(..., description="Whether the save operation was successful")
    commit_sha: Optional[str] = Field(default=None, description="SHA of the created commit")
    commit_url: Optional[str] = Field(default=None, description="URL to view the commit on GitHub")
    file_url: Optional[str] = Field(default=None, description="URL to view the file on GitHub")
    converted_diagrams: Optional[List[DiagramConversionInfo]] = Field(
        default=None,
        description="List of diagrams that were converted and uploaded"
    )
    errors: Optional[List[str]] = Field(default=None, description="Any errors that occurred")
    diagrams_converted: int = Field(default=0, description="Number of diagrams successfully converted")
    total_diagrams: int = Field(default=0, description="Total number of diagrams processed")

    class Config:
        """Pydantic configuration"""
        json_encoders = {
            # Add any special encoding rules if needed
        }


class ConversionError(BaseModel):
    """Error information for failed diagram conversions"""

    diagram_index: int = Field(..., description="Index of the diagram that failed")
    error_message: str = Field(..., description="Description of the error")
    diagram_code: Optional[str] = Field(default=None, description="The diagram code that failed")


class ConversionSummary(BaseModel):
    """Summary of diagram conversion process"""

    total_diagrams_found: int = Field(..., description="Total number of diagrams found in document")
    advanced_diagrams_detected: int = Field(..., description="Number of advanced diagrams detected")
    diagrams_converted: int = Field(..., description="Number of diagrams successfully converted")
    conversion_errors: List[ConversionError] = Field(default=[], description="List of conversion errors")
    settings_used: Dict[str, Any] = Field(..., description="GitHub settings that were applied")

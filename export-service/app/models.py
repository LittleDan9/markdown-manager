"""
Pydantic models for diagrams.net export endpoints.

This module defines request/response models for the diagrams.net conversion service,
including quality assessment and metadata structures.
"""

from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class DiagramsNetExportRequest(BaseModel):
    """Request model for diagrams.net export from SVG."""

    svg_content: str = Field(
        ...,
        description="Raw SVG content from Mermaid rendering engine",
        min_length=1
    )
    format: Literal["xml", "png"] = Field(
        default="xml",
        description="Export format - 'xml' for diagrams.net XML, 'png' for editable PNG with embedded XML"
    )
    is_dark_mode: bool = Field(
        default=False,
        description="Whether the diagram uses dark mode styling"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "svg_content": "<svg>...</svg>",
                "format": "xml",
                "is_dark_mode": False
            }
        }


class ConversionQualityInfo(BaseModel):
    """Quality assessment information for conversions."""

    score: float = Field(
        ...,
        description="Quality score from 0-100",
        ge=0.0,
        le=100.0
    )
    message: str = Field(
        ...,
        description="Human-readable quality assessment message"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed quality metrics breakdown"
    )


class ConversionResponse(BaseModel):
    """
    Common response model for conversion operations.

    This model can be extended and reused across different export endpoints
    to provide consistent response structures.
    """

    success: bool = Field(
        ...,
        description="Whether the conversion was successful"
    )
    file_data: Optional[str] = Field(
        default=None,
        description="Base64-encoded file content (if successful)"
    )
    filename: Optional[str] = Field(
        default=None,
        description="Suggested filename for the exported file"
    )
    content_type: Optional[str] = Field(
        default=None,
        description="MIME type of the exported file"
    )
    format: Optional[str] = Field(
        default=None,
        description="Export format used"
    )
    quality: Optional[ConversionQualityInfo] = Field(
        default=None,
        description="Quality assessment of the conversion"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if conversion failed"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional format-specific metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "file_data": "PD94bWwgdmVyc2lvbj0iMS4wIi...",
                "filename": "diagram.diagramsnet.xml",
                "content_type": "application/xml",
                "format": "xml",
                "quality": {
                    "score": 92.5,
                    "message": "Excellent conversion quality (92.5%) - Ready for use",
                    "details": {
                        "structural": 95.0,
                        "visual": 90.0,
                        "icons": 92.0
                    }
                },
                "error_message": None,
                "metadata": {
                    "original_nodes": 5,
                    "converted_nodes": 5,
                    "original_edges": 4,
                    "converted_edges": 4
                }
            }
        }


class DiagramsNetExportResponse(ConversionResponse):
    """
    Specific response model for diagrams.net exports.

    Extends the common ConversionResponse with diagrams.net-specific metadata.
    """

    # diagrams.net specific metadata can be added here
    diagrams_version: Optional[str] = Field(
        default="21.7.5",
        description="diagrams.net version compatibility"
    )

    class Config:
        json_schema_extra = {
            "example": {
                **ConversionResponse.Config.json_schema_extra["example"],
                "diagrams_version": "21.7.5"
            }
        }


# Legacy response model for backwards compatibility with existing endpoints
class DiagramExportResponse(BaseModel):
    """Legacy response model for diagram exports - for backwards compatibility."""

    svg_content: Optional[str] = Field(default=None, description="SVG content")
    image_data: Optional[str] = Field(default=None, description="Base64 image data")
    width: Optional[int] = Field(default=None, description="Image width")
    height: Optional[int] = Field(default=None, description="Image height")


# Error response model
class ConversionError(BaseModel):
    """Error response model for conversion failures."""

    success: bool = Field(default=False, description="Always false for errors")
    error_type: str = Field(..., description="Type of error that occurred")
    error_message: str = Field(..., description="Detailed error message")
    request_id: Optional[str] = Field(default=None, description="Request ID for debugging")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error_type": "validation_error",
                "error_message": "Invalid SVG content provided",
                "request_id": "req_123456789"
            }
        }
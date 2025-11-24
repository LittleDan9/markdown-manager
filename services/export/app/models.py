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


class DrawioXMLExportRequest(BaseModel):
    """Request model for Draw.io XML export from Mermaid source and SVG."""

    mermaid_source: str = Field(
        ...,
        description="Raw Mermaid source code",
        min_length=1
    )
    svg_content: str = Field(
        ...,
        description="Rendered SVG content from Mermaid",
        min_length=1
    )
    icon_service_url: Optional[str] = Field(
        default=None,
        description="Override default icon service URL for fetching icons"
    )
    width: int = Field(
        default=1000,
        description="Canvas width for the Draw.io diagram",
        ge=100,
        le=5000
    )
    height: int = Field(
        default=600,
        description="Canvas height for the Draw.io diagram",
        ge=100,
        le=5000
    )
    is_dark_mode: bool = Field(
        default=False,
        description="Whether the diagram uses dark mode styling"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "mermaid_source": "graph TD\n    A@{ icon: \"network:firewall\", label: \"Firewall\" } --> B[Server]",
                "svg_content": "<svg>...</svg>",
                "icon_service_url": "http://localhost:8000",
                "width": 1000,
                "height": 600,
                "is_dark_mode": False
            }
        }


class DrawioPNGExportRequest(BaseModel):
    """Request model for Draw.io PNG export from Mermaid source and SVG."""

    mermaid_source: str = Field(
        ...,
        description="Raw Mermaid source code",
        min_length=1
    )
    svg_content: str = Field(
        ...,
        description="Rendered SVG content from Mermaid",
        min_length=1
    )
    icon_service_url: Optional[str] = Field(
        default=None,
        description="Override default icon service URL for fetching icons"
    )
    width: Optional[int] = Field(
        default=None,
        description="Image width (auto-detected from SVG if not provided)",
        ge=100,
        le=5000
    )
    height: Optional[int] = Field(
        default=None,
        description="Image height (auto-detected from SVG if not provided)",
        ge=100,
        le=5000
    )
    transparent_background: bool = Field(
        default=True,
        description="Whether to use transparent background in PNG"
    )
    is_dark_mode: bool = Field(
        default=False,
        description="Whether the diagram uses dark mode styling"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "mermaid_source": "graph TD\n    A@{ icon: \"network:firewall\", label: \"Firewall\" } --> B[Server]",
                "svg_content": "<svg>...</svg>",
                "icon_service_url": "http://localhost:8000",
                "width": None,
                "height": None,
                "transparent_background": True,
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


class DrawioQualityInfo(BaseModel):
    """Quality assessment information for Draw.io conversions."""

    score: float = Field(
        ...,
        description="Overall quality score from 0-100",
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
    structural_fidelity: float = Field(
        ...,
        description="Structural fidelity score (0-100)",
        ge=0.0,
        le=100.0
    )
    visual_quality: float = Field(
        ...,
        description="Visual quality score (0-100)",
        ge=0.0,
        le=100.0
    )
    icon_success_rate: float = Field(
        ...,
        description="Icon fetching success rate (0-100)",
        ge=0.0,
        le=100.0
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


class DrawioExportResponse(BaseModel):
    """
    Response model for Draw.io exports with enhanced quality assessment.
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
    format: str = Field(
        ...,
        description="Export format used (xml or png)"
    )
    quality: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Comprehensive quality assessment of the conversion"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if conversion failed"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional conversion metadata and statistics"
    )
    drawio_version: str = Field(
        default="24.7.5",
        description="Draw.io version compatibility"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "file_data": "PD94bWwgdmVyc2lvbj0iMS4wIi...",
                "filename": "diagram.drawio",
                "content_type": "application/xml",
                "format": "xml",
                "quality": {
                    "score": 92.5,
                    "message": "Excellent conversion quality (92.5%) - Ready for use",
                    "details": {
                        "structural_fidelity": 95.0,
                        "visual_quality": 90.0,
                        "icon_success_rate": 92.0
                    },
                    "structural_fidelity": 95.0,
                    "visual_quality": 90.0,
                    "icon_success_rate": 92.0
                },
                "error_message": None,
                "metadata": {
                    "original_nodes": 5,
                    "original_edges": 4,
                    "positioned_nodes": 5,
                    "canvas_width": 1000,
                    "canvas_height": 600,
                    "quality_score": 92.5
                },
                "drawio_version": "24.7.5"
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

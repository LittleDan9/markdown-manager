"""Icon schemas for API requests and responses."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class IconPackBase(BaseModel):
    """Base icon pack schema."""

    name: str = Field(..., description="Unique identifier like 'awssvg', 'logos'")
    display_name: str = Field(..., description="Human readable name like 'AWS Services'")
    category: str = Field(..., description="Grouping like 'aws', 'iconify'")
    description: Optional[str] = Field(None, description="Description of the icon pack")


class IconPackCreate(IconPackBase):
    """Icon pack creation schema."""

    icon_count: int = Field(0, ge=0, description="Number of icons in this pack")


class IconPackMetadataUpdate(BaseModel):
    """Schema for updating only icon pack metadata without affecting icons."""

    name: Optional[str] = Field(None, description="Unique identifier like 'awssvg', 'logos'")
    display_name: Optional[str] = Field(None, description="Human readable name like 'AWS Services'")
    category: Optional[str] = Field(None, description="Grouping like 'aws', 'iconify'")
    description: Optional[str] = Field(None, description="Description of the icon pack")


class IconMetadataUpdate(BaseModel):
    """Schema for updating individual icon metadata."""

    key: Optional[str] = Field(None, description="Icon key/identifier")
    search_terms: Optional[str] = Field(None, description="Searchable keywords")
    category: Optional[str] = Field(None, description="Icon category")


class IconPackResponse(IconPackBase):
    """Icon pack response schema."""

    id: int
    icon_count: int = Field(default=0, description="Number of icons in this pack")
    created_at: datetime
    updated_at: Optional[datetime] = None
    urls: Optional[Dict[str, str]] = Field(None, description="Reference URLs for REST navigation")

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def compute_icon_count(cls, data):
        """Compute icon_count from the icons relationship if available."""
        if isinstance(data, dict):
            # If it's already a dict with icon_count, use it
            if 'icon_count' in data:
                return data
            # If it's a dict without icon_count, set default
            data['icon_count'] = 0
            return data

        # If it's a SQLAlchemy model object
        if hasattr(data, 'icons') and data.icons is not None:
            # Create a dict from the model and add computed icon_count
            result = {}
            for field in ['id', 'name', 'display_name', 'category', 'description', 'created_at', 'updated_at']:
                if hasattr(data, field):
                    result[field] = getattr(data, field)
            result['icon_count'] = len(data.icons)
            return result

        # Fallback: convert to dict and add default icon_count
        if hasattr(data, '__dict__'):
            result = {k: v for k, v in data.__dict__.items() if not k.startswith('_')}
            result['icon_count'] = 0
            return result

        return data


class IconMetadataBase(BaseModel):
    """Base icon metadata schema."""

    key: str = Field(..., description="Icon identifier within pack")
    search_terms: str = Field(..., description="Space-separated search terms")
    icon_data: Optional[Dict[str, Any]] = Field(None, description="JSONB data for icon")
    file_path: Optional[str] = Field(None, description="File path for SVG files")


class IconMetadataCreate(IconMetadataBase):
    """Icon metadata creation schema."""

    pack_id: int = Field(..., description="ID of the icon pack")
    full_key: str = Field(..., description="Computed pack.name:key")


class IconMetadataResponse(IconMetadataBase):
    """Icon metadata response schema."""

    id: int
    pack_id: int
    full_key: str
    access_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    pack: Optional[IconPackResponse] = None
    urls: Optional[Dict[str, str]] = Field(None, description="Reference URLs for REST navigation")

    model_config = ConfigDict(from_attributes=True)


class IconSearchRequest(BaseModel):
    """Icon search request schema."""

    q: str = Field("", description="Search term")
    pack: str = Field("all", description="Filter by pack name")
    category: str = Field("all", description="Filter by category")
    page: int = Field(0, ge=0, description="Page number for pagination")
    size: int = Field(24, ge=1, le=1000, description="Number of results per page")


class IconSearchResponse(BaseModel):
    """Icon search response schema with pagination."""

    icons: List[IconMetadataResponse]
    total: int = Field(..., description="Total number of matching icons")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Number of results per page")
    pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")


class IconBatchRequest(BaseModel):
    """Batch icon request schema."""

    icon_keys: List[str] = Field(..., description="List of full icon keys (pack:key)")
    include_svg: bool = Field(False, description="Whether to include SVG content")


class IconBatchResponse(BaseModel):
    """Batch icon response schema."""

    icons: List[IconMetadataResponse]
    not_found: List[str] = Field(description="Keys that were not found")


class IconSVGResponse(BaseModel):
    """Icon SVG content response schema."""

    content: str = Field(..., description="SVG content as string")
    content_type: str = Field(default="image/svg+xml", description="MIME type")
    cache_control: str = Field(default="public, max-age=3600", description="Cache headers")


class IconPackListResponse(BaseModel):
    """Icon pack list response schema."""

    packs: List[IconPackResponse]
    total: int = Field(..., description="Total number of packs")


class IconUsageTrackingRequest(BaseModel):
    """Icon usage tracking request schema."""

    pack: str = Field(..., description="Pack name")
    key: str = Field(..., description="Icon key")
    user_id: Optional[int] = Field(None, description="User ID if authenticated")


class IconifyIconData(BaseModel):
    """Standardized Iconify format for icon data."""

    body: str = Field(..., description="SVG body content (without <svg> wrapper)")
    width: Optional[int] = Field(24, description="Icon width")
    height: Optional[int] = Field(24, description="Icon height")
    viewBox: Optional[str] = Field(None, description="SVG viewBox attribute")

    @field_validator('body')
    @classmethod
    def validate_body(cls, v: str) -> str:
        """Validate that body doesn't contain full SVG tags."""
        if v.strip().startswith('<svg') or v.strip().startswith('<?xml'):
            raise ValueError("Body should contain only SVG path/shape elements, not full SVG tags")
        return v.strip()


class StandardizedIconPackRequest(BaseModel):
    """Standardized icon pack format (Iconify-style)."""

    info: Dict[str, Any] = Field(..., description="Pack metadata")
    icons: Dict[str, IconifyIconData] = Field(..., description="Icon data in Iconify format")
    width: Optional[int] = Field(24, description="Pack-level default width")
    height: Optional[int] = Field(24, description="Pack-level default height")

    @field_validator('info')
    @classmethod
    def validate_info(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Validate required info fields."""
        required_fields = ['name', 'displayName', 'category']
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Missing required info field: {field}")
        return v

    @field_validator('icons')
    @classmethod
    def validate_icons(cls, v: Dict[str, IconifyIconData]) -> Dict[str, IconifyIconData]:
        """Validate icons dictionary is not empty."""
        if not v:
            raise ValueError("Icons dictionary cannot be empty")
        return v


class IconPackInstallRequest(BaseModel):
    """Icon pack installation request schema - Standardized Iconify format only."""

    pack_data: StandardizedIconPackRequest = Field(..., description="Standardized icon pack data in Iconify format")


class IconPackUpdateRequest(BaseModel):
    """Icon pack update request schema - Standardized Iconify format only."""

    pack_data: StandardizedIconPackRequest = Field(..., description="Standardized icon pack data in Iconify format")


class IconPackDeleteResponse(BaseModel):
    """Icon pack deletion response schema."""

    success: bool = Field(..., description="Whether the deletion was successful")
    message: str = Field(..., description="Status message")


class IconPackStatisticsResponse(BaseModel):
    """Icon pack statistics response schema."""

    total_packs: int = Field(..., description="Total number of icon packs")
    total_icons: int = Field(..., description="Total number of icons")
    pack_breakdown: Dict[str, int] = Field(..., description="Breakdown by category")
    popular_icons: List[Dict[str, Any]] = Field(..., description="Most popular icons")


class MappingConfigExample(BaseModel):
    """Example mapping configuration schemas for different package types."""

    json_package: Dict[str, str] = Field(
        default={
            "name": "info.name",
            "display_name": "info.displayName",
            "category": "static:iconify",
            "description": "info.description",
            "icons_data": "icons",
            "width": "width",
            "height": "height",
            "svg": "body"
        },
        description="Example mapping for JSON-based packages like Iconify"
    )

    svg_files_package: Dict[str, str] = Field(
        default={
            "name": "static:aws-icons",
            "display_name": "static:AWS Service Icons",
            "category": "static:aws",
            "description": "static:Official AWS service icons",
            "files_path": "files",
            "base_path": "/path/to/svg/files",
            "file_path": "path",
            "key": "name"
        },
        description="Example mapping for SVG file-based packages like AWS icons"
    )

    mixed_package: Dict[str, str] = Field(
        default={
            "name": "package.name",
            "display_name": "package.displayName",
            "category": "package.category",
            "json_icons_data": "icons",
            "files_path": "svg_files",
            "base_path": "/path/to/files"
        },
        description="Example mapping for mixed packages with both JSON and files"
    )

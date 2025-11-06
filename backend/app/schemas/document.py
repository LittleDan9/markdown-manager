"""Pydantic schemas for documents."""
from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator


class DocumentBase(BaseModel):
    """Base document schema."""

    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., description="Markdown content")
    category_id: Optional[int] = Field(None, description="Category ID (legacy)")


class DocumentCreate(BaseModel):
    """Schema for creating a document with folder or category support."""

    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field("", description="Markdown content - defaults to empty string")

    # Support both new and legacy request formats
    folder_path: Optional[str] = Field(None, min_length=1, max_length=1000)
    category_id: Optional[int] = Field(None, description="Category ID (legacy support)")

    @field_validator('folder_path')
    @classmethod
    def validate_folder_path(cls, v):
        if v is not None and not v.startswith('/'):
            v = f"/{v}"
        return v

    @model_validator(mode='after')
    def validate_location_required(self):
        # At least one of folder_path or category_id must be provided
        if not self.folder_path and not self.category_id:
            # If neither is provided, default to /General
            self.folder_path = '/General'
        return self


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, description="Markdown content")
    category_id: Optional[int] = Field(
        None, description="Category ID for dictionary scope"
    )
    folder_path: Optional[str] = Field(None, min_length=1, max_length=1000)

    @field_validator('folder_path')
    @classmethod
    def validate_folder_path(cls, v):
        if v is not None and not v.startswith('/'):
            v = f"/{v}"
        return v


class DocumentInDB(DocumentBase):
    """Schema for document in database."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_shared: bool = False
    share_token: Optional[str] = None
    category: Optional[str] = None  # This will be populated by the CRUD layer

    # NEW: Folder-based fields
    folder_path: str = Field(default="/", description="Hierarchical folder path")

    # NEW: Filesystem storage fields
    file_path: Optional[str] = Field(None, description="Relative path to file in storage system")
    repository_type: str = Field(default="local", description="Repository type: local, github, or external")

    # GitHub integration fields
    github_repository_id: Optional[int] = None
    github_file_path: Optional[str] = None
    github_sha: Optional[str] = None
    github_sync_status: Optional[str] = None
    last_github_sync_at: Optional[datetime] = None
    github_branch: Optional[str] = None

    # GitHub repository information (expanded from relationship)
    github_repository: Optional[dict] = None
    repository_name: Optional[str] = None

    # Recent documents tracking
    last_opened_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "last_github_sync_at", "last_opened_at")
    def serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        """Serialize datetime to ISO format with Z suffix."""
        if dt is None:
            return None
        return _isoformat_utc(dt)


def _isoformat_utc(dt: datetime) -> str:
    """Format datetime as ISO 8601 with Z (UTC)."""
    if dt.tzinfo:
        return dt.astimezone().replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return dt.replace(microsecond=0).isoformat() + "Z"


class Document(DocumentInDB):
    """Public document schema."""

    pass


class DocumentList(BaseModel):
    """Schema for document list response."""

    documents: list[Document]
    total: int
    categories: list[str]


class DocumentConflictError(BaseModel):
    """Schema for document conflict error response."""

    detail: str
    conflict_type: str = "name_conflict"
    existing_document: Document


class ShareResponse(BaseModel):
    """Schema for share link response."""

    share_token: str
    is_shared: bool


class SharedDocument(BaseModel):
    """Schema for publicly shared document (limited fields)."""

    id: int
    name: str
    content: str
    category: Optional[str] = None  # Will be populated by CRUD layer
    category_id: Optional[int] = Field(None, description="Category ID")
    folder_path: str = Field(default="/", description="Folder path")
    updated_at: datetime
    author_name: str

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("updated_at")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format with Z suffix."""
        return _isoformat_utc(dt)


# NEW: Folder-specific schemas
class CreateFolderRequest(BaseModel):
    """Schema for creating a folder (virtual folder structure)."""

    path: str = Field(..., min_length=1, max_length=1000)

    @field_validator('path')
    @classmethod
    def validate_folder_path(cls, v):
        if not v.startswith('/'):
            v = f"/{v}"
        # Additional validation for invalid characters
        invalid_chars = ['\\', ':', '*', '?', '"', '<', '>', '|']
        if any(char in v for char in invalid_chars):
            raise ValueError("Folder path contains invalid characters")
        return v


class MoveDocumentRequest(BaseModel):
    """Schema for moving a document to a different folder."""

    new_folder_path: str = Field(..., min_length=1, max_length=1000)

    @field_validator('new_folder_path')
    @classmethod
    def validate_folder_path(cls, v):
        if not v.startswith('/'):
            v = f"/{v}"
        return v


class DocumentResponse(BaseModel):
    """Enhanced document response with folder support."""

    id: int
    name: str
    content: str
    folder_path: str
    created_at: datetime
    updated_at: datetime

    # Optional fields for backward compatibility
    category_id: Optional[int] = None
    category_name: Optional[str] = None

    # GitHub integration fields
    github_repository_id: Optional[int] = None
    github_file_path: Optional[str] = None
    github_branch: Optional[str] = None
    github_sync_status: Optional[str] = None

    # Computed fields
    root_folder: Optional[str] = None
    display_path: Optional[str] = None
    breadcrumbs: Optional[list[str]] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format with Z suffix."""
        return _isoformat_utc(dt)


class FolderStructureResponse(BaseModel):
    """Schema for folder structure response."""

    tree: dict
    total_folders: int
    user_id: int


class DocumentHistoryCommit(BaseModel):
    """Schema for a single commit in document history."""

    hash: str
    message: str
    author: str
    date: Optional[str] = None
    files: list[str] = []


class DocumentHistoryResponse(BaseModel):
    """Schema for document version history response."""

    document_id: int
    document_name: str
    repository_type: str
    history: list[DocumentHistoryCommit]


class DocumentVersionContent(BaseModel):
    """Schema for document content at a specific version."""

    document_id: int
    document_name: str
    commit_hash: str
    content: str


# Image metadata schemas for non-destructive cropping
class ImageCropData(BaseModel):
    """Schema for image crop information."""

    x: float = Field(..., ge=0, description="X coordinate of crop area (percentage or pixels)")
    y: float = Field(..., ge=0, description="Y coordinate of crop area (percentage or pixels)")
    width: float = Field(..., gt=0, description="Width of crop area (percentage or pixels)")
    height: float = Field(..., gt=0, description="Height of crop area (percentage or pixels)")
    unit: str = Field(default="percentage", pattern="^(percentage|pixels)$", description="Unit of measurement")


class ImageInstanceMetadata(BaseModel):
    """Schema for metadata of a specific image instance in the document."""

    crop: Optional[ImageCropData] = None
    original_dimensions: Optional[Dict[str, int]] = Field(None, description="Original image dimensions")
    last_modified: Optional[datetime] = None


class DocumentImageMetadata(BaseModel):
    """Schema for updating document image metadata."""

    filename: str = Field(..., description="Image filename")
    line_number: int = Field(..., ge=1, description="Line number where image appears")
    metadata: ImageInstanceMetadata


class DocumentImageMetadataUpdate(BaseModel):
    """Schema for batch updating multiple image metadata entries."""

    updates: List[DocumentImageMetadata] = Field(..., description="List of image metadata updates")

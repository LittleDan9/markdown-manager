"""GitHub integration schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GitHubAccountBase(BaseModel):
    """Base schema for GitHub accounts."""

    username: str = Field(..., description="GitHub username")
    display_name: Optional[str] = Field(None, description="Display name")
    email: Optional[str] = Field(None, description="Email address")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    is_active: bool = Field(True, description="Whether account is active")


class GitHubAccountCreate(GitHubAccountBase):
    """Schema for creating a GitHub account."""

    github_id: int = Field(..., description="GitHub user ID")
    access_token: str = Field(..., description="OAuth access token")
    refresh_token: Optional[str] = Field(None, description="OAuth refresh token")
    token_expires_at: Optional[datetime] = Field(None, description="Token expiration")


class GitHubAccountUpdate(BaseModel):
    """Schema for updating a GitHub account."""

    display_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None


class GitHubAccount(GitHubAccountBase):
    """Schema for returning GitHub account data."""

    id: int
    github_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    last_sync: Optional[datetime] = Field(None, description="Last sync timestamp")
    repository_count: Optional[int] = Field(None, description="Number of repositories")

    class Config:
        from_attributes = True


class GitHubRepositoryBase(BaseModel):
    """Base schema for GitHub repositories."""

    repo_full_name: str = Field(..., description="Full repository name (owner/repo)")
    repo_name: str = Field(..., description="Repository name")
    repo_owner: str = Field(..., description="Repository owner")
    description: Optional[str] = Field(None, description="Repository description")
    default_branch: str = Field("main", description="Default branch")
    is_private: bool = Field(False, description="Whether repository is private")
    is_enabled: bool = Field(True, description="Whether sync is enabled")
    auto_sync_enabled: bool = Field(False, description="Whether auto-sync is enabled")
    sync_interval_minutes: int = Field(60, description="Sync interval in minutes")


class GitHubRepositoryCreate(GitHubRepositoryBase):
    """Schema for creating a GitHub repository."""

    github_repo_id: int = Field(..., description="GitHub repository ID")
    account_id: int = Field(..., description="GitHub account ID")


class GitHubRepositoryUpdate(BaseModel):
    """Schema for updating a GitHub repository."""

    description: Optional[str] = None
    default_branch: Optional[str] = None
    is_enabled: Optional[bool] = None
    auto_sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None


class GitHubRepository(GitHubRepositoryBase):
    """Schema for returning GitHub repository data."""

    id: int
    github_repo_id: int
    account_id: int
    last_sync_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GitHubFileInfo(BaseModel):
    """Schema for GitHub file information."""

    path: str = Field(..., description="File path in repository")
    name: str = Field(..., description="File name")
    sha: str = Field(..., description="File SHA")
    size: int = Field(..., description="File size in bytes")
    download_url: str = Field(..., description="Direct download URL")
    content: Optional[str] = Field(None, description="File content (if retrieved)")


class GitHubOAuthCallback(BaseModel):
    """Schema for OAuth callback data."""

    code: str = Field(..., description="OAuth authorization code")
    state: Optional[str] = Field(None, description="CSRF protection state")


class GitHubSyncRequest(BaseModel):
    """Schema for sync operation requests."""

    document_id: int = Field(..., description="Document ID to sync")
    commit_message: Optional[str] = Field(None, description="Commit message")
    branch_name: str = Field("main", description="Target branch")


class GitHubSyncResponse(BaseModel):
    """Schema for sync operation responses."""

    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Operation message")
    commit_sha: Optional[str] = Field(None, description="Commit SHA if successful")
    sync_status: str = Field(..., description="Current sync status")


class GitHubImportRequest(BaseModel):
    """Schema for importing files from GitHub."""

    repository_id: int = Field(..., description="GitHub repository ID")
    file_path: str = Field(..., description="File path to import")
    category_id: int = Field(..., description="Target category ID")
    document_name: Optional[str] = Field(None, description="Custom document name")


class GitHubBranchInfo(BaseModel):
    """Schema for GitHub branch information."""

    name: str = Field(..., description="Branch name")
    commit_sha: str = Field(..., description="Latest commit SHA")
    is_default: bool = Field(False, description="Whether this is the default branch")

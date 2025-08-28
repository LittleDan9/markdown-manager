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


class GitHubRepositoryResponse(BaseModel):
    """Schema for repository list API responses - frontend-friendly format."""

    id: int
    github_repo_id: int
    name: str = Field(..., description="Repository name")
    full_name: str = Field(..., description="Full repository name (owner/repo)")
    description: Optional[str] = Field(None, description="Repository description")
    private: bool = Field(False, description="Whether repository is private")
    default_branch: str = Field("main", description="Default branch")

    @classmethod
    def from_repo(cls, repo: 'GitHubRepository') -> 'GitHubRepositoryResponse':
        """Create response from repository model."""
        return cls(
            id=repo.id,
            github_repo_id=repo.github_repo_id,
            name=repo.repo_name,
            full_name=repo.repo_full_name,
            description=repo.description,
            private=repo.is_private,
            default_branch=repo.default_branch
        )


class GitHubFileInfo(BaseModel):
    """Schema for GitHub file information."""

    path: str = Field(..., description="File path in repository")
    name: str = Field(..., description="File name")
    sha: str = Field(..., description="File SHA")
    size: int = Field(..., description="File size in bytes")
    type: str = Field(..., description="File type (file or dir)")
    download_url: Optional[str] = Field(None, description="Direct download URL (None for directories)")
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
    category_id: Optional[int] = Field(default=None, description="Target category ID (defaults to General)")
    document_name: Optional[str] = Field(default=None, description="Custom document name")
    branch: Optional[str] = Field(default=None, description="Branch name (optional)")

    class Config:
        extra = "ignore"  # Ignore extra fields like 'name' if sent


class GitHubBranchInfo(BaseModel):
    """Schema for GitHub branch information."""

    name: str = Field(..., description="Branch name")
    commit_sha: str = Field(..., description="Latest commit SHA")
    is_default: bool = Field(False, description="Whether this is the default branch")


# Phase 2: Commit Workflow Schemas
class GitHubCommitRequest(BaseModel):
    """Schema for committing changes to GitHub."""

    commit_message: str = Field(..., min_length=1, max_length=1000, description="Commit message")
    branch: Optional[str] = Field(None, description="Target branch (defaults to document's current branch)")
    create_new_branch: bool = Field(False, description="Whether to create a new branch")
    new_branch_name: Optional[str] = Field(None, min_length=1, max_length=100, description="New branch name if creating")
    force_commit: bool = Field(False, description="Override conflict detection")


class GitHubCommitResponse(BaseModel):
    """Schema for commit response."""

    success: bool = Field(..., description="Whether commit succeeded")
    commit_sha: str = Field(..., description="SHA of the new commit")
    commit_url: str = Field(..., description="URL to view the commit on GitHub")
    branch: str = Field(..., description="Branch where commit was made")
    message: str = Field(..., description="Success message")


class GitHubStatusResponse(BaseModel):
    """Schema for document GitHub status."""

    is_github_document: bool = Field(..., description="Whether document is linked to GitHub")
    sync_status: str = Field(..., description="Current sync status")
    has_local_changes: bool = Field(False, description="Whether there are uncommitted local changes")
    has_remote_changes: bool = Field(False, description="Whether there are unpulled remote changes")
    github_repository: Optional[str] = Field(None, description="Repository full name")
    github_branch: Optional[str] = Field(None, description="Current branch")
    github_file_path: Optional[str] = Field(None, description="File path in repository")
    last_sync: Optional[datetime] = Field(None, description="Last sync timestamp")
    status_info: dict = Field(default_factory=dict, description="UI display information")
    remote_content: Optional[str] = Field(None, description="Remote content if conflicts exist")


class GitHubPullRequest(BaseModel):
    """Schema for pulling remote changes."""

    force_overwrite: bool = Field(False, description="Overwrite local changes without creating backup")


class GitHubPullResponse(BaseModel):
    """Schema for pull response."""

    success: bool = Field(..., description="Whether pull succeeded")
    had_conflicts: bool = Field(..., description="Whether conflicts were detected")
    changes_pulled: bool = Field(..., description="Whether any changes were pulled")
    message: str = Field(..., description="Operation message")
    backup_created: bool = Field(False, description="Whether a backup was created")


class GitHubSyncHistoryEntry(BaseModel):
    """Schema for sync history entry."""

    id: int
    operation: str = Field(..., description="Type of operation (pull, push, etc.)")
    status: str = Field(..., description="Operation status")
    commit_sha: Optional[str] = Field(None, description="Related commit SHA")
    branch_name: str = Field(..., description="Branch name")
    message: Optional[str] = Field(None, description="Operation message")
    error_details: Optional[str] = Field(None, description="Error details if failed")
    files_changed: int = Field(default=0, description="Number of files changed")
    created_at: datetime = Field(..., description="When operation occurred")

    class Config:
        from_attributes = True


# Phase 3: Advanced Features Schemas
class GitHubConflictResolution(BaseModel):
    """Schema for resolving merge conflicts."""

    resolved_content: str = Field(..., min_length=1, description="User-resolved content")


class GitHubConflictResponse(BaseModel):
    """Schema for conflict resolution response."""

    success: bool = Field(..., description="Whether resolution succeeded")
    message: str = Field(..., description="Operation message")
    ready_to_commit: bool = Field(..., description="Whether document is ready to commit")


class GitHubPRCreateRequest(BaseModel):
    """Schema for creating a pull request."""

    title: str = Field(..., min_length=1, max_length=255, description="Pull request title")
    body: str = Field("", description="Pull request description")
    head_branch: str = Field(..., min_length=1, description="Source branch")
    base_branch: str = Field("main", description="Target branch")


class GitHubPRResponse(BaseModel):
    """Schema for pull request creation response."""

    number: int = Field(..., description="Pull request number")
    title: str = Field(..., description="Pull request title")
    body: str = Field(..., description="Pull request body")
    state: str = Field(..., description="Pull request state")
    html_url: str = Field(..., description="URL to view pull request")
    head_branch: str = Field(..., description="Source branch")
    base_branch: str = Field(..., description="Target branch")
    created_at: str = Field(..., description="Creation timestamp")


class GitHubPRListResponse(BaseModel):
    """Schema for pull request list response."""

    number: int = Field(..., description="Pull request number")
    title: str = Field(..., description="Pull request title")
    state: str = Field(..., description="Pull request state")
    html_url: str = Field(..., description="URL to view pull request")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")
    user_login: str = Field(..., description="Author username")
    user_avatar: str = Field(..., description="Author avatar URL")

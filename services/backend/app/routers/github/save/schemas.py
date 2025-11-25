"""GitHub save operation schemas."""
from typing import List, Optional
from pydantic import BaseModel, Field


class SaveToGitHubRequest(BaseModel):
    """Request schema for saving a document to GitHub."""
    repository_id: int = Field(..., description="GitHub repository ID")
    file_path: str = Field(..., description="Path where to save the file in the repository")
    branch: str = Field(default="main", description="Target branch")
    commit_message: Optional[str] = Field(None, description="Custom commit message")
    create_branch: bool = Field(default=False, description="Create branch if it doesn't exist")
    base_branch: Optional[str] = Field(None, description="Base branch for new branch creation")


class SaveToGitHubResponse(BaseModel):
    """Response schema for GitHub save operation."""
    success: bool
    message: str
    repository_url: str
    file_url: str
    commit_sha: str
    branch: str
    document_id: int


class GitHubRepositoryListItem(BaseModel):
    """Repository list item for repository selection."""
    id: int
    name: str
    full_name: str
    owner: str
    is_private: bool
    default_branch: str
    account_username: str


class RepositoryStatusResponse(BaseModel):
    """Response schema for repository status."""
    branch: str
    staged_files: List[str]
    modified_files: List[str]
    untracked_files: List[str]
    has_changes: bool
    needs_attention: bool
    status_message: str
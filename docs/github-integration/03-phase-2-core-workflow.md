# Phase 2: Core Workflow - GitHub Integration

## Overview

Phase 2 implements the core draft-to-commit workflow, building upon the foundation established in Phase 1. This phase adds commit functionality, sync status management, enhanced UI components, and the ability to save local changes back to GitHub repositories.

## Objectives

1. **Commit Workflow**: Implement saving local document changes as commits to GitHub
2. **Sync Status System**: Track synchronization status between local and GitHub content
3. **Branch Management**: Support committing to current branch or creating new branches
4. **Enhanced File Open Modal**: Add GitHub repository tab for browsing and importing files
5. **Document Status Indicators**: Visual indicators for GitHub document sync status
6. **Conflict Detection**: Detect when both local and remote changes exist

## Enhanced Database Schema

### 1. GitHub Sync History Model

**File**: `backend/app/models/github_sync_history.py`

```python
from __future__ import annotations

"""GitHub Sync History model for tracking sync operations."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import BaseModel

if TYPE_CHECKING:
    from .document import Document
    from .user import User


class GitHubSyncHistory(BaseModel):
    """GitHub Sync History model for tracking sync operations."""

    __tablename__ = "github_sync_history"

    # Foreign keys
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Sync operation details
    action: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'import', 'commit', 'pull', 'conflict'

    github_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    local_content_hash: Mapped[str | None] = mapped_column(String(40), nullable=True)
    commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    branch_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Additional metadata
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamp
    sync_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="sync_history")
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<GitHubSyncHistory(id={self.id}, action='{self.action}', document_id={self.document_id})>"
```

### 2. Enhanced Document Model Updates

**File**: `backend/app/models/document.py` (additional updates)

```python
# Add to existing Document class relationships
class Document(Base):
    # ... existing fields and relationships ...

    # GitHub sync history relationship
    sync_history: Mapped[list["GitHubSyncHistory"]] = relationship(
        "GitHubSyncHistory", back_populates="document", cascade="all, delete-orphan"
    )

    @property
    def github_status_info(self) -> dict:
        """Get GitHub status information for UI display."""
        if self.source_type != "github":
            return {"type": "local", "message": "Local document"}

        status_map = {
            "synced": {"type": "synced", "icon": "🟢", "message": "In sync with GitHub", "color": "success"},
            "local_changes": {"type": "draft", "icon": "🔵", "message": "Draft changes ready to commit", "color": "primary"},
            "remote_changes": {"type": "behind", "icon": "🟡", "message": "Updates available from GitHub", "color": "warning"},
            "conflict": {"type": "conflict", "icon": "🔴", "message": "Conflicts need resolution", "color": "danger"}
        }

        return status_map.get(self.sync_status, {"type": "unknown", "icon": "⚪", "message": "Unknown status", "color": "secondary"})
```

### 3. Database Migration for Phase 2

**File**: `backend/migrations/versions/XXX_github_phase2.py`

```python
"""Add GitHub sync history and enhanced features

Revision ID: github_integration_002
Revises: github_integration_001
Create Date: 2025-08-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'github_integration_002'
down_revision = 'github_integration_001'
branch_labels = None
depends_on = None


def upgrade():
    # Create github_sync_history table
    op.create_table('github_sync_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('github_sha', sa.String(length=40), nullable=True),
        sa.Column('local_content_hash', sa.String(length=40), nullable=True),
        sa.Column('commit_message', sa.Text(), nullable=True),
        sa.Column('branch_name', sa.String(length=100), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('sync_timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index(op.f('ix_github_sync_history_document_id'), 'github_sync_history', ['document_id'], unique=False)
    op.create_index(op.f('ix_github_sync_history_user_id'), 'github_sync_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_github_sync_history_action'), 'github_sync_history', ['action'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_github_sync_history_action'), table_name='github_sync_history')
    op.drop_index(op.f('ix_github_sync_history_user_id'), table_name='github_sync_history')
    op.drop_index(op.f('ix_github_sync_history_document_id'), table_name='github_sync_history')
    op.drop_table('github_sync_history')
```

## Backend API Enhancements

### 1. Enhanced GitHub Service for Commit Operations

**File**: `backend/app/services/github_service.py` (additions)

```python
# Add to existing GitHubService class

class GitHubService:
    # ... existing methods ...

    async def commit_file(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        content: str,
        message: str,
        branch: str,
        sha: Optional[str] = None,
        create_branch: bool = False,
        base_branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """Commit file changes to GitHub repository."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with aiohttp.ClientSession() as session:
            # Create new branch if requested
            if create_branch and base_branch:
                await self._create_branch(session, headers, owner, repo, branch, base_branch)

            # Prepare commit data
            commit_data = {
                "message": message,
                "content": base64.b64encode(content.encode('utf-8')).decode('utf-8'),
                "branch": branch
            }

            # Include SHA for updates (not for new files)
            if sha:
                commit_data["sha"] = sha

            url = f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{file_path}"

            async with session.put(url, json=commit_data, headers=headers) as response:
                if response.status not in (200, 201):
                    error_data = await response.json()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to commit file: {error_data.get('message', 'Unknown error')}"
                    )

                return await response.json()

    async def _create_branch(
        self,
        session: aiohttp.ClientSession,
        headers: Dict[str, str],
        owner: str,
        repo: str,
        new_branch: str,
        base_branch: str
    ) -> None:
        """Create a new branch from base branch."""
        # Get base branch SHA
        base_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs/heads/{base_branch}"
        async with session.get(base_url, headers=headers) as response:
            if response.status != 200:
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Failed to get base branch {base_branch}"
                )

            base_data = await response.json()
            base_sha = base_data["object"]["sha"]

        # Create new branch
        create_data = {
            "ref": f"refs/heads/{new_branch}",
            "sha": base_sha
        }

        create_url = f"{self.BASE_URL}/repos/{owner}/{repo}/git/refs"
        async with session.post(create_url, json=create_data, headers=headers) as response:
            if response.status != 201:
                error_data = await response.json()
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Failed to create branch: {error_data.get('message', 'Unknown error')}"
                )

    async def get_branches(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get all branches for a repository."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with aiohttp.ClientSession() as session:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/branches"
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get branches"
                    )

                return await response.json()

    async def check_file_status(
        self,
        access_token: str,
        owner: str,
        repo: str,
        file_path: str,
        branch: str,
        local_sha: str
    ) -> Dict[str, Any]:
        """Check if file has been updated on GitHub since last sync."""
        try:
            current_file = await self.get_file_content(
                access_token, owner, repo, file_path, branch
            )

            return {
                "exists": True,
                "current_sha": current_file["sha"],
                "has_remote_changes": current_file["sha"] != local_sha,
                "content": current_file.get("decoded_content", "")
            }
        except HTTPException as e:
            if e.status_code == 404:
                return {
                    "exists": False,
                    "current_sha": None,
                    "has_remote_changes": False,
                    "content": ""
                }
            raise

    async def log_sync_operation(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        action: str,
        github_sha: Optional[str] = None,
        local_content_hash: Optional[str] = None,
        commit_message: Optional[str] = None,
        branch_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log a sync operation to history."""
        from app.crud import github_sync_history as crud_sync_history

        sync_data = {
            "document_id": document_id,
            "user_id": user_id,
            "action": action,
            "github_sha": github_sha,
            "local_content_hash": local_content_hash,
            "commit_message": commit_message,
            "branch_name": branch_name,
            "metadata": metadata or {}
        }

        await crud_sync_history.create(db, obj_in=sync_data)
```

### 2. GitHub Commit Router

**File**: `backend/app/routers/github_commit.py`

```python
"""GitHub commit operations."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import document as crud_document
from app.crud import github_account as crud_github_account
from app.database import get_db
from app.models.user import User
from app.schemas.github import GitHubCommitRequest, GitHubCommitResponse
from app.services.github_service import github_service
from app.core.security import decrypt_token

router = APIRouter()


@router.post("/documents/{document_id}/commit", response_model=GitHubCommitResponse)
async def commit_document_to_github(
    document_id: int,
    commit_request: GitHubCommitRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Commit local document changes to GitHub."""

    # Get document and verify ownership
    document = await crud_document.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Verify it's a GitHub document
    if document.source_type != "github" or not document.github_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not linked to GitHub"
        )

    # Get repository and account
    repository = document.github_repository
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub repository not found"
        )

    # Get GitHub account
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to GitHub repository"
        )

    # Decrypt access token
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)

    # Check for conflicts if not forcing
    if not commit_request.force_commit:
        file_status = await github_service.check_file_status(
            access_token, owner, repo_name,
            document.github_file_path,
            commit_request.branch or document.github_branch,
            document.github_sha
        )

        if file_status["has_remote_changes"]:
            # Generate current content hash
            current_local_hash = github_service.generate_content_hash(document.content)

            # Check if local has changes too (conflict)
            if current_local_hash != document.local_sha:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Both local and remote changes detected. Please resolve conflicts first."
                )
            else:
                # Only remote changes, update local first
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Remote changes detected. Please pull updates first."
                )

    try:
        # Determine target branch
        target_branch = commit_request.branch or document.github_branch
        create_new_branch = commit_request.create_new_branch and commit_request.new_branch_name

        if create_new_branch:
            target_branch = commit_request.new_branch_name

        # Commit to GitHub
        commit_result = await github_service.commit_file(
            access_token=access_token,
            owner=owner,
            repo=repo_name,
            file_path=document.github_file_path,
            content=document.content,
            message=commit_request.commit_message,
            branch=target_branch,
            sha=document.github_sha if not create_new_branch else None,
            create_branch=create_new_branch,
            base_branch=document.github_branch if create_new_branch else None
        )

        # Update document metadata
        new_content_hash = github_service.generate_content_hash(document.content)

        document.github_sha = commit_result["content"]["sha"]
        document.local_sha = new_content_hash
        document.sync_status = "synced"
        document.last_github_sync = datetime.utcnow()
        document.github_commit_message = commit_request.commit_message

        # Update branch if creating new one
        if create_new_branch:
            document.github_branch = target_branch

        await db.commit()
        await db.refresh(document)

        # Log sync operation
        await github_service.log_sync_operation(
            db=db,
            document_id=document.id,
            user_id=current_user.id,
            action="commit",
            github_sha=commit_result["content"]["sha"],
            local_content_hash=new_content_hash,
            commit_message=commit_request.commit_message,
            branch_name=target_branch,
            metadata={
                "created_new_branch": create_new_branch,
                "commit_url": commit_result["commit"]["html_url"]
            }
        )

        return GitHubCommitResponse(
            success=True,
            commit_sha=commit_result["content"]["sha"],
            commit_url=commit_result["commit"]["html_url"],
            branch=target_branch,
            message="Changes committed successfully to GitHub"
        )

    except Exception as e:
        # Revert document status on failure
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit to GitHub: {str(e)}"
        )


@router.get("/documents/{document_id}/status")
async def get_document_github_status(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get GitHub sync status for a document."""

    # Get document and verify ownership
    document = await crud_document.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if document.source_type != "github":
        return {
            "is_github_document": False,
            "sync_status": "local"
        }

    # Generate current content hash
    current_content_hash = github_service.generate_content_hash(document.content)
    has_local_changes = current_content_hash != document.local_sha

    # Check remote status if linked to GitHub
    has_remote_changes = False
    remote_content = None

    if document.github_repository_id:
        try:
            repository = document.github_repository
            accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
            account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

            if account:
                access_token = decrypt_token(account.access_token)
                owner, repo_name = repository.full_name.split("/", 1)

                file_status = await github_service.check_file_status(
                    access_token, owner, repo_name,
                    document.github_file_path,
                    document.github_branch,
                    document.github_sha
                )

                has_remote_changes = file_status["has_remote_changes"]
                remote_content = file_status["content"] if has_remote_changes else None
        except Exception:
            # If we can't check remote status, assume no changes
            pass

    # Determine overall status
    if has_local_changes and has_remote_changes:
        sync_status = "conflict"
    elif has_local_changes:
        sync_status = "local_changes"
    elif has_remote_changes:
        sync_status = "remote_changes"
    else:
        sync_status = "synced"

    return {
        "is_github_document": True,
        "sync_status": sync_status,
        "has_local_changes": has_local_changes,
        "has_remote_changes": has_remote_changes,
        "github_repository": repository.full_name if document.github_repository else None,
        "github_branch": document.github_branch,
        "github_file_path": document.github_file_path,
        "last_sync": document.last_github_sync,
        "status_info": document.github_status_info,
        "remote_content": remote_content
    }
```

### 3. Enhanced Schemas

**File**: `backend/app/schemas/github.py` (additions)

```python
# Add to existing schemas

class GitHubCommitRequest(BaseModel):
    """Schema for committing changes to GitHub."""
    commit_message: str = Field(..., min_length=1, max_length=1000)
    branch: Optional[str] = None  # If None, use document's current branch
    create_new_branch: bool = False
    new_branch_name: Optional[str] = Field(None, min_length=1, max_length=100)
    force_commit: bool = False  # Override conflict detection


class GitHubCommitResponse(BaseModel):
    """Schema for commit response."""
    success: bool
    commit_sha: str
    commit_url: str
    branch: str
    message: str


class GitHubStatusResponse(BaseModel):
    """Schema for document GitHub status."""
    is_github_document: bool
    sync_status: str
    has_local_changes: bool = False
    has_remote_changes: bool = False
    github_repository: Optional[str] = None
    github_branch: Optional[str] = None
    github_file_path: Optional[str] = None
    last_sync: Optional[datetime] = None
    status_info: Dict[str, Any] = {}
    remote_content: Optional[str] = None


class GitHubPullRequest(BaseModel):
    """Schema for pulling remote changes."""
    force_overwrite: bool = False  # Overwrite local changes


class GitHubPullResponse(BaseModel):
    """Schema for pull response."""
    success: bool
    had_conflicts: bool
    changes_pulled: bool
    message: str
    backup_created: bool = False


# Sync history schemas
class GitHubSyncHistoryResponse(BaseModel):
    """Schema for sync history entry."""
    id: int
    action: str
    github_sha: Optional[str]
    commit_message: Optional[str]
    branch_name: Optional[str]
    sync_timestamp: datetime
    metadata: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True
```

## Frontend Implementation

### 1. Enhanced GitHub API Service

**File**: `frontend/src/api/githubApi.js` (additions)

```javascript
// Add to existing GitHubAPI class

class GitHubAPI extends Api {
  // ... existing methods ...

  // Commit operations
  async commitDocument(documentId, commitData) {
    const res = await this.apiCall(`/github/documents/${documentId}/commit`, "POST", commitData);
    return res.data;
  }

  async getDocumentStatus(documentId) {
    const res = await this.apiCall(`/github/documents/${documentId}/status`, "GET");
    return res.data;
  }

  async pullChanges(documentId, pullData = {}) {
    const res = await this.apiCall(`/github/documents/${documentId}/pull`, "POST", pullData);
    return res.data;
  }

  // Branch operations
  async getBranches(repoId) {
    const res = await this.apiCall(`/github/repositories/${repoId}/branches`, "GET");
    return res.data;
  }

  // Sync history
  async getSyncHistory(documentId, limit = 10) {
    const res = await this.apiCall(`/github/documents/${documentId}/sync-history?limit=${limit}`, "GET");
    return res.data;
  }
}
```

### 2. GitHub Status Component

**File**: `frontend/src/components/GitHubStatusPanel.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Badge, Button, Spinner, Alert, Tooltip, OverlayTrigger } from "react-bootstrap";
import { githubApi } from "@/api/githubApi";
import { useNotification } from "@/components/NotificationProvider";

export default function GitHubStatusPanel({ document, onCommitClick, onPullClick }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showError } = useNotification();

  useEffect(() => {
    if (document?.id) {
      checkStatus();
    }
  }, [document?.id]);

  const checkStatus = async () => {
    if (!document?.id) return;

    setLoading(true);
    try {
      const statusData = await githubApi.getDocumentStatus(document.id);
      setStatus(statusData);
    } catch (error) {
      console.error("Failed to check GitHub status:", error);
      showError("Failed to check GitHub status");
    } finally {
      setLoading(false);
    }
  };

  if (!document || loading) {
    return (
      <div className="github-status-panel d-flex align-items-center">
        <Spinner animation="border" size="sm" className="me-2" />
        <small>Checking status...</small>
      </div>
    );
  }

  if (!status?.is_github_document) {
    return (
      <div className="github-status-panel">
        <Badge bg="secondary">
          📄 Local Document
        </Badge>
      </div>
    );
  }

  const statusInfo = status.status_info || {};
  const canCommit = status.has_local_changes && status.sync_status !== "conflict";
  const canPull = status.has_remote_changes && status.sync_status !== "conflict";
  const hasConflict = status.sync_status === "conflict";

  return (
    <div className="github-status-panel d-flex align-items-center gap-2">
      {/* Status Badge */}
      <OverlayTrigger
        placement="bottom"
        overlay={
          <Tooltip>
            {statusInfo.message}
            {status.github_repository && (
              <>
                <br />
                <small>{status.github_repository}:{status.github_branch}</small>
              </>
            )}
          </Tooltip>
        }
      >
        <Badge bg={statusInfo.color || "secondary"} className="d-flex align-items-center">
          <span className="me-1">{statusInfo.icon}</span>
          {statusInfo.message}
        </Badge>
      </OverlayTrigger>

      {/* Action Buttons */}
      {canCommit && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => onCommitClick?.(document)}
          title="Commit local changes to GitHub"
        >
          <i className="bi bi-cloud-upload me-1"></i>
          Commit
        </Button>
      )}

      {canPull && (
        <Button
          variant="warning"
          size="sm"
          onClick={() => onPullClick?.(document)}
          title="Pull updates from GitHub"
        >
          <i className="bi bi-cloud-download me-1"></i>
          Pull
        </Button>
      )}

      {hasConflict && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => onPullClick?.(document, true)}
          title="Resolve conflicts"
        >
          <i className="bi bi-exclamation-triangle me-1"></i>
          Resolve
        </Button>
      )}

      {/* Refresh Button */}
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={checkStatus}
        title="Refresh status"
      >
        <i className="bi bi-arrow-clockwise"></i>
      </Button>

      {/* Repository Info */}
      {status.github_repository && (
        <small className="text-muted">
          {status.github_repository.split('/')[1]}:{status.github_branch}
        </small>
      )}
    </div>
  );
}
```

### 3. GitHub Commit Modal

**File**: `frontend/src/components/modals/GitHubCommitModal.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { githubApi } from "@/api/githubApi";
import { useNotification } from "@/components/NotificationProvider";

export default function GitHubCommitModal({ show, onHide, document, onCommitSuccess }) {
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [createNewBranch, setCreateNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show && document?.github_repository_id) {
      loadBranches();
      setSelectedBranch(document.github_branch || "main");
      setCommitMessage("");
      setCreateNewBranch(false);
      setNewBranchName("");
    }
  }, [show, document]);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const branchesData = await githubApi.getBranches(document.github_repository_id);
      setBranches(branchesData);
    } catch (error) {
      console.error("Failed to load branches:", error);
      showError("Failed to load repository branches");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!commitMessage.trim()) {
      showError("Commit message is required");
      return;
    }

    if (createNewBranch && !newBranchName.trim()) {
      showError("New branch name is required");
      return;
    }

    setSubmitting(true);
    try {
      const commitData = {
        commit_message: commitMessage.trim(),
        branch: createNewBranch ? undefined : selectedBranch,
        create_new_branch: createNewBranch,
        new_branch_name: createNewBranch ? newBranchName.trim() : undefined
      };

      const result = await githubApi.commitDocument(document.id, commitData);

      showSuccess(`Changes committed successfully to ${result.branch}`);
      onCommitSuccess?.(result);
      onHide();

    } catch (error) {
      console.error("Failed to commit:", error);

      if (error.response?.status === 409) {
        showError("Conflicts detected. Please resolve conflicts first.");
      } else {
        showError("Failed to commit changes to GitHub");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!document) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Commit to GitHub</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Document Info */}
          <Alert variant="info" className="mb-3">
            <div className="d-flex align-items-center">
              <i className="bi bi-github me-2"></i>
              <div>
                <strong>Ready to commit:</strong> "{document.name}"<br />
                <small>
                  Repository: {document.github_repository?.full_name || "Unknown"}<br />
                  File: {document.github_file_path}
                </small>
              </div>
            </div>
          </Alert>

          {/* Commit Message */}
          <Form.Group className="mb-3">
            <Form.Label>Commit Message <span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              required
            />
            <Form.Text className="text-muted">
              Provide a clear description of the changes you made.
            </Form.Text>
          </Form.Group>

          {/* Branch Selection */}
          <Form.Group className="mb-3">
            <Form.Label>Target Branch</Form.Label>

            <Form.Check
              type="radio"
              id="existing-branch"
              label="Commit to existing branch"
              checked={!createNewBranch}
              onChange={() => setCreateNewBranch(false)}
              className="mb-2"
            />

            {!createNewBranch && (
              <Form.Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loading || branches.length === 0}
                className="ms-3 mb-2"
              >
                {loading ? (
                  <option>Loading branches...</option>
                ) : (
                  branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name} {branch.is_default ? "(default)" : ""}
                    </option>
                  ))
                )}
              </Form.Select>
            )}

            <Form.Check
              type="radio"
              id="new-branch"
              label="Create new branch"
              checked={createNewBranch}
              onChange={() => setCreateNewBranch(true)}
              className="mb-2"
            />

            {createNewBranch && (
              <Form.Control
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="new-branch-name"
                className="ms-3"
              />
            )}
          </Form.Group>

          {/* Options */}
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="keep-local"
              label="Keep local copy as working draft"
              checked={true}
              disabled={true}
              className="text-muted"
            />
            <Form.Text className="text-muted">
              Your local copy will remain available for further editing.
            </Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!commitMessage.trim() || submitting || (createNewBranch && !newBranchName.trim())}
          >
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Committing...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload me-2"></i>
                Commit Changes
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
```

This completes the Phase 2 implementation, providing the core commit workflow with comprehensive status tracking and user interface components.

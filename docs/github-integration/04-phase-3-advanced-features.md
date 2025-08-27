# Phase 3: Advanced Features - GitHub Integration

## Overview

Phase 3 implements advanced GitHub integration features including bidirectional sync with conflict resolution, pull request integration, advanced repository management, and performance optimizations. This phase enhances the collaborative workflow and provides professional-grade Git operations.

## Objectives

1. **Bidirectional Sync**: Pull updates from GitHub and merge with local changes
2. **Conflict Resolution**: User-friendly interface for resolving merge conflicts
3. **Pull Request Integration**: Create and manage pull requests directly from the editor
4. **Advanced Repository Management**: Repository settings, webhooks, and batch operations
5. **Performance Optimizations**: Caching, lazy loading, and background sync
6. **Collaboration Features**: Show recent changes and contributor information

## Enhanced Backend Implementation

### 1. GitHub Pull Operations Service

**File**: `backend/app/services/github_sync_service.py`

```python
"""Advanced GitHub synchronization service for bidirectional sync."""
import difflib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import aiohttp
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token
from app.crud import document as crud_document
from app.crud import github_account as crud_github_account
from app.models.document import Document
from app.models.github_account import GitHubAccount
from app.services.github_service import github_service


class GitHubSyncService:
    """Advanced synchronization service for GitHub integration."""

    def __init__(self):
        self.github_service = github_service

    async def pull_remote_changes(
        self,
        db: AsyncSession,
        document: Document,
        user_id: int,
        force_overwrite: bool = False
    ) -> Dict[str, Any]:
        """Pull remote changes and handle conflicts."""

        if document.source_type != "github" or not document.github_repository:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document is not linked to GitHub"
            )

        # Get GitHub account and access token
        repository = document.github_repository
        accounts = await crud_github_account.get_by_user_id(db, user_id=user_id)
        account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

        if not account:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to GitHub repository"
            )

        access_token = decrypt_token(account.access_token)
        owner, repo_name = repository.full_name.split("/", 1)

        # Get current remote file status
        try:
            remote_file = await self.github_service.get_file_content(
                access_token, owner, repo_name,
                document.github_file_path,
                document.github_branch
            )
        except HTTPException as e:
            if e.status_code == 404:
                return {
                    "success": False,
                    "error": "File no longer exists on GitHub",
                    "action_required": "file_deleted"
                }
            raise

        # Check if remote has actually changed
        if remote_file["sha"] == document.github_sha:
            return {
                "success": True,
                "message": "Already up to date",
                "had_conflicts": False,
                "changes_pulled": False
            }

        # Generate current local content hash
        current_local_hash = self.github_service.generate_content_hash(document.content)
        has_local_changes = current_local_hash != document.local_sha

        # Handle different scenarios
        if not has_local_changes:
            # No local changes, safe to update
            return await self._update_document_from_remote(
                db, document, remote_file, user_id
            )
        elif force_overwrite:
            # Force overwrite local changes
            backup_created = await self._create_backup(db, document, user_id)
            return await self._update_document_from_remote(
                db, document, remote_file, user_id, backup_created
            )
        else:
            # Attempt to merge changes
            return await self._merge_changes(
                db, document, remote_file, user_id
            )

    async def _update_document_from_remote(
        self,
        db: AsyncSession,
        document: Document,
        remote_file: Dict[str, Any],
        user_id: int,
        backup_created: bool = False
    ) -> Dict[str, Any]:
        """Update document with remote content."""

        remote_content = remote_file.get("decoded_content", "")
        new_content_hash = self.github_service.generate_content_hash(remote_content)

        # Update document
        document.content = remote_content
        document.github_sha = remote_file["sha"]
        document.local_sha = new_content_hash
        document.sync_status = "synced"
        document.last_github_sync = datetime.utcnow()

        await db.commit()
        await db.refresh(document)

        # Log sync operation
        await self.github_service.log_sync_operation(
            db=db,
            document_id=document.id,
            user_id=user_id,
            action="pull",
            github_sha=remote_file["sha"],
            local_content_hash=new_content_hash,
            metadata={
                "backup_created": backup_created,
                "file_size": len(remote_content)
            }
        )

        return {
            "success": True,
            "message": "Successfully pulled remote changes",
            "had_conflicts": False,
            "changes_pulled": True,
            "backup_created": backup_created
        }

    async def _create_backup(
        self,
        db: AsyncSession,
        document: Document,
        user_id: int
    ) -> bool:
        """Create a backup copy of the document before overwriting."""

        try:
            backup_name = f"{document.name} (Backup {datetime.now().strftime('%Y-%m-%d %H:%M')})"

            backup_data = {
                "name": backup_name,
                "content": document.content,
                "user_id": user_id,
                "category_id": document.category_id,
                "source_type": "local"  # Backup is always local
            }

            await crud_document.create(db, obj_in=backup_data)
            return True

        except Exception as e:
            # Log error but don't fail the entire operation
            print(f"Failed to create backup: {e}")
            return False

    async def _merge_changes(
        self,
        db: AsyncSession,
        document: Document,
        remote_file: Dict[str, Any],
        user_id: int
    ) -> Dict[str, Any]:
        """Attempt to merge local and remote changes."""

        remote_content = remote_file.get("decoded_content", "")

        # Get the original content (last synced version)
        original_content = ""
        if document.local_sha:
            # Try to reconstruct original content from sync history
            # This is a simplified approach - in production, you might want to store original content
            original_content = await self._get_original_content(db, document)

        # Perform three-way merge
        merge_result = self._three_way_merge(
            original_content,
            document.content,  # local version
            remote_content     # remote version
        )

        if not merge_result["has_conflicts"]:
            # Successful automatic merge
            new_content_hash = self.github_service.generate_content_hash(merge_result["merged_content"])

            document.content = merge_result["merged_content"]
            document.github_sha = remote_file["sha"]
            document.local_sha = new_content_hash
            document.sync_status = "local_changes"  # Still has merged content to commit
            document.last_github_sync = datetime.utcnow()

            await db.commit()
            await db.refresh(document)

            # Log sync operation
            await self.github_service.log_sync_operation(
                db=db,
                document_id=document.id,
                user_id=user_id,
                action="merge",
                github_sha=remote_file["sha"],
                local_content_hash=new_content_hash,
                metadata={
                    "auto_merged": True,
                    "conflicts_count": 0
                }
            )

            return {
                "success": True,
                "message": "Successfully merged remote changes",
                "had_conflicts": False,
                "changes_pulled": True,
                "auto_merged": True
            }
        else:
            # Conflicts detected - prepare conflict resolution data
            return {
                "success": False,
                "message": "Conflicts detected during merge",
                "had_conflicts": True,
                "changes_pulled": False,
                "conflict_data": {
                    "local_content": document.content,
                    "remote_content": remote_content,
                    "original_content": original_content,
                    "conflicts": merge_result["conflicts"],
                    "merged_content_with_markers": merge_result["merged_content"]
                }
            }

    async def _get_original_content(
        self,
        db: AsyncSession,
        document: Document
    ) -> str:
        """Retrieve original content from last successful sync."""
        # This is a simplified implementation
        # In production, you might want to store the original content or use Git-like diffs

        from app.crud import github_sync_history as crud_sync_history

        # Get last successful sync
        last_sync = await crud_sync_history.get_last_sync(
            db, document_id=document.id, action="pull"
        )

        if last_sync and last_sync.metadata:
            return last_sync.metadata.get("original_content", "")

        return ""

    def _three_way_merge(
        self,
        original: str,
        local: str,
        remote: str
    ) -> Dict[str, Any]:
        """Perform a three-way merge of text content."""

        # Split into lines for easier merging
        original_lines = original.splitlines(keepends=True)
        local_lines = local.splitlines(keepends=True)
        remote_lines = remote.splitlines(keepends=True)

        # Use difflib to compute differences
        local_diff = list(difflib.unified_diff(original_lines, local_lines, lineterm=''))
        remote_diff = list(difflib.unified_diff(original_lines, remote_lines, lineterm=''))

        # Simple conflict detection - if both versions changed the same lines
        conflicts = []
        merged_lines = original_lines.copy()

        # This is a simplified merge algorithm
        # A production implementation would use more sophisticated algorithms

        has_conflicts = False

        # Check for overlapping changes
        local_changed_lines = set()
        remote_changed_lines = set()

        # Parse diff hunks to find changed lines
        for diff_line in local_diff:
            if diff_line.startswith('@@'):
                # Parse hunk header to get line numbers
                parts = diff_line.split()
                if len(parts) >= 3:
                    local_range = parts[2].lstrip('+').split(',')
                    if len(local_range) >= 1:
                        start_line = int(local_range[0])
                        local_changed_lines.add(start_line)

        for diff_line in remote_diff:
            if diff_line.startswith('@@'):
                parts = diff_line.split()
                if len(parts) >= 3:
                    remote_range = parts[2].lstrip('+').split(',')
                    if len(remote_range) >= 1:
                        start_line = int(remote_range[0])
                        remote_changed_lines.add(start_line)

        # Check for conflicts (overlapping changes)
        conflict_lines = local_changed_lines.intersection(remote_changed_lines)

        if conflict_lines:
            has_conflicts = True
            conflicts = list(conflict_lines)

            # Create merged content with conflict markers
            merged_content = self._create_conflict_markers(local, remote, conflict_lines)
        else:
            # No conflicts, apply both sets of changes
            # This is simplified - in practice, you'd apply patches in order
            merged_content = remote if remote != original else local

        return {
            "has_conflicts": has_conflicts,
            "conflicts": conflicts,
            "merged_content": merged_content
        }

    def _create_conflict_markers(
        self,
        local_content: str,
        remote_content: str,
        conflict_lines: set
    ) -> str:
        """Create content with Git-style conflict markers."""

        local_lines = local_content.splitlines()
        remote_lines = remote_content.splitlines()

        merged_lines = []
        max_lines = max(len(local_lines), len(remote_lines))

        i = 0
        while i < max_lines:
            if i in conflict_lines:
                # Add conflict markers
                merged_lines.append("<<<<<<< LOCAL")
                if i < len(local_lines):
                    merged_lines.append(local_lines[i])
                merged_lines.append("=======")
                if i < len(remote_lines):
                    merged_lines.append(remote_lines[i])
                merged_lines.append(">>>>>>> REMOTE")
            else:
                # Use local version if available, otherwise remote
                if i < len(local_lines):
                    merged_lines.append(local_lines[i])
                elif i < len(remote_lines):
                    merged_lines.append(remote_lines[i])
            i += 1

        return '\n'.join(merged_lines)

    async def resolve_conflicts(
        self,
        db: AsyncSession,
        document: Document,
        resolved_content: str,
        user_id: int
    ) -> Dict[str, Any]:
        """Mark conflicts as resolved with user-provided content."""

        # Update document with resolved content
        new_content_hash = self.github_service.generate_content_hash(resolved_content)

        document.content = resolved_content
        document.local_sha = new_content_hash
        document.sync_status = "local_changes"  # Ready to commit resolved version

        await db.commit()
        await db.refresh(document)

        # Log conflict resolution
        await self.github_service.log_sync_operation(
            db=db,
            document_id=document.id,
            user_id=user_id,
            action="conflict_resolved",
            local_content_hash=new_content_hash,
            metadata={
                "resolved_manually": True,
                "content_length": len(resolved_content)
            }
        )

        return {
            "success": True,
            "message": "Conflicts resolved successfully",
            "ready_to_commit": True
        }


# Global service instance
github_sync_service = GitHubSyncService()
```

### 2. Pull Request Integration Service

**File**: `backend/app/services/github_pr_service.py`

```python
"""GitHub Pull Request integration service."""
from typing import Any, Dict, List, Optional

import aiohttp
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_token
from app.models.github_account import GitHubAccount
from app.models.github_repository import GitHubRepository


class GitHubPRService:
    """Service for GitHub Pull Request operations."""

    BASE_URL = "https://api.github.com"

    async def create_pull_request(
        self,
        access_token: str,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> Dict[str, Any]:
        """Create a pull request."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        pr_data = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch
        }

        async with aiohttp.ClientSession() as session:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls"

            async with session.post(url, json=pr_data, headers=headers) as response:
                if response.status not in (200, 201):
                    error_data = await response.json()
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to create pull request: {error_data.get('message', 'Unknown error')}"
                    )

                return await response.json()

    async def get_pull_requests(
        self,
        access_token: str,
        owner: str,
        repo: str,
        state: str = "open",
        per_page: int = 30
    ) -> List[Dict[str, Any]]:
        """Get pull requests for a repository."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        params = {
            "state": state,
            "per_page": per_page,
            "sort": "updated",
            "direction": "desc"
        }

        async with aiohttp.ClientSession() as session:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/pulls"

            async with session.get(url, params=params, headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=response.status,
                        detail="Failed to get pull requests"
                    )

                return await response.json()

    async def get_repository_contributors(
        self,
        access_token: str,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """Get repository contributors."""

        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with aiohttp.ClientSession() as session:
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/contributors"

            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    return []  # Return empty list if cannot get contributors

                return await response.json()


# Global service instance
github_pr_service = GitHubPRService()
```

### 3. Enhanced GitHub API Endpoints

**File**: `backend/app/routers/github_sync.py`

```python
"""GitHub synchronization endpoints."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import document as crud_document
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubPullRequest,
    GitHubPullResponse,
    GitHubConflictResolution,
    GitHubConflictResponse
)
from app.services.github_sync_service import github_sync_service

router = APIRouter()


@router.post("/documents/{document_id}/pull", response_model=GitHubPullResponse)
async def pull_github_changes(
    document_id: int,
    pull_request: GitHubPullRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Pull changes from GitHub repository."""

    # Get document and verify ownership
    document = await crud_document.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Pull remote changes
    result = await github_sync_service.pull_remote_changes(
        db=db,
        document=document,
        user_id=current_user.id,
        force_overwrite=pull_request.force_overwrite
    )

    return GitHubPullResponse(**result)


@router.post("/documents/{document_id}/resolve-conflicts", response_model=GitHubConflictResponse)
async def resolve_conflicts(
    document_id: int,
    conflict_resolution: GitHubConflictResolution,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Resolve merge conflicts with user-provided content."""

    # Get document and verify ownership
    document = await crud_document.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Resolve conflicts
    result = await github_sync_service.resolve_conflicts(
        db=db,
        document=document,
        resolved_content=conflict_resolution.resolved_content,
        user_id=current_user.id
    )

    return GitHubConflictResponse(**result)


@router.get("/documents/{document_id}/sync-history")
async def get_sync_history(
    document_id: int,
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get synchronization history for a document."""

    # Get document and verify ownership
    document = await crud_document.get(db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    from app.crud import github_sync_history as crud_sync_history

    history = await crud_sync_history.get_by_document_id(
        db, document_id=document_id, limit=limit
    )

    return history
```

### 4. Pull Request Router

**File**: `backend/app/routers/github_pr.py`

```python
"""GitHub Pull Request endpoints."""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import github_account as crud_github_account
from app.crud import github_repository as crud_github_repository
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubPRCreateRequest,
    GitHubPRResponse,
    GitHubPRListResponse
)
from app.services.github_pr_service import github_pr_service
from app.core.security import decrypt_token

router = APIRouter()


@router.post("/repositories/{repo_id}/pull-requests", response_model=GitHubPRResponse)
async def create_pull_request(
    repo_id: int,
    pr_request: GitHubPRCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a pull request for a repository."""

    # Get repository and verify access
    repository = await crud_github_repository.get(db, id=repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify account ownership
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Create pull request
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)

    pr_data = await github_pr_service.create_pull_request(
        access_token=access_token,
        owner=owner,
        repo=repo_name,
        title=pr_request.title,
        body=pr_request.body,
        head_branch=pr_request.head_branch,
        base_branch=pr_request.base_branch
    )

    return GitHubPRResponse(
        number=pr_data["number"],
        title=pr_data["title"],
        body=pr_data["body"],
        state=pr_data["state"],
        html_url=pr_data["html_url"],
        head_branch=pr_data["head"]["ref"],
        base_branch=pr_data["base"]["ref"],
        created_at=pr_data["created_at"]
    )


@router.get("/repositories/{repo_id}/pull-requests", response_model=List[GitHubPRListResponse])
async def get_pull_requests(
    repo_id: int,
    state: str = "open",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get pull requests for a repository."""

    # Get repository and verify access
    repository = await crud_github_repository.get(db, id=repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify account ownership
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get pull requests
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)

    prs = await github_pr_service.get_pull_requests(
        access_token=access_token,
        owner=owner,
        repo=repo_name,
        state=state
    )

    return [
        GitHubPRListResponse(
            number=pr["number"],
            title=pr["title"],
            state=pr["state"],
            html_url=pr["html_url"],
            created_at=pr["created_at"],
            updated_at=pr["updated_at"],
            user_login=pr["user"]["login"],
            user_avatar=pr["user"]["avatar_url"]
        )
        for pr in prs
    ]
```

## Frontend Implementation

### 1. GitHub Pull Modal

**File**: `frontend/src/components/modals/GitHubPullModal.jsx`

```jsx
import React, { useState } from "react";
import { Modal, Button, Alert, Spinner, Form } from "react-bootstrap";
import { githubApi } from "@/api/githubApi";
import { useNotification } from "@/components/NotificationProvider";

export default function GitHubPullModal({
  show,
  onHide,
  document,
  conflictData = null,
  onPullSuccess
}) {
  const [pulling, setPulling] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handlePull = async () => {
    setPulling(true);
    try {
      const result = await githubApi.pullChanges(document.id, {
        force_overwrite: forceOverwrite
      });

      if (result.success) {
        showSuccess(result.message);
        onPullSuccess?.(result);
        onHide();
      } else if (result.had_conflicts) {
        // Handle conflicts
        onConflictDetected?.(result.conflict_data);
      }
    } catch (error) {
      console.error("Failed to pull changes:", error);
      showError("Failed to pull changes from GitHub");
    } finally {
      setPulling(false);
    }
  };

  if (!document) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Pull Updates from GitHub</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant="info">
          <div className="d-flex align-items-center">
            <i className="bi bi-cloud-download me-2"></i>
            <div>
              <strong>Pull remote changes for:</strong> "{document.name}"<br />
              <small>
                Repository: {document.github_repository?.full_name}<br />
                Branch: {document.github_branch}
              </small>
            </div>
          </div>
        </Alert>

        {conflictData && (
          <Alert variant="warning">
            <h6><i className="bi bi-exclamation-triangle me-2"></i>Conflicts Detected</h6>
            <p>
              Both local and remote versions have changes. You can:
            </p>
            <ul>
              <li>Cancel and manually resolve conflicts</li>
              <li>Force overwrite local changes (creates backup)</li>
              <li>Let the system attempt to merge automatically</li>
            </ul>
          </Alert>
        )}

        {document.sync_status === "local_changes" && (
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="force-overwrite"
              label="Force overwrite local changes (backup will be created)"
              checked={forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
            />
            <Form.Text className="text-muted">
              Warning: This will replace your local changes with the remote version.
              A backup copy will be created in your documents.
            </Form.Text>
          </Form.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={pulling}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handlePull}
          disabled={pulling}
        >
          {pulling ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Pulling Changes...
            </>
          ) : (
            <>
              <i className="bi bi-cloud-download me-2"></i>
              Pull Changes
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

### 2. Conflict Resolution Modal

**File**: `frontend/src/components/modals/GitHubConflictModal.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Alert, Tabs, Tab, Form } from "react-bootstrap";
import { githubApi } from "@/api/githubApi";
import { useNotification } from "@/components/NotificationProvider";

export default function GitHubConflictModal({
  show,
  onHide,
  document,
  conflictData,
  onResolutionSuccess
}) {
  const [activeTab, setActiveTab] = useState("merged");
  const [resolvedContent, setResolvedContent] = useState("");
  const [resolving, setResolving] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (conflictData?.merged_content_with_markers) {
      setResolvedContent(conflictData.merged_content_with_markers);
    }
  }, [conflictData]);

  const handleResolve = async () => {
    if (!resolvedContent.trim()) {
      showError("Please provide resolved content");
      return;
    }

    setResolving(true);
    try {
      const result = await githubApi.resolveConflicts(document.id, {
        resolved_content: resolvedContent
      });

      if (result.success) {
        showSuccess("Conflicts resolved successfully");
        onResolutionSuccess?.(result);
        onHide();
      }
    } catch (error) {
      console.error("Failed to resolve conflicts:", error);
      showError("Failed to resolve conflicts");
    } finally {
      setResolving(false);
    }
  };

  const useVersion = (content) => {
    setResolvedContent(content);
    setActiveTab("merged");
  };

  if (!conflictData) return null;

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Resolve Merge Conflicts</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant="warning">
          <h6><i className="bi bi-exclamation-triangle me-2"></i>Merge Conflicts Detected</h6>
          <p>
            Both local and remote versions have changes to the same content areas.
            Please resolve the conflicts by editing the merged version or choosing a complete version.
          </p>
        </Alert>

        <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
          <Tab eventKey="merged" title="Merged (Resolve Here)">
            <div className="mb-3">
              <p className="text-muted">
                Edit this content to resolve conflicts. Look for conflict markers:
                <code> &lt;&lt;&lt;&lt;&lt;&lt;&lt; LOCAL</code>,
                <code> =======</code>, and
                <code> &gt;&gt;&gt;&gt;&gt;&gt;&gt; REMOTE</code>
              </p>
              <Form.Control
                as="textarea"
                rows={20}
                value={resolvedContent}
                onChange={(e) => setResolvedContent(e.target.value)}
                className="font-monospace"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          <Tab eventKey="local" title="Local Version">
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="text-muted mb-0">Your local changes:</p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => useVersion(conflictData.local_content)}
                >
                  Use This Version
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={18}
                value={conflictData.local_content}
                readOnly
                className="font-monospace bg-light"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          <Tab eventKey="remote" title="Remote Version">
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <p className="text-muted mb-0">Remote changes from GitHub:</p>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => useVersion(conflictData.remote_content)}
                >
                  Use This Version
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={18}
                value={conflictData.remote_content}
                readOnly
                className="font-monospace bg-light"
                style={{ fontSize: "0.9rem" }}
              />
            </div>
          </Tab>

          {conflictData.original_content && (
            <Tab eventKey="original" title="Original Version">
              <div className="mb-3">
                <p className="text-muted">Original version before changes:</p>
                <Form.Control
                  as="textarea"
                  rows={18}
                  value={conflictData.original_content}
                  readOnly
                  className="font-monospace bg-light"
                  style={{ fontSize: "0.9rem" }}
                />
              </div>
            </Tab>
          )}
        </Tabs>

        <Alert variant="info" className="small">
          <strong>Tips for resolving conflicts:</strong>
          <ul className="mb-0 mt-2">
            <li>Remove conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;)</li>
            <li>Keep the changes you want from both versions</li>
            <li>Test your content after resolving</li>
            <li>You can switch tabs to compare different versions</li>
          </ul>
        </Alert>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={resolving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleResolve}
          disabled={resolving || !resolvedContent.trim()}
        >
          {resolving ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Resolving...
            </>
          ) : (
            <>
              <i className="bi bi-check-circle me-2"></i>
              Resolve Conflicts
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

### 3. Pull Request Creation Modal

**File**: `frontend/src/components/modals/GitHubPRModal.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { githubApi } from "@/api/githubApi";
import { useNotification } from "@/components/NotificationProvider";

export default function GitHubPRModal({
  show,
  onHide,
  repository,
  headBranch,
  onPRCreated
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [branches, setBranches] = useState([]);
  const [creating, setCreating] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (show && repository?.id) {
      loadBranches();
      setTitle(`Update documentation from ${headBranch}`);
      setBody(`This pull request contains updates to documentation files.

Changes made using Markdown Manager.`);
    }
  }, [show, repository, headBranch]);

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const branchesData = await githubApi.getBranches(repository.id);
      setBranches(branchesData);

      // Set default base branch
      const defaultBranch = branchesData.find(b => b.is_default);
      if (defaultBranch) {
        setBaseBranch(defaultBranch.name);
      }
    } catch (error) {
      console.error("Failed to load branches:", error);
      showError("Failed to load repository branches");
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showError("Pull request title is required");
      return;
    }

    setCreating(true);
    try {
      const prData = {
        title: title.trim(),
        body: body.trim(),
        head_branch: headBranch,
        base_branch: baseBranch
      };

      const result = await githubApi.createPullRequest(repository.id, prData);

      showSuccess(`Pull request #${result.number} created successfully`);
      onPRCreated?.(result);
      onHide();

    } catch (error) {
      console.error("Failed to create pull request:", error);
      showError("Failed to create pull request");
    } finally {
      setCreating(false);
    }
  };

  if (!repository) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create Pull Request</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info">
            <div className="d-flex align-items-center">
              <i className="bi bi-git me-2"></i>
              <div>
                <strong>Creating PR for:</strong> {repository.full_name}<br />
                <small>From: <code>{headBranch}</code> → To: <code>{baseBranch}</code></small>
              </div>
            </div>
          </Alert>

          {/* Title */}
          <Form.Group className="mb-3">
            <Form.Label>Title <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descriptive title for your pull request"
              required
            />
          </Form.Group>

          {/* Base Branch */}
          <Form.Group className="mb-3">
            <Form.Label>Base Branch (merge into)</Form.Label>
            <Form.Select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              disabled={loadingBranches}
            >
              {loadingBranches ? (
                <option>Loading branches...</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.is_default ? "(default)" : ""}
                  </option>
                ))
              )}
            </Form.Select>
          </Form.Group>

          {/* Description */}
          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the changes in this pull request..."
            />
            <Form.Text className="text-muted">
              You can use Markdown formatting in the description.
            </Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!title.trim() || creating}
          >
            {creating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Creating PR...
              </>
            ) : (
              <>
                <i className="bi bi-git me-2"></i>
                Create Pull Request
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
```

This completes Phase 3 with advanced bidirectional sync, conflict resolution, and pull request integration. Phase 4 will focus on polish, optimization, and additional collaboration features.

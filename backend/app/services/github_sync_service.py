"""Advanced GitHub synchronization service for bidirectional sync."""
import difflib
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.github_crud import GitHubCRUD
from app.crud.document import DocumentCRUD
from app.models.document import Document
from app.services.github_service import GitHubService


class GitHubSyncService:
    """Advanced synchronization service for GitHub integration."""

    def __init__(self):
        self.github_service = GitHubService()
        self.github_crud = GitHubCRUD()
        self.document_crud = DocumentCRUD()

    async def pull_remote_changes(
        self,
        db: AsyncSession,
        document: Document,
        user_id: int,
        force_overwrite: bool = False
    ) -> Dict[str, Any]:
        """Pull remote changes and handle conflicts."""

        if not document.github_repository_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document is not linked to GitHub"
            )

        # Get GitHub repository and account
        repository = await self.github_crud.get_repository(db, document.github_repository_id)
        if not repository or repository.account.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to GitHub repository"
            )

        owner, repo_name = repository.repo_full_name.split("/", 1)
        file_path = document.github_file_path or ""
        branch = document.github_branch or repository.default_branch

        # Get current remote file status
        try:
            remote_content, remote_sha = await self.github_service.get_file_content(
                repository.account.access_token, owner, repo_name, file_path, branch
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
        if remote_sha == document.github_sha:
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
                db, document, remote_content, remote_sha, user_id
            )
        elif force_overwrite:
            # Force overwrite local changes
            backup_created = await self._create_backup(db, document, user_id)
            return await self._update_document_from_remote(
                db, document, remote_content, remote_sha, user_id, backup_created
            )
        else:
            # Attempt to merge changes
            return await self._merge_changes(
                db, document, remote_content, remote_sha, user_id
            )

    async def _update_document_from_remote(
        self,
        db: AsyncSession,
        document: Document,
        remote_content: str,
        remote_sha: str,
        user_id: int,
        backup_created: bool = False
    ) -> Dict[str, Any]:
        """Update document with remote content."""

        new_content_hash = self.github_service.generate_content_hash(remote_content)

        # Update document
        document.content = remote_content
        document.github_sha = remote_sha
        document.local_sha = new_content_hash
        document.github_sync_status = "synced"
        document.last_github_sync_at = datetime.utcnow()

        await db.commit()
        await db.refresh(document)

        # Log sync operation
        if document.github_repository_id:
            await self._log_sync_operation(
                db=db,
                repository_id=document.github_repository_id,
                document_id=document.id,
                operation="pull",
                status="success",
                commit_sha=remote_sha,
                branch_name=document.github_branch or "main",
                message="Successfully pulled remote changes",
                files_changed=1
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

            backup_document = Document(**backup_data)
            db.add(backup_document)
            await db.commit()
            await db.refresh(backup_document)
            return True

        except Exception as e:
            # Log error but don't fail the entire operation
            print(f"Failed to create backup: {e}")
            return False

    async def _merge_changes(
        self,
        db: AsyncSession,
        document: Document,
        remote_content: str,
        remote_sha: str,
        user_id: int
    ) -> Dict[str, Any]:
        """Attempt to merge local and remote changes."""

        # Get the original content (last synced version)
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
            document.github_sha = remote_sha
            document.local_sha = new_content_hash
            document.github_sync_status = "local_changes"  # Still has merged content to commit
            document.last_github_sync_at = datetime.utcnow()

            await db.commit()
            await db.refresh(document)

            # Log sync operation
            if document.github_repository_id:
                await self._log_sync_operation(
                    db=db,
                    repository_id=document.github_repository_id,
                    document_id=document.id,
                    operation="merge",
                    status="success",
                    commit_sha=remote_sha,
                    branch_name=document.github_branch or "main",
                    message="Successfully merged remote changes",
                    files_changed=1
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

        # For now, return empty string - in a full implementation,
        # you might store the original content in sync history metadata
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
        document.github_sync_status = "local_changes"  # Ready to commit resolved version

        await db.commit()
        await db.refresh(document)

        # Log conflict resolution
        if document.github_repository_id:
            await self._log_sync_operation(
                db=db,
                repository_id=document.github_repository_id,
                document_id=document.id,
                operation="conflict_resolved",
                status="success",
                branch_name=document.github_branch or "main",
                message="Conflicts resolved manually",
                files_changed=1
            )

        return {
            "success": True,
            "message": "Conflicts resolved successfully",
            "ready_to_commit": True
        }

    async def _log_sync_operation(
        self,
        db: AsyncSession,
        repository_id: int,
        document_id: int,
        operation: str,
        status: str,
        branch_name: str,
        message: str | None = None,
        commit_sha: str | None = None,
        files_changed: int = 0,
        error_details: str | None = None
    ) -> None:
        """Log a sync operation to history."""

        sync_data = {
            "repository_id": repository_id,
            "document_id": document_id,
            "operation": operation,
            "status": status,
            "commit_sha": commit_sha,
            "branch_name": branch_name,
            "message": message,
            "error_details": error_details,
            "files_changed": files_changed
        }

        await self.github_crud.create_sync_history(db, sync_data)


# Global service instance
github_sync_service = GitHubSyncService()

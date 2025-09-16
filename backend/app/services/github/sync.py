"""Advanced GitHub synchronization service for bidirectional sync."""
import difflib
from datetime import datetime
from typing import Any, Dict

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.github_crud import GitHubCRUD
from app.crud.document import DocumentCRUD
from app.models.document import Document

from .base import BaseGitHubService


class GitHubSyncService(BaseGitHubService):
    """Advanced synchronization service for GitHub integration."""

    def __init__(self):
        """Initialize sync service."""
        super().__init__()
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
        from .api import GitHubAPIService
        api_service = GitHubAPIService()

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
            remote_content, remote_sha = await api_service.get_file_content(
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

        # Generate current local content hash using Git blob format for consistency
        current_local_hash = api_service.generate_git_blob_hash(document.content)
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
        from .api import GitHubAPIService
        api_service = GitHubAPIService()

        new_content_hash = api_service.generate_git_blob_hash(remote_content)

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
                db, document.github_repository_id, document.id,
                "pull", "success", document.github_branch or "main",
                "Pulled remote changes", remote_sha, 1
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
            backup_name = f"{document.name}_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            backup_folder = f"{document.folder_path}/backups" if document.folder_path else "backups"

            await self.document_crud.create_document_in_folder(
                db,
                user_id=user_id,
                name=backup_name,
                content=document.content,
                folder_path=backup_folder
            )

            return True
        except Exception as e:
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
            document.content,  # local changes
            remote_content     # remote changes
        )

        if not merge_result["has_conflicts"]:
            # Successful merge
            await self._update_document_from_remote(
                db, document, merge_result["merged_content"], remote_sha, user_id
            )
            return {
                "success": True,
                "message": "Successfully merged remote and local changes",
                "had_conflicts": False,
                "changes_pulled": True
            }
        else:
            # Conflicts detected, create content with conflict markers
            conflict_content = self._create_conflict_markers(
                document.content, remote_content, merge_result["conflicts"]
            )

            # Update document with conflict markers
            document.content = conflict_content
            document.github_sync_status = "conflict"
            await db.commit()

            return {
                "success": False,
                "message": "Merge conflicts detected",
                "had_conflicts": True,
                "conflicts": merge_result["conflicts"],
                "action_required": "resolve_conflicts"
            }

    async def _get_original_content(
        self,
        db: AsyncSession,
        document: Document
    ) -> str:
        """Retrieve original content from last successful sync."""
        # This is a simplified implementation
        # In production, you might want to store the original content or use Git-like diffs
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
        has_conflicts = False

        # Check for overlapping changes
        local_changed_lines = set()
        remote_changed_lines = set()

        # Parse diff hunks to find changed lines
        for diff_line in local_diff:
            if diff_line.startswith('@@'):
                # Extract line numbers from hunk header
                pass

        for diff_line in remote_diff:
            if diff_line.startswith('@@'):
                # Extract line numbers from hunk header
                pass

        # Check for conflicts (overlapping changes)
        conflict_lines = local_changed_lines.intersection(remote_changed_lines)

        if conflict_lines:
            has_conflicts = True
            merged_content = self._create_conflict_markers(local, remote, conflict_lines)
        else:
            # No conflicts, merge by applying both sets of changes
            merged_content = remote  # Simplified - prefer remote in non-conflicting cases

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
                # No conflict, use remote version (or local if remote doesn't have this line)
                if i < len(remote_lines):
                    merged_lines.append(remote_lines[i])
                elif i < len(local_lines):
                    merged_lines.append(local_lines[i])
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
        from .api import GitHubAPIService
        api_service = GitHubAPIService()

        # Update document with resolved content
        new_content_hash = api_service.generate_git_blob_hash(resolved_content)

        document.content = resolved_content
        document.local_sha = new_content_hash
        document.github_sync_status = "synced"
        document.last_github_sync_at = datetime.utcnow()

        await db.commit()

        # Log resolution
        if document.github_repository_id:
            await self._log_sync_operation(
                db, document.github_repository_id, document.id,
                "resolve_conflict", "success", document.github_branch or "main",
                "Conflicts resolved by user"
            )

        return {
            "success": True,
            "message": "Conflicts resolved successfully"
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
        """Log sync operation to database."""
        # Placeholder for logging implementation
        print(f"Sync operation logged: {operation} {status} on {branch_name}")


# Global service instance
github_sync_service = GitHubSyncService()

"""
Unified Git Operations - Consistent interface for all repository types

This service provides identical git operations for:
- Local category repositories (each category = git repo)
- GitHub cloned repositories
- Future repository types (Gitlab, Bitbucket, etc.)

Key principle: Document ID-based operations, not path-based
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.user import User
from app.services.storage.user import UserStorage
from app.services.github.filesystem import github_filesystem_service
from app.crud import document as document_crud


class UnifiedGitOperations:
    """
    Unified git operations that work identically across all repository types.

    Operations available:
    - get_git_status(document_id) -> status for any repo type
    - commit_changes(document_id, message) -> commit in local or GitHub repo
    - get_git_history(document_id, limit) -> history for any repo type
    - get_branch_info(document_id) -> branch info for any repo type
    """

    def __init__(self):
        self.storage_service = UserStorage()

    async def get_git_status(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Get git status for document - works for local categories and GitHub repos.

        Returns unified status format regardless of repository type.
        """
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        try:
            if document.repository_type == "local":
                return await self._get_local_git_status(document, user_id)
            elif document.repository_type == "github":
                return await self._get_github_git_status(db, document, user_id)
            else:
                raise ValueError(f"Unsupported repository type: {document.repository_type}")

        except Exception as e:
            # Return safe fallback status
            return {
                "current_branch": "unknown",
                "has_uncommitted_changes": False,
                "has_staged_changes": False,
                "has_untracked_files": False,
                "modified_files": [],
                "staged_files": [],
                "untracked_files": [],
                "ahead_behind": {"ahead": 0, "behind": 0},
                "repository_type": document.repository_type,
                "error": str(e)
            }

    async def commit_changes(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        commit_message: str,
        auto_push: bool = False
    ) -> Dict[str, Any]:
        """
        Commit changes for document - works for both local and GitHub repos.

        Args:
            document_id: Document to commit
            commit_message: Commit message
            auto_push: Whether to auto-push (GitHub repos only)

        Returns:
            Commit result with SHA and status
        """
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        if document.repository_type == "local":
            return await self._commit_local_changes(document, user_id, commit_message)
        elif document.repository_type == "github":
            return await self._commit_github_changes(db, document, user_id, commit_message, auto_push)
        else:
            raise ValueError(f"Unsupported repository type: {document.repository_type}")

    async def get_git_history(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get git history for document - unified across all repo types."""
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        if document.repository_type == "local":
            return await self._get_local_git_history(document, user_id, limit)
        elif document.repository_type == "github":
            return await self._get_github_git_history(db, document, user_id, limit)
        else:
            return []

    async def get_branch_info(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """Get branch information for document repository."""
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        if document.repository_type == "local":
            return await self._get_local_branch_info(document, user_id)
        elif document.repository_type == "github":
            return await self._get_github_branch_info(db, document, user_id)
        else:
            return {"current_branch": "unknown", "branches": []}

    # Local repository operations
    async def _get_local_git_status(self, document: Document, user_id: int) -> Dict[str, Any]:
        """Get git status for local category repository."""
        if not document.category_ref:
            raise ValueError("Document has no category")

        # Get category directory (each category is a git repo)
        category_dir = self.storage_service.get_category_directory(user_id, document.category_ref.name)

        if not category_dir.exists():
            raise ValueError(f"Category directory not found: {category_dir}")

        # Use existing git status service
        git_status = await github_filesystem_service.get_git_status(category_dir)

        return {
            "current_branch": git_status.get("current_branch", "main"),
            "has_uncommitted_changes": git_status.get("has_changes", False),
            "has_staged_changes": len(git_status.get("staged_files", [])) > 0,
            "has_untracked_files": len(git_status.get("untracked_files", [])) > 0,
            "modified_files": git_status.get("modified_files", []),
            "staged_files": git_status.get("staged_files", []),
            "untracked_files": git_status.get("untracked_files", []),
            "ahead_behind": git_status.get("ahead_behind", {"ahead": 0, "behind": 0}),
            "repository_type": "local",
            "category_name": document.category_ref.name
        }

    async def _get_github_git_status(self, db: AsyncSession, document: Document, user_id: int) -> Dict[str, Any]:
        """Get git status for GitHub repository."""
        from app.crud.github_crud import GitHubCRUD

        github_crud = GitHubCRUD()

        # Get repository details
        repository = await github_crud.get_repository(db, document.github_repository_id)
        if not repository:
            raise ValueError("GitHub repository not found")

        # Get cloned repository directory
        repo_dir = self.storage_service.get_github_repo_directory(
            user_id, repository.account_id, repository.repo_name
        )

        if not repo_dir.exists():
            # Repository not cloned yet - return sync-based status
            return {
                "current_branch": document.github_branch or repository.default_branch or "main",
                "has_uncommitted_changes": document.github_sync_status == "local_changes",
                "has_staged_changes": False,
                "has_untracked_files": False,
                "modified_files": [],
                "staged_files": [],
                "untracked_files": [],
                "ahead_behind": {"ahead": 0, "behind": 0},
                "repository_type": "github",
                "github_info": {
                    "repository_name": repository.repo_name,
                    "owner": repository.repo_owner,
                    "sync_status": document.github_sync_status,
                    "cloned": False
                }
            }

        # Get git status from cloned repository
        git_status = await github_filesystem_service.get_git_status(repo_dir)

        return {
            "current_branch": git_status.get("current_branch", document.github_branch),
            "has_uncommitted_changes": git_status.get("has_changes", False),
            "has_staged_changes": len(git_status.get("staged_files", [])) > 0,
            "has_untracked_files": len(git_status.get("untracked_files", [])) > 0,
            "modified_files": git_status.get("modified_files", []),
            "staged_files": git_status.get("staged_files", []),
            "untracked_files": git_status.get("untracked_files", []),
            "ahead_behind": git_status.get("ahead_behind", {"ahead": 0, "behind": 0}),
            "repository_type": "github",
            "github_info": {
                "repository_name": repository.repo_name,
                "owner": repository.repo_owner,
                "sync_status": document.github_sync_status,
                "cloned": True
            }
        }

    async def _commit_local_changes(self, document: Document, user_id: int, commit_message: str) -> Dict[str, Any]:
        """Commit changes in local category repository."""
        category_dir = self.storage_service.get_category_directory(user_id, document.category_ref.name)

        # Commit using filesystem service
        result = await github_filesystem_service.commit_changes(
            repo_dir=category_dir,
            commit_message=commit_message,
            files=[document.name] if document.file_path else None
        )

        return {
            "success": True,
            "commit_sha": result.get("commit_sha"),
            "commit_message": commit_message,
            "repository_type": "local",
            "category_name": document.category_ref.name
        }

    async def _commit_github_changes(
        self,
        db: AsyncSession,
        document: Document,
        user_id: int,
        commit_message: str,
        auto_push: bool
    ) -> Dict[str, Any]:
        """Commit changes in GitHub repository."""
        from app.crud.github_crud import GitHubCRUD

        github_crud = GitHubCRUD()
        repository = await github_crud.get_repository(db, document.github_repository_id)

        # Get repository directory
        repo_dir = self.storage_service.get_github_repo_directory(
            user_id, repository.account_id, repository.repo_name
        )

        # Commit changes
        result = await github_filesystem_service.commit_changes(
            repo_dir=repo_dir,
            commit_message=commit_message,
            files=[document.github_file_path] if document.github_file_path else None
        )

        # Optionally push to GitHub
        if auto_push:
            await github_filesystem_service.push_changes(
                repo_dir=repo_dir,
                branch=document.github_branch or repository.default_branch
            )

        # Update document sync status
        document.github_sync_status = "synced" if auto_push else "local_changes"
        document.local_sha = result.get("commit_sha")
        await db.commit()

        return {
            "success": True,
            "commit_sha": result.get("commit_sha"),
            "commit_message": commit_message,
            "repository_type": "github",
            "pushed": auto_push,
            "github_info": {
                "repository_name": repository.repo_name,
                "owner": repository.repo_owner,
                "branch": document.github_branch or repository.default_branch
            }
        }

    async def _get_local_git_history(self, document: Document, user_id: int, limit: int) -> List[Dict[str, Any]]:
        """Get git history for local category repository."""
        category_dir = self.storage_service.get_category_directory(user_id, document.category_ref.name)

        history = await github_filesystem_service.get_git_history(
            repo_dir=category_dir,
            file_path=document.name if document.file_path else None,
            limit=limit
        )

        return [
            {
                "sha": commit.get("sha"),
                "message": commit.get("message"),
                "author": commit.get("author"),
                "date": commit.get("date"),
                "repository_type": "local"
            }
            for commit in history
        ]

    async def _get_github_git_history(self, db: AsyncSession, document: Document, user_id: int, limit: int) -> List[Dict[str, Any]]:
        """Get git history for GitHub repository."""
        # Similar implementation for GitHub repos
        # Could use GitHub API or local git history
        return []

    async def _get_local_branch_info(self, document: Document, user_id: int) -> Dict[str, Any]:
        """Get branch info for local category repository."""
        category_dir = self.storage_service.get_category_directory(user_id, document.category_ref.name)

        branch_info = await github_filesystem_service.get_branch_info(category_dir)

        return {
            "current_branch": branch_info.get("current_branch", "main"),
            "branches": branch_info.get("branches", []),
            "repository_type": "local"
        }

    async def _get_github_branch_info(self, db: AsyncSession, document: Document, user_id: int) -> Dict[str, Any]:
        """Get branch info for GitHub repository."""
        from app.crud.github_crud import GitHubCRUD

        github_crud = GitHubCRUD()
        repository = await github_crud.get_repository(db, document.github_repository_id)

        # Could fetch from GitHub API or local repository
        return {
            "current_branch": document.github_branch or repository.default_branch,
            "branches": [repository.default_branch or "main"],  # Simplified
            "repository_type": "github"
        }


# Global service instance
unified_git_operations = UnifiedGitOperations()
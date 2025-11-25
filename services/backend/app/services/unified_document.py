"""Unified Document Service - Single interface for all document types."""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.user import User
from app.crud import document as document_crud


class UnifiedDocumentService:
    """
    Unified service for all document operations regardless of source.

    Core principle: Document ID is the only identifier needed.
    Backend determines source type and handles accordingly.
    """

    def __init__(self):
        # Use lazy imports to avoid circular dependencies
        self._storage_service = None
        self._github_service = None

    @property
    def storage_service(self):
        if self._storage_service is None:
            from app.services.storage.user import UserStorage
            self._storage_service = UserStorage()
        return self._storage_service

    @property
    def github_service(self):
        if self._github_service is None:
            from app.services.github import GitHubService
            self._github_service = GitHubService()
        return self._github_service

    async def get_document_with_content(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        force_sync: bool = False
    ) -> Dict[str, Any]:
        """
        Get document with content regardless of source type.

        Args:
            document_id: Document database ID
            user_id: User ID for authorization
            force_sync: Whether to force sync from remote source

        Returns:
            Unified document response with content
        """
        # Get document from database
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        # Update last opened timestamp - disabled due to greenlet issue
        # await self._update_last_opened(db, document)

        # Get content based on repository type
        if document.repository_type == "github":
            content = await self._get_github_document_content(db, document, force_sync)
        elif document.repository_type == "local":
            content = await self._get_local_document_content(document, user_id)
        else:
            raise ValueError(f"Unsupported repository type: {document.repository_type}")

        # Build unified response
        return {
            "id": document.id,
            "name": document.name,
            "content": content,
            "folder_path": document.folder_path,
            "repository_type": document.repository_type,
            "created_at": document.created_at.isoformat(),
            "updated_at": document.updated_at.isoformat(),
            "last_opened_at": document.last_opened_at.isoformat() if document.last_opened_at else None,

            # Category info for local documents
            "category_id": document.category_id,
            "category": document.category_ref.name if document.category_ref else None,

            # GitHub info for GitHub documents
            "github_repository_id": document.github_repository_id,
            "github_file_path": document.github_file_path,
            "github_branch": document.github_branch,
            "github_sync_status": document.github_sync_status,
            "last_github_sync_at": document.last_github_sync_at.isoformat() if document.last_github_sync_at else None,

            # Sharing info
            "share_token": document.share_token,
            "is_shared": document.is_shared,

            # Git status (works for both local and GitHub)
            "git_status": await self._get_git_status(document, user_id)
        }

    async def update_document_content(
        self,
        db: AsyncSession,
        document_id: int,
        user_id: int,
        content: str,
        commit_message: Optional[str] = None
    ) -> bool:
        """Update document content regardless of source type."""
        document = await document_crud.document.get(db=db, id=document_id)
        if not document or document.user_id != user_id:
            raise ValueError("Document not found or access denied")

        # Update content based on repository type
        if document.repository_type == "github":
            return await self._update_github_document_content(document, content, commit_message)
        elif document.repository_type == "local":
            return await self._update_local_document_content(document, user_id, content, commit_message)
        else:
            raise ValueError(f"Unsupported repository type: {document.repository_type}")

    async def _get_local_document_content(self, document: Document, user_id: int) -> str:
        """Get content for local document."""
        if not document.file_path:
            # Legacy document without file_path
            return getattr(document, 'content', "")

        try:
            return await self.storage_service.read_document(
                user_id=user_id,
                file_path=document.file_path
            )
        except Exception as e:
            print(f"Failed to read local document content: {e}")
            # Fallback to database content
            return getattr(document, 'content', "")

    async def _get_github_document_content(
        self,
        db: AsyncSession,
        document: Document,
        force_sync: bool
    ) -> str:
        """Get content for GitHub document with automatic sync."""
        # Import here to avoid circular imports
        from app.crud.github_crud import GitHubCRUD
        github_crud = GitHubCRUD()

        # Get repository info
        repository = await github_crud.get_repository(db, document.github_repository_id)
        if not repository:
            raise ValueError("GitHub repository not found")

        # Ensure repo is cloned and synced (this handles all the complexity)
        await self._ensure_github_repo_synced(document, repository, force_sync)

        # Read content from filesystem
        if document.file_path:
            try:
                return await self.storage_service.read_document(
                    user_id=document.user_id,
                    file_path=document.file_path
                )
            except Exception as e:
                print(f"Failed to read GitHub document content: {e}")
                return ""

        return ""

    async def _ensure_github_repo_synced(self, document: Document, repository, force_sync: bool):
        """Ensure GitHub repository is cloned and file is synced."""
        # Get repository directory
        repo_dir = self.storage_service.get_github_repo_directory(
            document.user_id, repository.account_id, repository.repo_name
        )

        # Clone if not exists
        if not repo_dir.exists() or force_sync:
            repo_url = f"https://github.com/{repository.repo_owner}/{repository.repo_name}.git"
            await self.github_service.clone_repository(
                repo_url,
                repo_dir,
                branch=document.github_branch or repository.default_branch or "main"
            )

        # Pull latest changes
        branch = document.github_branch or repository.default_branch or "main"
        await self.github_service._filesystem_service.pull_changes(repo_dir, branch)

        # Ensure document has filesystem path
        if not document.file_path:
            document.file_path = f"github/{repository.account_id}/{repository.repo_name}/{document.github_file_path}"

    async def _update_local_document_content(
        self,
        document: Document,
        user_id: int,
        content: str,
        commit_message: Optional[str]
    ) -> bool:
        """Update local document content."""
        if not document.file_path:
            # Legacy document - update database directly during migration
            document.content = content
            return True

        return await self.storage_service.write_document(
            user_id=user_id,
            file_path=document.file_path,
            content=content,
            commit_message=commit_message or f"Update content: {document.name}",
            auto_commit=True
        )

    async def _update_github_document_content(
        self,
        document: Document,
        content: str,
        commit_message: Optional[str]
    ) -> bool:
        """Update GitHub document content."""
        # Similar to local, but may need special handling for GitHub sync
        return await self.storage_service.write_document(
            user_id=document.user_id,
            file_path=document.file_path,
            content=content,
            commit_message=commit_message or f"Update content: {document.name}",
            auto_commit=True
        )

    async def _get_git_status(self, document: Document, user_id: int) -> Dict[str, Any]:
        """Get git status for document (works for both local and GitHub)."""
        if not document.file_path:
            return {"has_changes": False, "status": "no_git"}

        try:
            # Use the existing git status functionality
            from app.services.github.filesystem import github_filesystem_service

            if document.repository_type == "local":
                # Local category repo status
                category_dir = self.storage_service.get_category_directory(user_id, document.category_ref.name)
                return await github_filesystem_service.get_git_status(category_dir)
            else:
                # GitHub repo status
                from app.crud.github_crud import GitHubCRUD
                github_crud = GitHubCRUD()
                # Get repo directory and check status
                return {"has_changes": False, "status": "synced"}  # Simplified for now

        except Exception as e:
            print(f"Failed to get git status: {e}")
            return {"has_changes": False, "status": "error"}

    async def _update_last_opened(self, db: AsyncSession, document: Document):
        """Update last opened timestamp."""
        try:
            document.last_opened_at = datetime.utcnow()
            db.add(document)
            await db.commit()
        except Exception as e:
            # Log the error but don't fail the whole request over timestamp update
            print(f"Warning: Failed to update last_opened_at: {e}")
            await db.rollback()


# Global service instance
unified_document_service = UnifiedDocumentService()

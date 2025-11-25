"""Background synchronization service for GitHub integration."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.document import Document
from app.models.github_models import GitHubRepository
from app.crud.document import DocumentCRUD

from .base import BaseGitHubService
from .api import GitHubAPIService
from .sync import GitHubSyncService

logger = logging.getLogger(__name__)


class GitHubBackgroundService(BaseGitHubService):
    """Background service for GitHub synchronization."""

    def __init__(self):
        """Initialize background service."""
        super().__init__()
        self.sync_interval = 300  # 5 minutes
        self.max_documents_per_run = 50
        self.running = False
        self._task = None
        self.document_crud = DocumentCRUD()

    async def start(self) -> None:
        """Start the background sync service."""
        if self.running:
            return

        self.running = True
        logger.info("Starting GitHub background sync service")

        # Start the background task
        self._task = asyncio.create_task(self._background_sync_loop())

    def stop(self) -> None:
        """Stop the background sync service."""
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Stopping GitHub background sync service")

    async def _background_sync_loop(self) -> None:
        """Main background sync loop."""
        while self.running:
            try:
                await self.sync_documents()
            except Exception as e:
                logger.error(f"Background sync error: {e}")

            # Wait for next sync interval
            await asyncio.sleep(self.sync_interval)

    async def sync_documents(self) -> None:
        """Sync GitHub documents that need checking."""
        async with AsyncSessionLocal() as db:
            try:
                # Get documents that need syncing
                documents_to_check = await self._get_documents_needing_sync(db)

                if not documents_to_check:
                    logger.debug("No documents need background sync")
                    return

                logger.info(f"Background sync checking {len(documents_to_check)} documents")

                synced_count = 0
                error_count = 0

                for document in documents_to_check[:self.max_documents_per_run]:
                    try:
                        success = await self._sync_single_document(db, document)
                        if success:
                            synced_count += 1
                        else:
                            error_count += 1
                    except Exception as e:
                        logger.error(f"Failed to sync document {document.id}: {e}")
                        error_count += 1

                logger.info(f"Background sync completed: {synced_count} synced, {error_count} errors")
                await db.commit()

            except Exception as e:
                logger.error(f"Background sync failed: {e}")
                await db.rollback()

    async def _get_documents_needing_sync(self, db: AsyncSession) -> List[Document]:
        """Get GitHub documents that need background sync."""
        # Get documents that:
        # 1. Are GitHub documents
        # 2. Haven't been synced in the last 30 minutes
        # 3. Have sync enabled (if we add that field later)

        thirty_minutes_ago = datetime.utcnow() - timedelta(minutes=30)

        query = select(Document).where(
            and_(
                Document.github_repository_id.isnot(None),
                or_(
                    Document.last_github_sync_at.is_(None),
                    Document.last_github_sync_at < thirty_minutes_ago
                )
            )
        ).limit(100)  # Limit to prevent overwhelming the system

        result = await db.execute(query)
        return list(result.scalars().all())

    async def _sync_single_document(self, db: AsyncSession, document: Document) -> bool:
        """Sync a single GitHub document."""
        try:
            # Get repository with account
            repo_query = select(GitHubRepository).where(GitHubRepository.id == document.github_repository_id)
            repo_result = await db.execute(repo_query)
            repository = repo_result.scalar_one_or_none()

            if not repository or not repository.account:
                logger.warning(f"Document {document.id} has invalid repository or account")
                return False

            access_token = repository.account.access_token
            if not access_token:
                logger.warning(f"No access token for repository {repository.id}")
                return False

            # Use GitHubSyncService to check and sync the document
            sync_service = GitHubSyncService(db)

            # Check if remote file has changed
            api_service = GitHubAPIService()
            try:
                remote_content, remote_sha = await api_service.get_file_content(
                    access_token,
                    repository.repo_owner,
                    repository.repo_name,
                    document.github_file_path,
                    document.github_branch or "main"
                )
            except Exception as e:
                logger.warning(f"Failed to get remote content for document {document.id}: {e}")
                # Mark as error but don't fail the sync
                document.github_sync_status = "error"
                document.last_github_sync_at = datetime.utcnow()
                return False

            # Check if content has changed
            if remote_sha == document.github_sha:
                # No changes, just update sync time
                document.last_github_sync_at = datetime.utcnow()
                logger.debug(f"Document {document.id} is up to date")
                return True

            # Content has changed - check for conflicts
            if document.github_sync_status == "local_changes":
                # Local changes exist - this is a conflict
                document.github_sync_status = "conflict"
                document.last_github_sync_at = datetime.utcnow()
                logger.info(f"Document {document.id} has conflict - local changes with remote updates")
                return True  # Still "successful" in terms of checking

            # No local changes, safe to update
            success = await sync_service.pull_document_changes(
                document.id,
                document.user_id,
                remote_content,
                remote_sha
            )

            if success:
                document.github_sync_status = "synced"
                document.last_github_sync_at = datetime.utcnow()
                logger.info(f"Document {document.id} synced successfully")
                return True
            else:
                document.github_sync_status = "error"
                document.last_github_sync_at = datetime.utcnow()
                logger.error(f"Failed to sync document {document.id}")
                return False

        except Exception as e:
            logger.error(f"Error syncing document {document.id}: {e}")
            document.github_sync_status = "error"
            document.last_github_sync_at = datetime.utcnow()
            return False

    async def sync_specific_document(self, document_id: int) -> bool:
        """Sync a specific document immediately."""
        async with AsyncSessionLocal() as db:
            try:
                # Get the document
                doc_query = select(Document).where(Document.id == document_id)
                doc_result = await db.execute(doc_query)
                document = doc_result.scalar_one_or_none()

                if not document:
                    logger.warning(f"Document {document_id} not found")
                    return False

                success = await self._sync_single_document(db, document)
                await db.commit()
                return success

            except Exception as e:
                logger.error(f"Failed to sync document {document_id}: {e}")
                await db.rollback()
                return False

    async def force_sync_all_documents(self) -> Dict[str, int]:
        """Force sync all GitHub documents immediately."""
        stats = {
            "checked": 0,
            "updated": 0,
            "errors": 0
        }

        async with AsyncSessionLocal() as db:
            try:
                # Get all GitHub documents
                query = select(Document).where(Document.github_repository_id.isnot(None))
                result = await db.execute(query)
                documents = list(result.scalars().all())

                stats["checked"] = len(documents)

                for document in documents:
                    try:
                        success = await self._sync_single_document(db, document)
                        if success:
                            stats["updated"] += 1
                        else:
                            stats["errors"] += 1
                    except Exception as e:
                        logger.error(f"Failed to sync document {document.id}: {e}")
                        stats["errors"] += 1

                await db.commit()
                logger.info(f"Force sync completed: {stats}")

            except Exception as e:
                logger.error(f"Force sync failed: {e}")
                await db.rollback()
                stats["errors"] += 1

        return stats

    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync service status."""
        return {
            "running": self.running,
            "sync_interval": self.sync_interval,
            "max_documents_per_run": self.max_documents_per_run,
            "task_running": self._task is not None and not self._task.done()
        }


# Global background sync service
github_background_sync = GitHubBackgroundService()

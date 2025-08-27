"""CRUD operations for GitHub integration models."""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.github_models import GitHubAccount, GitHubRepository, GitHubSyncHistory


class GitHubCRUD:
    """CRUD operations for GitHub integration."""

    # GitHub Account operations
    async def create_account(
        self, db: AsyncSession, account_data: Dict
    ) -> GitHubAccount:
        """Create a new GitHub account."""
        account = GitHubAccount(**account_data)
        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account

    async def get_account(self, db: AsyncSession, account_id: int) -> Optional[GitHubAccount]:
        """Get GitHub account by ID."""
        result = await db.execute(
            select(GitHubAccount).where(GitHubAccount.id == account_id)
        )
        return result.scalar_one_or_none()

    async def get_account_by_github_id(
        self, db: AsyncSession, github_id: int
    ) -> Optional[GitHubAccount]:
        """Get GitHub account by GitHub user ID."""
        result = await db.execute(
            select(GitHubAccount).where(GitHubAccount.github_id == github_id)
        )
        return result.scalar_one_or_none()

    async def get_user_accounts(
        self, db: AsyncSession, user_id: int
    ) -> List[GitHubAccount]:
        """Get all GitHub accounts for a user."""
        result = await db.execute(
            select(GitHubAccount)
            .where(GitHubAccount.user_id == user_id)
            .options(selectinload(GitHubAccount.repositories))
        )
        return list(result.scalars().all())

    async def update_account(
        self, db: AsyncSession, account_id: int, account_data: Dict
    ) -> Optional[GitHubAccount]:
        """Update GitHub account."""
        account = await self.get_account(db, account_id)
        if not account:
            return None

        for field, value in account_data.items():
            if hasattr(account, field):
                setattr(account, field, value)

        account.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(account)
        return account

    async def delete_account(self, db: AsyncSession, account_id: int) -> bool:
        """Delete GitHub account."""
        account = await self.get_account(db, account_id)
        if not account:
            return False

        await db.delete(account)
        await db.commit()
        return True

    # GitHub Repository operations
    async def create_repository(
        self, db: AsyncSession, repo_data: Dict
    ) -> GitHubRepository:
        """Create a new GitHub repository."""
        repository = GitHubRepository(**repo_data)
        db.add(repository)
        await db.commit()
        await db.refresh(repository)
        return repository

    async def get_repository(
        self, db: AsyncSession, repo_id: int
    ) -> Optional[GitHubRepository]:
        """Get GitHub repository by ID."""
        result = await db.execute(
            select(GitHubRepository)
            .where(GitHubRepository.id == repo_id)
            .options(selectinload(GitHubRepository.account))
        )
        return result.scalar_one_or_none()

    async def get_repository_by_github_id(
        self, db: AsyncSession, github_repo_id: int
    ) -> Optional[GitHubRepository]:
        """Get GitHub repository by GitHub repository ID."""
        result = await db.execute(
            select(GitHubRepository).where(
                GitHubRepository.github_repo_id == github_repo_id
            )
        )
        return result.scalar_one_or_none()

    async def get_account_repositories(
        self, db: AsyncSession, account_id: int
    ) -> List[GitHubRepository]:
        """Get all repositories for a GitHub account."""
        result = await db.execute(
            select(GitHubRepository)
            .where(GitHubRepository.account_id == account_id)
            .options(selectinload(GitHubRepository.account))
        )
        return list(result.scalars().all())

    async def update_repository(
        self, db: AsyncSession, repo_id: int, repo_data: Dict
    ) -> Optional[GitHubRepository]:
        """Update GitHub repository."""
        repository = await self.get_repository(db, repo_id)
        if not repository:
            return None

        for field, value in repo_data.items():
            if hasattr(repository, field):
                setattr(repository, field, value)

        repository.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(repository)
        return repository

    async def delete_repository(self, db: AsyncSession, repo_id: int) -> bool:
        """Delete GitHub repository."""
        repository = await self.get_repository(db, repo_id)
        if not repository:
            return False

        await db.delete(repository)
        await db.commit()
        return True

    # GitHub Sync History operations
    async def create_sync_history(
        self, db: AsyncSession, sync_data: Dict
    ) -> GitHubSyncHistory:
        """Create a new sync history entry."""
        sync_history = GitHubSyncHistory(**sync_data)
        db.add(sync_history)
        await db.commit()
        await db.refresh(sync_history)
        return sync_history

    async def get_repository_sync_history(
        self, db: AsyncSession, repo_id: int, limit: int = 50
    ) -> List[GitHubSyncHistory]:
        """Get sync history for a repository."""
        result = await db.execute(
            select(GitHubSyncHistory)
            .where(GitHubSyncHistory.repository_id == repo_id)
            .order_by(GitHubSyncHistory.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_document_sync_history(
        self, db: AsyncSession, document_id: int, limit: int = 10
    ) -> List[GitHubSyncHistory]:
        """Get sync history for a document."""
        result = await db.execute(
            select(GitHubSyncHistory)
            .where(GitHubSyncHistory.document_id == document_id)
            .order_by(GitHubSyncHistory.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

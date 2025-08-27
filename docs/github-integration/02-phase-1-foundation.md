# Phase 1: Foundation - GitHub Integration

## Overview

Phase 1 establishes the foundational components for GitHub integration, focusing on OAuth authentication, basic repository browsing, and database schema implementation. This phase provides read-only access to GitHub files and sets up the infrastructure for future commit capabilities.

## Objectives

1. **OAuth Integration**: Implement secure GitHub authentication with proper scope management
2. **Database Foundation**: Create comprehensive database schema for GitHub data
3. **Account Management**: Provide UI for connecting and managing GitHub accounts
4. **Repository Discovery**: Enable browsing of accessible repositories and organizations
5. **File Import**: Allow importing GitHub markdown files as local documents
6. **Basic UI Components**: Create foundational GitHub-related UI components

## Database Schema Implementation

### 1. GitHubAccount Model

**File**: `backend/app/models/github_account.py`

```python
from __future__ import annotations

"""GitHub Account model for OAuth integration."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, BigInteger, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .github_repository import GitHubRepository


class GitHubAccount(BaseModel):
    """GitHub Account model for storing OAuth credentials and account info."""

    __tablename__ = "github_accounts"

    # Foreign key to user
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # GitHub account information
    github_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # OAuth tokens (will be encrypted)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scopes: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="github_accounts")
    repositories: Mapped[list["GitHubRepository"]] = relationship(
        "GitHubRepository", back_populates="github_account", cascade="all, delete-orphan"
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("user_id", "github_user_id", name="uq_user_github_account"),
    )

    def __repr__(self) -> str:
        return f"<GitHubAccount(id={self.id}, username='{self.username}', user_id={self.user_id})>"
```

### 2. GitHubRepository Model

**File**: `backend/app/models/github_repository.py`

```python
from __future__ import annotations

"""GitHub Repository model."""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, BigInteger, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import BaseModel

if TYPE_CHECKING:
    from .github_account import GitHubAccount
    from .document import Document


class GitHubRepository(BaseModel):
    """GitHub Repository model for tracking enabled repositories."""

    __tablename__ = "github_repositories"

    # Foreign key to GitHub account
    github_account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("github_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # GitHub repository information
    github_repo_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    full_name: Mapped[str] = mapped_column(String(500), nullable=False)  # owner/repo
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_branch: Mapped[str] = mapped_column(String(100), default="main", nullable=False)

    # User settings
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sync_settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    github_account: Mapped["GitHubAccount"] = relationship("GitHubAccount", back_populates="repositories")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="github_repository")

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("github_account_id", "github_repo_id", name="uq_account_repo"),
    )

    def __repr__(self) -> str:
        return f"<GitHubRepository(id={self.id}, full_name='{self.full_name}')>"
```

### 3. Enhanced Document Model

**File**: `backend/app/models/document.py` (modifications)

```python
# Add to existing imports
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Boolean, DateTime

if TYPE_CHECKING:
    from .github_repository import GitHubRepository

# Add new fields to existing Document class
class Document(Base):
    # ... existing fields ...

    # GitHub integration fields
    source_type: Mapped[str] = mapped_column(
        String(20), default="local", nullable=False
    )  # 'local', 'github'

    github_repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("github_repositories.id"), nullable=True, index=True
    )
    github_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    local_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sync_status: Mapped[str] = mapped_column(
        String(20), default="synced", nullable=False
    )  # 'synced', 'local_changes', 'remote_changes', 'conflict'
    last_github_sync: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    github_commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # New relationship
    github_repository: Mapped["GitHubRepository | None"] = relationship(
        "GitHubRepository", back_populates="documents"
    )
```

### 4. Enhanced User Model

**File**: `backend/app/models/user.py` (modifications)

```python
# Add to existing User class
class User(BaseModel):
    # ... existing fields ...

    # GitHub accounts relationship
    github_accounts: Mapped[list["GitHubAccount"]] = relationship(
        "GitHubAccount", back_populates="user", cascade="all, delete-orphan"
    )
```

### 5. Database Migration

**File**: `backend/migrations/versions/XXX_add_github_integration.py`

```python
"""Add GitHub integration tables

Revision ID: github_integration_001
Revises: previous_revision
Create Date: 2025-08-26 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'github_integration_001'
down_revision = 'previous_revision'  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade():
    # Create github_accounts table
    op.create_table('github_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('github_user_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('scopes', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'github_user_id', name='uq_user_github_account')
    )

    # Create indexes
    op.create_index(op.f('ix_github_accounts_user_id'), 'github_accounts', ['user_id'], unique=False)

    # Create github_repositories table
    op.create_table('github_repositories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('github_account_id', sa.Integer(), nullable=False),
        sa.Column('github_repo_id', sa.BigInteger(), nullable=False),
        sa.Column('full_name', sa.String(length=500), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_private', sa.Boolean(), nullable=False, default=False),
        sa.Column('default_branch', sa.String(length=100), nullable=False, default='main'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('sync_settings', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['github_account_id'], ['github_accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('github_account_id', 'github_repo_id', name='uq_account_repo')
    )

    # Create indexes
    op.create_index(op.f('ix_github_repositories_github_account_id'), 'github_repositories', ['github_account_id'], unique=False)

    # Add GitHub fields to documents table
    op.add_column('documents', sa.Column('source_type', sa.String(length=20), nullable=False, default='local'))
    op.add_column('documents', sa.Column('github_repository_id', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('github_file_path', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('github_branch', sa.String(length=100), nullable=True))
    op.add_column('documents', sa.Column('github_sha', sa.String(length=40), nullable=True))
    op.add_column('documents', sa.Column('local_sha', sa.String(length=40), nullable=True))
    op.add_column('documents', sa.Column('sync_status', sa.String(length=20), nullable=False, default='synced'))
    op.add_column('documents', sa.Column('last_github_sync', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('github_commit_message', sa.Text(), nullable=True))

    # Create foreign key constraint
    op.create_foreign_key('fk_documents_github_repository', 'documents', 'github_repositories', ['github_repository_id'], ['id'])

    # Create index
    op.create_index(op.f('ix_documents_github_repository_id'), 'documents', ['github_repository_id'], unique=False)


def downgrade():
    # Remove GitHub fields from documents
    op.drop_index(op.f('ix_documents_github_repository_id'), table_name='documents')
    op.drop_constraint('fk_documents_github_repository', 'documents', type_='foreignkey')
    op.drop_column('documents', 'github_commit_message')
    op.drop_column('documents', 'last_github_sync')
    op.drop_column('documents', 'sync_status')
    op.drop_column('documents', 'local_sha')
    op.drop_column('documents', 'github_sha')
    op.drop_column('documents', 'github_branch')
    op.drop_column('documents', 'github_file_path')
    op.drop_column('documents', 'github_repository_id')
    op.drop_column('documents', 'source_type')

    # Drop github_repositories table
    op.drop_index(op.f('ix_github_repositories_github_account_id'), table_name='github_repositories')
    op.drop_table('github_repositories')

    # Drop github_accounts table
    op.drop_index(op.f('ix_github_accounts_user_id'), table_name='github_accounts')
    op.drop_table('github_accounts')
```

## Backend API Implementation

### 1. GitHub OAuth Configuration

**File**: `backend/app/configs/settings.py` (additions)

```python
# Add to existing settings class
class Settings(BaseSettings):
    # ... existing settings ...

    # GitHub OAuth settings
    github_client_id: str = Field(..., env="GITHUB_CLIENT_ID")
    github_client_secret: str = Field(..., env="GITHUB_CLIENT_SECRET")
    github_oauth_redirect_uri: str = Field(..., env="GITHUB_OAUTH_REDIRECT_URI")
    github_oauth_scope: str = Field(default="repo,user:email", env="GITHUB_OAUTH_SCOPE")
```

### 2. GitHub Service Layer

**File**: `backend/app/services/github_service.py`

```python
"""GitHub API service for OAuth and repository operations."""
import asyncio
import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import aiohttp
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.configs import settings
from app.crud import github_account as crud_github_account
from app.crud import github_repository as crud_github_repository
from app.models.github_account import GitHubAccount
from app.models.github_repository import GitHubRepository
from app.models.user import User
from app.core.security import encrypt_token, decrypt_token


class GitHubService:
    """Service for GitHub API operations."""

    BASE_URL = "https://api.github.com"
    OAUTH_URL = "https://github.com/login/oauth"

    def __init__(self):
        self.client_id = settings.github_client_id
        self.client_secret = settings.github_client_secret
        self.redirect_uri = settings.github_oauth_redirect_uri
        self.scope = settings.github_oauth_scope

    async def get_oauth_url(self, state: str) -> str:
        """Generate OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scope,
            "state": state,
            "response_type": "code"
        }
        return f"{self.OAUTH_URL}/authorize?{urlencode(params)}"

    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Exchange OAuth code for access token."""
        async with aiohttp.ClientSession() as session:
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": self.redirect_uri
            }

            headers = {"Accept": "application/json"}

            async with session.post(
                f"{self.OAUTH_URL}/access_token",
                data=data,
                headers=headers
            ) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to exchange code for token"
                    )

                result = await response.json()

                if "error" in result:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"OAuth error: {result.get('error_description', result['error'])}"
                    )

                return result

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get GitHub user information."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.BASE_URL}/user", headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get user information"
                    )

                return await response.json()

    async def get_user_repositories(
        self,
        access_token: str,
        page: int = 1,
        per_page: int = 100
    ) -> List[Dict[str, Any]]:
        """Get user's repositories."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        params = {
            "sort": "updated",
            "direction": "desc",
            "page": page,
            "per_page": per_page
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.BASE_URL}/user/repos",
                headers=headers,
                params=params
            ) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get repositories"
                    )

                return await response.json()

    async def get_organizations(self, access_token: str) -> List[Dict[str, Any]]:
        """Get user's organizations."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.BASE_URL}/user/orgs", headers=headers) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get organizations"
                    )

                return await response.json()

    async def get_repository_contents(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str = "",
        ref: str = None
    ) -> List[Dict[str, Any]]:
        """Get repository contents (files and directories)."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        params = {}
        if ref:
            params["ref"] = ref

        url = f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get repository contents"
                    )

                return await response.json()

    async def get_file_content(
        self,
        access_token: str,
        owner: str,
        repo: str,
        path: str,
        ref: str = None
    ) -> Dict[str, Any]:
        """Get file content from repository."""
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }

        params = {}
        if ref:
            params["ref"] = ref

        url = f"{self.BASE_URL}/repos/{owner}/{repo}/contents/{path}"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to get file content"
                    )

                file_data = await response.json()

                # Decode base64 content
                if file_data.get("encoding") == "base64":
                    content = base64.b64decode(file_data["content"]).decode("utf-8")
                    file_data["decoded_content"] = content

                return file_data

    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for comparison."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    async def create_github_account(
        self,
        db: AsyncSession,
        user: User,
        access_token: str,
        github_user_data: Dict[str, Any]
    ) -> GitHubAccount:
        """Create or update GitHub account record."""
        # Encrypt the access token
        encrypted_token = encrypt_token(access_token)

        account_data = {
            "user_id": user.id,
            "github_user_id": github_user_data["id"],
            "username": github_user_data["login"],
            "display_name": github_user_data.get("name"),
            "avatar_url": github_user_data.get("avatar_url"),
            "access_token": encrypted_token,
            "scopes": self.scope.split(","),
            "is_active": True
        }

        # Check if account already exists
        existing_account = await crud_github_account.get_by_github_user_id(
            db, user_id=user.id, github_user_id=github_user_data["id"]
        )

        if existing_account:
            # Update existing account
            for key, value in account_data.items():
                setattr(existing_account, key, value)
            await db.commit()
            await db.refresh(existing_account)
            return existing_account
        else:
            # Create new account
            return await crud_github_account.create(db, obj_in=account_data)

    async def sync_repositories(
        self,
        db: AsyncSession,
        github_account: GitHubAccount
    ) -> List[GitHubRepository]:
        """Sync repositories for a GitHub account."""
        decrypted_token = decrypt_token(github_account.access_token)

        # Get repositories
        repos = await self.get_user_repositories(decrypted_token)

        synced_repos = []
        for repo_data in repos:
            repo_info = {
                "github_account_id": github_account.id,
                "github_repo_id": repo_data["id"],
                "full_name": repo_data["full_name"],
                "name": repo_data["name"],
                "description": repo_data.get("description"),
                "is_private": repo_data["private"],
                "default_branch": repo_data["default_branch"]
            }

            # Check if repository already exists
            existing_repo = await crud_github_repository.get_by_github_repo_id(
                db, github_account_id=github_account.id, github_repo_id=repo_data["id"]
            )

            if existing_repo:
                # Update existing repository
                for key, value in repo_info.items():
                    setattr(existing_repo, key, value)
                synced_repos.append(existing_repo)
            else:
                # Create new repository
                new_repo = await crud_github_repository.create(db, obj_in=repo_info)
                synced_repos.append(new_repo)

        await db.commit()
        return synced_repos


# Global service instance
github_service = GitHubService()
```

### 3. CRUD Operations

**File**: `backend/app/crud/github_account.py`

```python
"""CRUD operations for GitHub accounts."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.github_account import GitHubAccount
from app.schemas.github import GitHubAccountCreate, GitHubAccountUpdate


class CRUDGitHubAccount(CRUDBase[GitHubAccount, GitHubAccountCreate, GitHubAccountUpdate]):
    """CRUD operations for GitHub accounts."""

    async def get_by_user_id(
        self, db: AsyncSession, *, user_id: int
    ) -> List[GitHubAccount]:
        """Get all GitHub accounts for a user."""
        stmt = select(self.model).where(
            self.model.user_id == user_id,
            self.model.is_active == True
        ).options(selectinload(self.model.repositories))

        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_by_github_user_id(
        self, db: AsyncSession, *, user_id: int, github_user_id: int
    ) -> Optional[GitHubAccount]:
        """Get GitHub account by user_id and github_user_id."""
        stmt = select(self.model).where(
            self.model.user_id == user_id,
            self.model.github_user_id == github_user_id
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def deactivate(
        self, db: AsyncSession, *, account_id: int, user_id: int
    ) -> Optional[GitHubAccount]:
        """Deactivate a GitHub account."""
        stmt = select(self.model).where(
            self.model.id == account_id,
            self.model.user_id == user_id
        )

        result = await db.execute(stmt)
        account = result.scalar_one_or_none()

        if account:
            account.is_active = False
            await db.commit()
            await db.refresh(account)

        return account


github_account = CRUDGitHubAccount(GitHubAccount)
```

**File**: `backend/app/crud/github_repository.py`

```python
"""CRUD operations for GitHub repositories."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.github_repository import GitHubRepository
from app.schemas.github import GitHubRepositoryCreate, GitHubRepositoryUpdate


class CRUDGitHubRepository(CRUDBase[GitHubRepository, GitHubRepositoryCreate, GitHubRepositoryUpdate]):
    """CRUD operations for GitHub repositories."""

    async def get_by_github_repo_id(
        self, db: AsyncSession, *, github_account_id: int, github_repo_id: int
    ) -> Optional[GitHubRepository]:
        """Get repository by GitHub account and repo ID."""
        stmt = select(self.model).where(
            self.model.github_account_id == github_account_id,
            self.model.github_repo_id == github_repo_id
        )

        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_enabled_by_account(
        self, db: AsyncSession, *, github_account_id: int
    ) -> List[GitHubRepository]:
        """Get all enabled repositories for a GitHub account."""
        stmt = select(self.model).where(
            self.model.github_account_id == github_account_id,
            self.model.is_enabled == True
        ).order_by(self.model.name)

        result = await db.execute(stmt)
        return result.scalars().all()

    async def toggle_enabled(
        self, db: AsyncSession, *, repo_id: int, enabled: bool
    ) -> Optional[GitHubRepository]:
        """Enable or disable a repository."""
        stmt = select(self.model).where(self.model.id == repo_id)

        result = await db.execute(stmt)
        repo = result.scalar_one_or_none()

        if repo:
            repo.is_enabled = enabled
            await db.commit()
            await db.refresh(repo)

        return repo


github_repository = CRUDGitHubRepository(GitHubRepository)
```

### 4. API Schemas

**File**: `backend/app/schemas/github.py`

```python
"""Pydantic schemas for GitHub integration."""
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


# GitHub Account schemas
class GitHubAccountBase(BaseModel):
    """Base GitHub account schema."""
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True


class GitHubAccountCreate(GitHubAccountBase):
    """Schema for creating GitHub account."""
    user_id: int
    github_user_id: int
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None


class GitHubAccountUpdate(BaseModel):
    """Schema for updating GitHub account."""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None
    is_active: Optional[bool] = None


class GitHubAccountResponse(GitHubAccountBase):
    """Schema for GitHub account response."""
    id: int
    github_user_id: int
    created_at: datetime
    updated_at: datetime
    # Note: We never return tokens in responses

    class Config:
        from_attributes = True


# GitHub Repository schemas
class GitHubRepositoryBase(BaseModel):
    """Base GitHub repository schema."""
    github_repo_id: int
    full_name: str
    name: str
    description: Optional[str] = None
    is_private: bool = False
    default_branch: str = "main"
    is_enabled: bool = True


class GitHubRepositoryCreate(GitHubRepositoryBase):
    """Schema for creating GitHub repository."""
    github_account_id: int
    sync_settings: Optional[Dict[str, Any]] = None


class GitHubRepositoryUpdate(BaseModel):
    """Schema for updating GitHub repository."""
    description: Optional[str] = None
    default_branch: Optional[str] = None
    is_enabled: Optional[bool] = None
    sync_settings: Optional[Dict[str, Any]] = None


class GitHubRepositoryResponse(GitHubRepositoryBase):
    """Schema for GitHub repository response."""
    id: int
    github_account_id: int
    sync_settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# OAuth schemas
class GitHubOAuthInitiate(BaseModel):
    """Schema for OAuth initiation response."""
    authorization_url: str
    state: str


class GitHubOAuthCallback(BaseModel):
    """Schema for OAuth callback."""
    code: str
    state: str


class GitHubOAuthComplete(BaseModel):
    """Schema for OAuth completion response."""
    account: GitHubAccountResponse
    repositories_synced: int


# File and content schemas
class GitHubFileInfo(BaseModel):
    """Schema for GitHub file information."""
    name: str
    path: str
    sha: str
    size: int
    type: str  # 'file' or 'dir'
    download_url: Optional[str] = None


class GitHubFileContent(BaseModel):
    """Schema for GitHub file content."""
    name: str
    path: str
    sha: str
    size: int
    content: str
    encoding: str = "base64"
    decoded_content: Optional[str] = None


class GitHubBranch(BaseModel):
    """Schema for GitHub branch."""
    name: str
    sha: str
    is_default: bool = False


# Import schemas
class GitHubImportRequest(BaseModel):
    """Schema for importing GitHub file."""
    repository_id: int
    file_path: str
    branch: str = "main"
    category_id: int
    import_mode: str = Field(..., regex="^(new|copy|link)$")
    new_name: Optional[str] = None  # For copy mode


class GitHubImportResponse(BaseModel):
    """Schema for import response."""
    document_id: int
    message: str
    sync_status: str
```

## API Endpoints Implementation

### 1. GitHub OAuth Router

**File**: `backend/app/routers/github_oauth.py`

```python
"""GitHub OAuth endpoints."""
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubOAuthCallback,
    GitHubOAuthComplete,
    GitHubOAuthInitiate
)
from app.services.github_service import github_service

router = APIRouter()


@router.post("/initiate", response_model=GitHubOAuthInitiate)
async def initiate_github_oauth(
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """Initiate GitHub OAuth flow."""
    # Generate a secure state parameter
    state = secrets.token_urlsafe(32)

    # Store state in session/cache (implementation depends on your session management)
    # For now, we'll return it and validate it in the callback

    authorization_url = await github_service.get_oauth_url(state)

    return GitHubOAuthInitiate(
        authorization_url=authorization_url,
        state=state
    )


@router.post("/callback", response_model=GitHubOAuthComplete)
async def github_oauth_callback(
    callback_data: GitHubOAuthCallback,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Handle GitHub OAuth callback."""
    # Validate state parameter (in production, check against stored state)
    if not callback_data.state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )

    try:
        # Exchange code for access token
        token_data = await github_service.exchange_code_for_token(callback_data.code)
        access_token = token_data["access_token"]

        # Get GitHub user information
        github_user_data = await github_service.get_user_info(access_token)

        # Create or update GitHub account
        github_account = await github_service.create_github_account(
            db, current_user, access_token, github_user_data
        )

        # Sync repositories
        repositories = await github_service.sync_repositories(db, github_account)

        return GitHubOAuthComplete(
            account=github_account,
            repositories_synced=len(repositories)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: {str(e)}"
        )
```

### 2. GitHub Accounts Router

**File**: `backend/app/routers/github_accounts.py`

```python
"""GitHub accounts management endpoints."""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import github_account as crud_github_account
from app.database import get_db
from app.models.user import User
from app.schemas.github import GitHubAccountResponse
from app.services.github_service import github_service

router = APIRouter()


@router.get("/", response_model=List[GitHubAccountResponse])
async def get_github_accounts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get all GitHub accounts for current user."""
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    return accounts


@router.delete("/{account_id}")
async def disconnect_github_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Disconnect a GitHub account."""
    account = await crud_github_account.deactivate(
        db, account_id=account_id, user_id=current_user.id
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    return {"message": "GitHub account disconnected successfully"}


@router.post("/{account_id}/refresh")
async def refresh_github_repositories(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Refresh repositories for a GitHub account."""
    # Get the account
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    # Sync repositories
    repositories = await github_service.sync_repositories(db, account)

    return {
        "message": "Repositories refreshed successfully",
        "repositories_synced": len(repositories)
    }
```

### 3. GitHub Repositories Router

**File**: `backend/app/routers/github_repositories.py`

```python
"""GitHub repositories management endpoints."""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import github_account as crud_github_account
from app.crud import github_repository as crud_github_repository
from app.database import get_db
from app.models.user import User
from app.schemas.github import (
    GitHubRepositoryResponse,
    GitHubFileInfo,
    GitHubBranch,
    GitHubFileContent
)
from app.services.github_service import github_service
from app.core.security import decrypt_token

router = APIRouter()


@router.get("/account/{account_id}", response_model=List[GitHubRepositoryResponse])
async def get_repositories_by_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get repositories for a specific GitHub account."""
    # Verify account belongs to user
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub account not found"
        )

    repositories = await crud_github_repository.get_enabled_by_account(
        db, github_account_id=account_id
    )

    return repositories


@router.patch("/{repo_id}/toggle")
async def toggle_repository_enabled(
    repo_id: int,
    enabled: bool,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Enable or disable a repository."""
    # TODO: Add verification that repo belongs to user's account
    repository = await crud_github_repository.toggle_enabled(
        db, repo_id=repo_id, enabled=enabled
    )

    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    return {
        "message": f"Repository {'enabled' if enabled else 'disabled'} successfully",
        "repository": repository
    }


@router.get("/{repo_id}/branches", response_model=List[GitHubBranch])
async def get_repository_branches(
    repo_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get branches for a repository."""
    # Get repository with account
    repository = await crud_github_repository.get(db, id=repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify access through account ownership
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get branches from GitHub API
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)

    # For now, return main branch (implement full branch listing in Phase 2)
    return [
        GitHubBranch(
            name=repository.default_branch,
            sha="",  # Will be populated when needed
            is_default=True
        )
    ]


@router.get("/{repo_id}/files", response_model=List[GitHubFileInfo])
async def get_repository_files(
    repo_id: int,
    path: str = "",
    branch: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get files in a repository path."""
    # Get repository and verify access
    repository = await crud_github_repository.get(db, id=repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify access
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get files from GitHub API
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)
    branch = branch or repository.default_branch

    contents = await github_service.get_repository_contents(
        access_token, owner, repo_name, path, branch
    )

    # Filter for markdown files and directories
    markdown_extensions = {'.md', '.markdown', '.mdown', '.mkd', '.mkdn'}

    filtered_contents = []
    for item in contents:
        if item["type"] == "dir":
            filtered_contents.append(GitHubFileInfo(
                name=item["name"],
                path=item["path"],
                sha=item["sha"],
                size=item["size"],
                type="dir"
            ))
        elif item["type"] == "file":
            file_ext = "." + item["name"].split(".")[-1].lower()
            if file_ext in markdown_extensions:
                filtered_contents.append(GitHubFileInfo(
                    name=item["name"],
                    path=item["path"],
                    sha=item["sha"],
                    size=item["size"],
                    type="file",
                    download_url=item.get("download_url")
                ))

    return filtered_contents


@router.get("/{repo_id}/file-content", response_model=GitHubFileContent)
async def get_file_content(
    repo_id: int,
    file_path: str,
    branch: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get content of a specific file."""
    # Get repository and verify access
    repository = await crud_github_repository.get(db, id=repo_id)
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )

    # Verify access
    accounts = await crud_github_account.get_by_user_id(db, user_id=current_user.id)
    account = next((acc for acc in accounts if acc.id == repository.github_account_id), None)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this repository"
        )

    # Get file content from GitHub API
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)
    branch = branch or repository.default_branch

    file_data = await github_service.get_file_content(
        access_token, owner, repo_name, file_path, branch
    )

    return GitHubFileContent(
        name=file_data["name"],
        path=file_data["path"],
        sha=file_data["sha"],
        size=file_data["size"],
        content=file_data["content"],
        encoding=file_data["encoding"],
        decoded_content=file_data.get("decoded_content")
    )
```

### 4. GitHub Import Router

**File**: `backend/app/routers/github_import.py`

```python
"""GitHub file import endpoints."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.crud import document as crud_document
from app.crud import github_account as crud_github_account
from app.crud import github_repository as crud_github_repository
from app.database import get_db
from app.models.user import User
from app.schemas.github import GitHubImportRequest, GitHubImportResponse
from app.services.github_service import github_service
from app.core.security import decrypt_token

router = APIRouter()


@router.post("/import", response_model=GitHubImportResponse)
async def import_github_file(
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Import a GitHub file as a local document."""

    # Get and verify repository access
    repository = await crud_github_repository.get(db, id=import_request.repository_id)
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

    # Get file content from GitHub
    access_token = decrypt_token(account.access_token)
    owner, repo_name = repository.full_name.split("/", 1)

    file_data = await github_service.get_file_content(
        access_token, owner, repo_name, import_request.file_path, import_request.branch
    )

    if not file_data.get("decoded_content"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to decode file content"
        )

    # Determine document name
    if import_request.import_mode == "copy" and import_request.new_name:
        doc_name = import_request.new_name
    else:
        doc_name = file_data["name"].rsplit(".", 1)[0]  # Remove extension

    # Check for existing document with same name (for link mode)
    existing_doc = None
    if import_request.import_mode == "link":
        existing_docs = await crud_document.get_by_user_and_name(
            db, user_id=current_user.id, name=doc_name
        )
        if existing_docs:
            existing_doc = existing_docs[0]

    # Generate content hash
    content_hash = github_service.generate_content_hash(file_data["decoded_content"])

    # Create or update document
    if existing_doc and import_request.import_mode == "link":
        # Update existing document
        existing_doc.content = file_data["decoded_content"]
        existing_doc.source_type = "github"
        existing_doc.github_repository_id = repository.id
        existing_doc.github_file_path = import_request.file_path
        existing_doc.github_branch = import_request.branch
        existing_doc.github_sha = file_data["sha"]
        existing_doc.local_sha = content_hash
        existing_doc.sync_status = "synced"

        await db.commit()
        await db.refresh(existing_doc)

        return GitHubImportResponse(
            document_id=existing_doc.id,
            message=f"Linked existing document '{doc_name}' to GitHub file",
            sync_status="synced"
        )
    else:
        # Create new document
        document_data = {
            "name": doc_name,
            "content": file_data["decoded_content"],
            "user_id": current_user.id,
            "category_id": import_request.category_id,
            "source_type": "github",
            "github_repository_id": repository.id,
            "github_file_path": import_request.file_path,
            "github_branch": import_request.branch,
            "github_sha": file_data["sha"],
            "local_sha": content_hash,
            "sync_status": "synced"
        }

        new_document = await crud_document.create(db, obj_in=document_data)

        return GitHubImportResponse(
            document_id=new_document.id,
            message=f"Imported GitHub file as new document '{doc_name}'",
            sync_status="synced"
        )
```

### 5. Main Router Integration

**File**: `backend/app/routers/__init__.py` (additions)

```python
"""Router modules for the FastAPI application."""

# Import existing routers
from .auth import router as auth_router
from .documents import router as documents_router
# ... other existing routers

# Import new GitHub routers
from .github_oauth import router as github_oauth_router
from .github_accounts import router as github_accounts_router
from .github_repositories import router as github_repositories_router
from .github_import import router as github_import_router

__all__ = [
    "auth_router",
    "documents_router",
    # ... other existing routers
    "github_oauth_router",
    "github_accounts_router",
    "github_repositories_router",
    "github_import_router"
]
```

**File**: `backend/app/main.py` (additions)

```python
# Add to existing router includes
from app.routers import (
    # ... existing imports
    github_oauth_router,
    github_accounts_router,
    github_repositories_router,
    github_import_router
)

# Add GitHub router includes
app.include_router(
    github_oauth_router,
    prefix="/api/github/oauth",
    tags=["github-oauth"]
)
app.include_router(
    github_accounts_router,
    prefix="/api/github/accounts",
    tags=["github-accounts"]
)
app.include_router(
    github_repositories_router,
    prefix="/api/github/repositories",
    tags=["github-repositories"]
)
app.include_router(
    github_import_router,
    prefix="/api/github",
    tags=["github-import"]
)
```

## Security Implementation

### 1. Token Encryption Service

**File**: `backend/app/core/security.py` (additions)

```python
"""Security utilities including token encryption."""
import base64
from cryptography.fernet import Fernet
from app.configs import settings

# Generate or load encryption key (store securely in production)
def get_encryption_key():
    """Get encryption key for token storage."""
    if hasattr(settings, 'token_encryption_key'):
        return settings.token_encryption_key.encode()
    else:
        # Generate a key (store this securely in production!)
        return Fernet.generate_key()

_fernet = Fernet(get_encryption_key())

def encrypt_token(token: str) -> str:
    """Encrypt a token for database storage."""
    return base64.urlsafe_b64encode(_fernet.encrypt(token.encode())).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token from database storage."""
    return _fernet.decrypt(base64.urlsafe_b64decode(encrypted_token.encode())).decode()
```

### 2. Environment Variables

**File**: `backend/.env` (additions)

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/auth/github/callback
GITHUB_OAUTH_SCOPE=repo,user:email

# Token encryption key (generate and store securely)
TOKEN_ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

## Frontend Implementation

### 1. GitHub API Service

**File**: `frontend/src/api/githubApi.js`

```javascript
import { Api } from "./api.js";

class GitHubAPI extends Api {

  // OAuth flow
  async initiateOAuth() {
    const res = await this.apiCall("/github/oauth/initiate", "POST");
    return res.data;
  }

  async completeOAuth(code, state) {
    const res = await this.apiCall("/github/oauth/callback", "POST", {
      code,
      state
    });
    return res.data;
  }

  // Account management
  async getAccounts() {
    const res = await this.apiCall("/github/accounts/", "GET");
    return res.data;
  }

  async disconnectAccount(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}`, "DELETE");
    return res.data;
  }

  async refreshRepositories(accountId) {
    const res = await this.apiCall(`/github/accounts/${accountId}/refresh`, "POST");
    return res.data;
  }

  // Repository management
  async getRepositories(accountId) {
    const res = await this.apiCall(`/github/repositories/account/${accountId}`, "GET");
    return res.data;
  }

  async toggleRepository(repoId, enabled) {
    const res = await this.apiCall(`/github/repositories/${repoId}/toggle`, "PATCH", {
      enabled
    });
    return res.data;
  }

  async getRepositoryBranches(repoId) {
    const res = await this.apiCall(`/github/repositories/${repoId}/branches`, "GET");
    return res.data;
  }

  async getRepositoryFiles(repoId, path = "", branch = null) {
    const params = new URLSearchParams();
    if (path) params.append("path", path);
    if (branch) params.append("branch", branch);

    const queryString = params.toString();
    const endpoint = `/github/repositories/${repoId}/files${queryString ? `?${queryString}` : ""}`;

    const res = await this.apiCall(endpoint, "GET");
    return res.data;
  }

  async getFileContent(repoId, filePath, branch = null) {
    const params = new URLSearchParams();
    params.append("file_path", filePath);
    if (branch) params.append("branch", branch);

    const res = await this.apiCall(`/github/repositories/${repoId}/file-content?${params.toString()}`, "GET");
    return res.data;
  }

  // Import functionality
  async importFile(importRequest) {
    const res = await this.apiCall("/github/import", "POST", importRequest);
    return res.data;
  }
}

export const githubApi = new GitHubAPI();
```

### 2. GitHub Settings Component

**File**: `frontend/src/components/sections/GitHubSettings.jsx`

```jsx
import React, { useState, useEffect } from "react";
import { Card, Button, Alert, Badge, Spinner, ListGroup } from "react-bootstrap";
import { useNotification } from "@/components/NotificationProvider";
import { githubApi } from "@/api/githubApi";

export default function GitHubSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const accountsData = await githubApi.getAccounts();
      setAccounts(accountsData);
    } catch (error) {
      console.error("Failed to load GitHub accounts:", error);
      showError("Failed to load GitHub accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    setConnecting(true);
    try {
      const { authorization_url, state } = await githubApi.initiateOAuth();

      // Store state for validation
      localStorage.setItem('github_oauth_state', state);

      // Redirect to GitHub
      window.location.href = authorization_url;
    } catch (error) {
      console.error("Failed to initiate OAuth:", error);
      showError("Failed to connect to GitHub");
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId, username) => {
    if (!confirm(`Disconnect GitHub account "${username}"?`)) {
      return;
    }

    try {
      await githubApi.disconnectAccount(accountId);
      showSuccess(`Disconnected GitHub account "${username}"`);
      await loadAccounts();
    } catch (error) {
      console.error("Failed to disconnect account:", error);
      showError("Failed to disconnect GitHub account");
    }
  };

  const handleRefreshRepos = async (accountId, username) => {
    try {
      const result = await githubApi.refreshRepositories(accountId);
      showSuccess(`Refreshed ${result.repositories_synced} repositories for "${username}"`);
    } catch (error) {
      console.error("Failed to refresh repositories:", error);
      showError("Failed to refresh repositories");
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <h5 className="mb-0">GitHub Integration</h5>
        </Card.Header>
        <Card.Body className="text-center">
          <Spinner animation="border" size="sm" /> Loading GitHub accounts...
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">GitHub Integration</h5>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConnectGitHub}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Connecting...
            </>
          ) : (
            <>
              <i className="bi bi-github me-2"></i>
              Connect GitHub Account
            </>
          )}
        </Button>
      </Card.Header>
      <Card.Body>
        {accounts.length === 0 ? (
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            No GitHub accounts connected. Connect your GitHub account to import and sync markdown files from your repositories.
          </Alert>
        ) : (
          <ListGroup variant="flush">
            {accounts.map((account) => (
              <ListGroup.Item key={account.id} className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  {account.avatar_url && (
                    <img
                      src={account.avatar_url}
                      alt={account.username}
                      className="rounded-circle me-3"
                      style={{ width: 40, height: 40 }}
                    />
                  )}
                  <div>
                    <div className="fw-bold">{account.username}</div>
                    {account.display_name && (
                      <small className="text-muted">{account.display_name}</small>
                    )}
                    <div>
                      <Badge
                        bg={account.is_active ? "success" : "secondary"}
                        className="me-2"
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <small className="text-muted">
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => handleRefreshRepos(account.id, account.username)}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh Repos
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDisconnect(account.id, account.username)}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    Disconnect
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
}
```

### 3. GitHub OAuth Callback Handler

**File**: `frontend/src/components/GitHubOAuthCallback.jsx`

```jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Spinner, Alert, Card } from "react-bootstrap";
import { useNotification } from "@/components/NotificationProvider";
import { githubApi } from "@/api/githubApi";

export default function GitHubOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Processing GitHub connection...");
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        throw new Error(`GitHub OAuth error: ${error}`);
      }

      if (!code || !state) {
        throw new Error("Missing required OAuth parameters");
      }

      // Validate state
      const storedState = localStorage.getItem('github_oauth_state');
      if (state !== storedState) {
        throw new Error("Invalid OAuth state parameter");
      }

      // Complete OAuth flow
      const result = await githubApi.completeOAuth(code, state);

      setStatus("success");
      setMessage(`Successfully connected GitHub account "${result.account.username}" with ${result.repositories_synced} repositories.`);

      showSuccess(`Connected to GitHub as ${result.account.username}`);

      // Clean up
      localStorage.removeItem('github_oauth_state');

      // Redirect to settings after a short delay
      setTimeout(() => {
        navigate("/settings", { replace: true });
      }, 2000);

    } catch (error) {
      console.error("OAuth callback error:", error);
      setStatus("error");
      setMessage(error.message || "Failed to connect GitHub account");
      showError("Failed to connect GitHub account");

      // Clean up
      localStorage.removeItem('github_oauth_state');

      // Redirect to settings after a short delay
      setTimeout(() => {
        navigate("/settings", { replace: true });
      }, 3000);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <Card>
            <Card.Body className="text-center p-5">
              {status === "processing" && (
                <>
                  <Spinner animation="border" size="lg" className="mb-3" />
                  <h4>Connecting to GitHub</h4>
                  <p className="text-muted">{message}</p>
                </>
              )}

              {status === "success" && (
                <>
                  <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3rem" }}></i>
                  <h4 className="mt-3">Connection Successful!</h4>
                  <p className="text-muted">{message}</p>
                  <p><small>Redirecting to settings...</small></p>
                </>
              )}

              {status === "error" && (
                <>
                  <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: "3rem" }}></i>
                  <h4 className="mt-3">Connection Failed</h4>
                  <Alert variant="danger" className="mt-3">
                    {message}
                  </Alert>
                  <p><small>Redirecting to settings...</small></p>
                </>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

This completes the comprehensive Phase 1 implementation covering database schema, backend APIs, security, and frontend components for GitHub OAuth integration and basic repository browsing.

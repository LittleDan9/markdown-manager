---
applyTo: "backend/app/**/*"
description: "Phase 6: Backend Implementation - FastAPI endpoints, SQLAlchemy models, database schema, CRUD operations"
---

# Phase 6: Backend Implementation

## 🎯 **Phase Objective**
Implement the backend infrastructure for markdown linting rules persistence, following the established FastAPI + SQLAlchemy + Docker architecture patterns. This includes database schema, API endpoints, CRUD operations, and proper authentication integration.

## 📋 **Requirements Analysis**

### **Backend Architecture Patterns**
Following the copilot-backend-instructions.md guidelines:
- **Application Factory Pattern**: Use `app_factory.py` with lifespan management
- **Service Boundaries**: Clean separation between API, business logic, and data layers
- **Async SQLAlchemy**: All database operations use async sessions
- **Router Organization**: Nested structure with `/markdown-lint` prefix
- **Authentication**: JWT-based auth with user context

### **Database Design**
- **Rule Storage**: JSONB for flexible rule configurations
- **Hierarchy Support**: User, category, and folder-level rules
- **Audit Trail**: Track rule changes with timestamps
- **User Isolation**: Rules scoped by user_id for security

## 🔧 **Implementation Tasks**

### **Task 6.1: Database Schema and Models**
**File**: `backend/app/models/markdown_lint.py`

```python
from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import BaseModel

class MarkdownLintRule(BaseModel):
    """
    Model for storing markdown linting rules configuration
    Supports hierarchical rule management: user defaults, category rules, folder rules
    """
    __tablename__ = "markdown_lint_rules"

    # Primary key and user relationship
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Rule scope (determines hierarchy level)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    folder_path = Column(String(500), nullable=True)  # Null for user defaults

    # Rule identification and configuration
    rule_id = Column(String(10), nullable=False)  # MD001, MD003, etc.
    enabled = Column(Boolean, default=True, nullable=False)
    configuration = Column(JSONB, nullable=True)  # Rule-specific config (style options, etc.)

    # Metadata
    description = Column(Text, nullable=True)  # Optional user description
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="markdown_lint_rules")
    category = relationship("Category", back_populates="markdown_lint_rules")

    # Indexes for performance
    __table_args__ = (
        # Unique constraint: one rule per user/scope combination
        Index('ix_markdown_lint_unique_rule', 'user_id', 'category_id', 'folder_path', 'rule_id', unique=True),
        # Query optimization indexes
        Index('ix_markdown_lint_user_category', 'user_id', 'category_id'),
        Index('ix_markdown_lint_user_folder', 'user_id', 'folder_path'),
        Index('ix_markdown_lint_rule_lookup', 'user_id', 'rule_id'),
    )

    def __repr__(self):
        scope = f"category:{self.category_id}" if self.category_id else f"folder:{self.folder_path}" if self.folder_path else "user"
        return f"<MarkdownLintRule(user={self.user_id}, {scope}, rule={self.rule_id})>"

    @property
    def scope_type(self) -> str:
        """Determine the scope type of this rule"""
        if self.category_id:
            return "category"
        elif self.folder_path:
            return "folder"
        else:
            return "user"

    def to_dict(self) -> dict:
        """Convert rule to dictionary format"""
        return {
            "rule_id": self.rule_id,
            "enabled": self.enabled,
            "configuration": self.configuration,
            "scope_type": self.scope_type,
            "category_id": self.category_id,
            "folder_path": self.folder_path,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Add to User model relationship (update user.py)
# user.markdown_lint_rules = relationship("MarkdownLintRule", back_populates="user", cascade="all, delete-orphan")

# Add to Category model relationship (update category.py)
# category.markdown_lint_rules = relationship("MarkdownLintRule", back_populates="category", cascade="all, delete-orphan")
```

### **Task 6.2: Database Migration**
**File**: `backend/migrations/versions/xxx_add_markdown_lint_rules.py`

```python
"""Add markdown lint rules table

Revision ID: add_markdown_lint_rules
Revises: [previous_revision]
Create Date: 2025-09-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_markdown_lint_rules'
down_revision = '[previous_revision]'  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade():
    # Create markdown_lint_rules table
    op.create_table('markdown_lint_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('folder_path', sa.String(length=500), nullable=True),
        sa.Column('rule_id', sa.String(length=10), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('configuration', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('ix_markdown_lint_unique_rule', 'markdown_lint_rules',
                   ['user_id', 'category_id', 'folder_path', 'rule_id'], unique=True)
    op.create_index('ix_markdown_lint_user_category', 'markdown_lint_rules',
                   ['user_id', 'category_id'])
    op.create_index('ix_markdown_lint_user_folder', 'markdown_lint_rules',
                   ['user_id', 'folder_path'])
    op.create_index('ix_markdown_lint_rule_lookup', 'markdown_lint_rules',
                   ['user_id', 'rule_id'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_markdown_lint_rule_lookup', table_name='markdown_lint_rules')
    op.drop_index('ix_markdown_lint_user_folder', table_name='markdown_lint_rules')
    op.drop_index('ix_markdown_lint_user_category', table_name='markdown_lint_rules')
    op.drop_index('ix_markdown_lint_unique_rule', table_name='markdown_lint_rules')

    # Drop table
    op.drop_table('markdown_lint_rules')
```

### **Task 6.3: CRUD Operations**
**File**: `backend/app/crud/markdown_lint.py`

```python
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.orm import selectinload
from app.models.markdown_lint import MarkdownLintRule
from app.crud.base import CRUDBase

class CRUDMarkdownLintRule(CRUDBase[MarkdownLintRule, dict, dict]):
    """CRUD operations for markdown lint rules"""

    async def get_user_rules(
        self,
        db: AsyncSession,
        user_id: int,
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None
    ) -> List[MarkdownLintRule]:
        """
        Get all applicable rules for a user context
        Returns rules in hierarchy order: folder > category > user defaults
        """
        query = select(MarkdownLintRule).where(
            MarkdownLintRule.user_id == user_id
        )

        # Build filter conditions for rule hierarchy
        conditions = []

        # Always include user defaults (no category_id, no folder_path)
        conditions.append(
            and_(
                MarkdownLintRule.category_id.is_(None),
                MarkdownLintRule.folder_path.is_(None)
            )
        )

        # Include category rules if category_id provided
        if category_id:
            conditions.append(
                and_(
                    MarkdownLintRule.category_id == category_id,
                    MarkdownLintRule.folder_path.is_(None)
                )
            )

        # Include folder rules if folder_path provided
        if folder_path:
            conditions.append(
                and_(
                    MarkdownLintRule.category_id.is_(None),
                    MarkdownLintRule.folder_path == folder_path
                )
            )

        query = query.where(or_(*conditions))
        query = query.order_by(
            # Order by scope priority: folder (highest), category, user defaults (lowest)
            MarkdownLintRule.folder_path.desc().nulls_last(),
            MarkdownLintRule.category_id.desc().nulls_last(),
            MarkdownLintRule.rule_id
        )

        result = await db.execute(query)
        return result.scalars().all()

    async def get_category_rules(
        self,
        db: AsyncSession,
        user_id: int,
        category_id: int
    ) -> List[MarkdownLintRule]:
        """Get rules specific to a category"""
        query = select(MarkdownLintRule).where(
            and_(
                MarkdownLintRule.user_id == user_id,
                MarkdownLintRule.category_id == category_id,
                MarkdownLintRule.folder_path.is_(None)
            )
        ).order_by(MarkdownLintRule.rule_id)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_folder_rules(
        self,
        db: AsyncSession,
        user_id: int,
        folder_path: str
    ) -> List[MarkdownLintRule]:
        """Get rules specific to a folder"""
        query = select(MarkdownLintRule).where(
            and_(
                MarkdownLintRule.user_id == user_id,
                MarkdownLintRule.folder_path == folder_path,
                MarkdownLintRule.category_id.is_(None)
            )
        ).order_by(MarkdownLintRule.rule_id)

        result = await db.execute(query)
        return result.scalars().all()

    async def get_user_defaults(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[MarkdownLintRule]:
        """Get user default rules"""
        query = select(MarkdownLintRule).where(
            and_(
                MarkdownLintRule.user_id == user_id,
                MarkdownLintRule.category_id.is_(None),
                MarkdownLintRule.folder_path.is_(None)
            )
        ).order_by(MarkdownLintRule.rule_id)

        result = await db.execute(query)
        return result.scalars().all()

    async def upsert_rule(
        self,
        db: AsyncSession,
        user_id: int,
        rule_id: str,
        enabled: bool,
        configuration: Optional[Dict[str, Any]] = None,
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None,
        description: Optional[str] = None
    ) -> MarkdownLintRule:
        """
        Insert or update a rule
        Uses PostgreSQL ON CONFLICT for atomic upsert
        """
        # Try to get existing rule
        query = select(MarkdownLintRule).where(
            and_(
                MarkdownLintRule.user_id == user_id,
                MarkdownLintRule.rule_id == rule_id,
                MarkdownLintRule.category_id == category_id,
                MarkdownLintRule.folder_path == folder_path
            )
        )

        result = await db.execute(query)
        existing_rule = result.scalar_one_or_none()

        if existing_rule:
            # Update existing rule
            existing_rule.enabled = enabled
            existing_rule.configuration = configuration
            existing_rule.description = description
            await db.commit()
            await db.refresh(existing_rule)
            return existing_rule
        else:
            # Create new rule
            new_rule = MarkdownLintRule(
                user_id=user_id,
                rule_id=rule_id,
                enabled=enabled,
                configuration=configuration,
                category_id=category_id,
                folder_path=folder_path,
                description=description
            )
            db.add(new_rule)
            await db.commit()
            await db.refresh(new_rule)
            return new_rule

    async def bulk_upsert_rules(
        self,
        db: AsyncSession,
        user_id: int,
        rules: Dict[str, Any],
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None
    ) -> List[MarkdownLintRule]:
        """
        Bulk upsert multiple rules for a specific scope
        More efficient for updating complete rule sets
        """
        result_rules = []

        for rule_id, rule_config in rules.items():
            if isinstance(rule_config, bool):
                enabled = rule_config
                configuration = None
            elif isinstance(rule_config, dict):
                enabled = True
                configuration = rule_config
            else:
                continue  # Skip invalid configurations

            rule = await self.upsert_rule(
                db=db,
                user_id=user_id,
                rule_id=rule_id,
                enabled=enabled,
                configuration=configuration,
                category_id=category_id,
                folder_path=folder_path
            )
            result_rules.append(rule)

        return result_rules

    async def delete_scope_rules(
        self,
        db: AsyncSession,
        user_id: int,
        category_id: Optional[int] = None,
        folder_path: Optional[str] = None
    ) -> int:
        """
        Delete all rules for a specific scope
        Returns number of deleted rules
        """
        query = delete(MarkdownLintRule).where(
            and_(
                MarkdownLintRule.user_id == user_id,
                MarkdownLintRule.category_id == category_id,
                MarkdownLintRule.folder_path == folder_path
            )
        )

        result = await db.execute(query)
        await db.commit()
        return result.rowcount

    def rules_to_config_dict(self, rules: List[MarkdownLintRule]) -> Dict[str, Any]:
        """
        Convert list of rules to markdownlint configuration dictionary
        Handles rule hierarchy and merging
        """
        config = {}

        # Process rules in order (user defaults first, then category, then folder)
        for rule in rules:
            if rule.enabled:
                if rule.configuration:
                    config[rule.rule_id] = rule.configuration
                else:
                    config[rule.rule_id] = True
            else:
                config[rule.rule_id] = False

        return config


# Create instance
markdown_lint_rule = CRUDMarkdownLintRule(MarkdownLintRule)
```

### **Task 6.4: Pydantic Schemas**
**File**: `backend/app/schemas/markdown_lint.py`

```python
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator
from datetime import datetime

class MarkdownLintRuleBase(BaseModel):
    """Base schema for markdown lint rules"""
    rule_id: str = Field(..., regex=r'^MD\d{3}$', description="Rule ID (e.g., MD001)")
    enabled: bool = Field(True, description="Whether the rule is enabled")
    configuration: Optional[Dict[str, Any]] = Field(None, description="Rule-specific configuration")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")

class MarkdownLintRuleCreate(MarkdownLintRuleBase):
    """Schema for creating markdown lint rules"""
    category_id: Optional[int] = Field(None, description="Category ID for category-scoped rules")
    folder_path: Optional[str] = Field(None, max_length=500, description="Folder path for folder-scoped rules")

    @validator('folder_path')
    def validate_folder_path(cls, v):
        if v is not None:
            if not v.startswith('/'):
                raise ValueError('Folder path must start with /')
            if len(v) > 1 and v.endswith('/'):
                raise ValueError('Folder path must not end with / except for root')
        return v

class MarkdownLintRuleUpdate(BaseModel):
    """Schema for updating markdown lint rules"""
    enabled: Optional[bool] = None
    configuration: Optional[Dict[str, Any]] = None
    description: Optional[str] = Field(None, max_length=500)

class MarkdownLintRuleResponse(MarkdownLintRuleBase):
    """Schema for markdown lint rule responses"""
    id: int
    user_id: int
    category_id: Optional[int]
    folder_path: Optional[str]
    scope_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MarkdownLintConfigRequest(BaseModel):
    """Schema for bulk rule configuration updates"""
    rules: Dict[str, Any] = Field(..., description="Rule configuration dictionary")

    @validator('rules')
    def validate_rules(cls, v):
        for rule_id, config in v.items():
            if not rule_id.startswith('MD') or len(rule_id) != 5:
                raise ValueError(f'Invalid rule ID: {rule_id}')
            if not isinstance(config, (bool, dict)):
                raise ValueError(f'Rule configuration must be boolean or object: {rule_id}')
        return v

class MarkdownLintConfigResponse(BaseModel):
    """Schema for rule configuration responses"""
    rules: Dict[str, Any]
    scope_type: str
    category_id: Optional[int] = None
    folder_path: Optional[str] = None
    last_updated: datetime

class MarkdownLintRuleDefinition(BaseModel):
    """Schema for rule definitions and metadata"""
    rule_id: str
    name: str
    description: str
    category: str
    fixable: bool
    configurable: bool
    options: Optional[Dict[str, Any]] = None

class MarkdownLintRuleDefinitionsResponse(BaseModel):
    """Schema for rule definitions response"""
    definitions: Dict[str, MarkdownLintRuleDefinition]
```

### **Task 6.5: API Router Implementation**
**File**: `backend/app/routers/markdown_lint.py`

```python
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.crud.markdown_lint import markdown_lint_rule
from app.schemas.markdown_lint import (
    MarkdownLintRuleResponse,
    MarkdownLintConfigRequest,
    MarkdownLintConfigResponse,
    MarkdownLintRuleDefinitionsResponse,
    MarkdownLintRuleDefinition
)

router = APIRouter(prefix="/markdown-lint", tags=["markdown-lint"])

# Rule definitions (could be moved to a separate service/config file)
RULE_DEFINITIONS = {
    "MD001": MarkdownLintRuleDefinition(
        rule_id="MD001",
        name="heading-increment",
        description="Heading levels should only increment by one level at a time",
        category="Headings",
        fixable=False,
        configurable=False
    ),
    "MD003": MarkdownLintRuleDefinition(
        rule_id="MD003",
        name="heading-style",
        description="Heading style",
        category="Headings",
        fixable=True,
        configurable=True,
        options={"style": ["atx", "atx_closed", "setext", "setext_with_atx"]}
    ),
    # ... add more rule definitions
}

@router.get("/rules/definitions", response_model=MarkdownLintRuleDefinitionsResponse)
async def get_rule_definitions():
    """Get all available rule definitions and metadata"""
    return MarkdownLintRuleDefinitionsResponse(definitions=RULE_DEFINITIONS)

@router.get("/user/defaults", response_model=MarkdownLintConfigResponse)
async def get_user_default_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user default markdown lint rules"""
    rules = await markdown_lint_rule.get_user_defaults(db, current_user.id)
    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="user",
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.put("/user/defaults", response_model=MarkdownLintConfigResponse)
async def update_user_default_rules(
    config_request: MarkdownLintConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user default markdown lint rules"""
    # Clear existing user defaults
    await markdown_lint_rule.delete_scope_rules(
        db, current_user.id, category_id=None, folder_path=None
    )

    # Bulk upsert new rules
    rules = await markdown_lint_rule.bulk_upsert_rules(
        db=db,
        user_id=current_user.id,
        rules=config_request.rules,
        category_id=None,
        folder_path=None
    )

    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="user",
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.get("/categories/{category_id}/rules", response_model=MarkdownLintConfigResponse)
async def get_category_rules(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get markdown lint rules for a specific category"""
    # TODO: Verify user has access to this category

    rules = await markdown_lint_rule.get_category_rules(db, current_user.id, category_id)
    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="category",
        category_id=category_id,
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.put("/categories/{category_id}/rules", response_model=MarkdownLintConfigResponse)
async def update_category_rules(
    category_id: int,
    config_request: MarkdownLintConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update markdown lint rules for a specific category"""
    # TODO: Verify user has access to this category

    # Clear existing category rules
    await markdown_lint_rule.delete_scope_rules(
        db, current_user.id, category_id=category_id, folder_path=None
    )

    # Bulk upsert new rules
    rules = await markdown_lint_rule.bulk_upsert_rules(
        db=db,
        user_id=current_user.id,
        rules=config_request.rules,
        category_id=category_id,
        folder_path=None
    )

    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="category",
        category_id=category_id,
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.get("/folders/{folder_path:path}/rules", response_model=MarkdownLintConfigResponse)
async def get_folder_rules(
    folder_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get markdown lint rules for a specific folder"""
    # Normalize folder path
    if not folder_path.startswith('/'):
        folder_path = '/' + folder_path

    rules = await markdown_lint_rule.get_folder_rules(db, current_user.id, folder_path)
    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="folder",
        folder_path=folder_path,
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.put("/folders/{folder_path:path}/rules", response_model=MarkdownLintConfigResponse)
async def update_folder_rules(
    folder_path: str,
    config_request: MarkdownLintConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update markdown lint rules for a specific folder"""
    # Normalize folder path
    if not folder_path.startswith('/'):
        folder_path = '/' + folder_path

    # Clear existing folder rules
    await markdown_lint_rule.delete_scope_rules(
        db, current_user.id, category_id=None, folder_path=folder_path
    )

    # Bulk upsert new rules
    rules = await markdown_lint_rule.bulk_upsert_rules(
        db=db,
        user_id=current_user.id,
        rules=config_request.rules,
        category_id=None,
        folder_path=folder_path
    )

    config = markdown_lint_rule.rules_to_config_dict(rules)

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type="folder",
        folder_path=folder_path,
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.get("/context/rules", response_model=MarkdownLintConfigResponse)
async def get_contextual_rules(
    category_id: Optional[int] = None,
    folder_path: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get merged markdown lint rules for a specific context
    Returns the effective rules considering hierarchy: folder > category > user defaults
    """
    if folder_path and not folder_path.startswith('/'):
        folder_path = '/' + folder_path

    rules = await markdown_lint_rule.get_user_rules(
        db, current_user.id, category_id, folder_path
    )
    config = markdown_lint_rule.rules_to_config_dict(rules)

    # Determine primary scope
    scope_type = "user"
    if folder_path:
        scope_type = "folder"
    elif category_id:
        scope_type = "category"

    return MarkdownLintConfigResponse(
        rules=config,
        scope_type=scope_type,
        category_id=category_id,
        folder_path=folder_path,
        last_updated=max([r.updated_at for r in rules]) if rules else None
    )

@router.delete("/categories/{category_id}/rules")
async def delete_category_rules(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete all rules for a specific category"""
    deleted_count = await markdown_lint_rule.delete_scope_rules(
        db, current_user.id, category_id=category_id, folder_path=None
    )

    return {"message": f"Deleted {deleted_count} rules", "deleted_count": deleted_count}

@router.delete("/folders/{folder_path:path}/rules")
async def delete_folder_rules(
    folder_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete all rules for a specific folder"""
    if not folder_path.startswith('/'):
        folder_path = '/' + folder_path

    deleted_count = await markdown_lint_rule.delete_scope_rules(
        db, current_user.id, category_id=None, folder_path=folder_path
    )

    return {"message": f"Deleted {deleted_count} rules", "deleted_count": deleted_count}
```

### **Task 6.6: Register Router in App Factory**
**File**: `backend/app/app_factory.py`

Add the markdown lint router to the application:

```python
# Add import
from app.routers import markdown_lint

# Add router registration (around line 80)
def register_routers(app: FastAPI) -> None:
    """Register all API routers"""
    # ... existing routers

    # Markdown linting routes
    app.include_router(markdown_lint.router, prefix="/api")
```

### **Task 6.7: Integration Testing**
**File**: `backend/tests/integration/test_markdown_lint_api.py`

```python
import pytest
from httpx import AsyncClient
from app.main import app
from app.core.auth import create_access_token

@pytest.mark.asyncio
async def test_markdown_lint_rules_flow():
    """Test complete markdown lint rules workflow"""
    # Create test user token
    token = create_access_token(data={"sub": "1"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test rule definitions
        response = await client.get("/api/markdown-lint/rules/definitions")
        assert response.status_code == 200

        # Test user defaults
        response = await client.get("/api/markdown-lint/user/defaults", headers=headers)
        assert response.status_code == 200

        # Update user defaults
        rules_data = {
            "rules": {
                "MD001": True,
                "MD003": {"style": "atx"},
                "MD013": False
            }
        }
        response = await client.put("/api/markdown-lint/user/defaults",
                                  json=rules_data, headers=headers)
        assert response.status_code == 200

        # Test category rules
        response = await client.get("/api/markdown-lint/categories/1/rules", headers=headers)
        assert response.status_code == 200
```

## ✅ **Verification Steps**

1. **Migration**: Run database migration successfully
2. **Models**: Verify model relationships and constraints
3. **CRUD**: Test all CRUD operations
4. **API**: Verify all endpoints respond correctly
5. **Authentication**: Confirm user isolation
6. **Performance**: Test with multiple rules and scopes

## 🔗 **Integration Points**

- **Previous Phase**: Serves frontend API calls from Phase 3
- **Database**: Integrates with existing user and category models
- **Authentication**: Uses existing JWT auth system
- **Docker**: Follows existing container patterns

## 📊 **Performance Considerations**

- **Indexing**: Optimized indexes for common queries
- **Bulk Operations**: Efficient bulk upsert for rule sets
- **Caching**: Frontend caching reduces API calls
- **JSONB**: Flexible rule storage with good query performance

## 🔒 **Security Measures**

- **User Isolation**: All rules scoped by user_id
- **Input Validation**: Pydantic schemas validate all inputs
- **SQL Injection**: SQLAlchemy ORM prevents injection
- **Authentication**: JWT required for all endpoints

This backend implementation provides robust, scalable persistence for markdown linting rules while following established architectural patterns and security practices.
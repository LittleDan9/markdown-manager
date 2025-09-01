# Phase 2: Database Schema Migration

## Objective

Add folder_path support to the document model while maintaining backward compatibility with the existing catego    # Add new unique constraint
    op.create_unique_constraint(
        'uq_user_folder_name',
        'documents',
        ['user_id', 'folder_path', 'name']
    )

    # Note: Keep old constraint for now during transition


def upgrade_custom_dictionary() -> None:
    """Add folder_path support to custom_dictionaries table."""

    # Step 1: Add folder_path column (nullable initially)
    op.add_column('custom_dictionaries',
        sa.Column('folder_path', sa.String(500), nullable=True)
    )

    # Step 2: Populate folder_path from category names for existing entries
    op.execute(text("""
        UPDATE custom_dictionaries
        SET folder_path = '/' || categories.name
        FROM categories
        WHERE custom_dictionaries.category_id = categories.id
    """))

    # Step 3: Add index on folder_path for performance
    op.create_index('ix_custom_dictionaries_folder_path', 'custom_dictionaries', ['folder_path'])

    # Step 4: Add new unique constraint for folder-based dictionary words
    op.create_unique_constraint(
        'uq_folder_dictionary_word',
        'custom_dictionaries',
        ['folder_path', 'word']
    )
     during the transition period.

## Duration

1-2 days

## Risk Level

Medium - Database schema changes require careful migration planning and rollback strategies.

## Database Changes Required

### Document Model Updates

**File**: `backend/app/models/document.py`

Add folder_path column while keeping category_id for transition:

```python
class Document(Base):
    # ... existing fields ...

    # NEW: Folder path for hierarchical organization
    folder_path: Mapped[str] = mapped_column(
        String(1000), nullable=False, default="/", index=True,
        comment="Hierarchical folder path (e.g., '/Work/Projects')"
    )

    # KEEP during transition: Foreign key to category (make nullable)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,  # Changed from False to True
        index=True,
    )

    # Update unique constraint to include folder_path
    __table_args__ = (
        # New constraint for folder-based uniqueness
        UniqueConstraint("user_id", "folder_path", "name", name="uq_user_folder_name"),
        # Keep old constraint during transition
        UniqueConstraint("user_id", "name", name="uq_user_name"),
    )

    # ... rest of existing fields and relationships ...
```

### Custom Dictionary Model Updates

**File**: `backend/app/models/custom_dictionary.py`

Add folder_path support for custom dictionary words:

```python
class CustomDictionary(BaseModel):
    """Custom dictionary model for user-specific or category-specific spell checking words."""

    __tablename__ = "custom_dictionaries"
    __table_args__ = (
        # Ensure user_id is always provided (dictionaries are always owned by a user)
        CheckConstraint("user_id IS NOT NULL", name="ck_custom_dictionaries_scope"),
        # Ensure unique words per category (for category-level dictionaries)
        UniqueConstraint("category_id", "word", name="uq_category_dictionary_word"),
        # NEW: Ensure unique words per folder (for folder-level dictionaries)
        UniqueConstraint("folder_path", "word", name="uq_folder_dictionary_word"),
    )

    # Foreign key to user (always required - dictionaries are owned by users)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Foreign key to category (for category-level dictionaries - KEEP during transition)
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # NEW: Folder path for folder-level dictionaries
    folder_path: Mapped[str | None] = mapped_column(
        String(500),  # Support deep folder paths
        nullable=True,
        index=True,
        comment="Hierarchical folder path for dictionary scope (e.g., '/Work/Projects')"
    )

    # The custom word to add to dictionary
    word: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional notes about the word
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="custom_dictionary_words"
    )
    category: Mapped["Category | None"] = relationship(
        "Category", back_populates="custom_dictionary_words"
    )
```

### Migration Script

Should maintain NOT NULL constraint on folder_path. Migration should create column as NULL, migrated existing category name `/<category_name>` based on document's category id, and then after data migrations it should alter the table to make the column NOT NULL.

**File**: `backend/migrations/versions/add_folder_path_to_documents.py`

```python
"""Add folder_path to documents table

Revision ID: 002_add_folder_path
Revises: 001_previous_migration
Create Date: 2025-08-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers
revision = '002_add_folder_path'
down_revision = '001_previous_migration'  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add folder_path column and migrate existing data."""

    # Step 1: Add folder_path column (nullable initially)
    op.add_column('documents',
        sa.Column('folder_path', sa.String(1000), nullable=True, default='/')
    )

    # Step 2: Populate folder_path from category names
    # This SQL joins documents with categories to get category names
    op.execute(text("""
        UPDATE documents
        SET folder_path = '/' || categories.name
        FROM categories
        WHERE documents.category_id = categories.id
    """))

    # Step 3: Set default folder_path for any documents without categories
    op.execute(text("""
        UPDATE documents
        SET folder_path = '/General'
        WHERE folder_path IS NULL
    """))

    # Step 4: Make folder_path NOT NULL now that all rows have values
    op.alter_column('documents', 'folder_path', nullable=False)

    # Step 5: Add index on folder_path for performance
    op.create_index('ix_documents_folder_path', 'documents', ['folder_path'])

    # Step 6: Make category_id nullable (for future phases)
    op.alter_column('documents', 'category_id', nullable=True)

    # Step 7: Add new unique constraint
    op.create_unique_constraint(
        'uq_user_folder_name',
        'documents',
        ['user_id', 'folder_path', 'name']
    )

    # Note: Keep old constraint for now during transition


def downgrade() -> None:
    """Remove folder_path changes."""

    # Remove new constraint
    op.drop_constraint('uq_user_folder_name', 'documents', type_='unique')

    # Remove index
    op.drop_index('ix_documents_folder_path', 'documents')

    # Make category_id required again
    op.alter_column('documents', 'category_id', nullable=False)

    # Remove folder_path column
    op.drop_column('documents', 'folder_path')
```

### Helper Migration Functions

**File**: `backend/migrations/migration_helpers.py`

```python
"""Helper functions for folder migration."""

def extract_root_folder(folder_path: str) -> str:
    """Extract root folder from full path."""
    parts = [p for p in folder_path.split('/') if p]
    if not parts:
        return '/'
    return f"/{parts[0]}"

def validate_folder_path(folder_path: str) -> bool:
    """Validate folder path format."""
    if not folder_path.startswith('/'):
        return False

    # Check for invalid characters
    invalid_chars = ['\\', ':', '*', '?', '"', '<', '>', '|']
    return not any(char in folder_path for char in invalid_chars)

def migrate_github_documents():
    """Special migration for GitHub documents to proper folder structure."""
    # This will be used in Phase 4
    pass
```

## Backend Model Updates

### Enhanced Document Model

**File**: `backend/app/models/document.py` (additional methods)

```python
class Document(Base):
    # ... existing fields ...

    @property
    def root_folder(self) -> str:
        """Get the root folder from folder_path."""
        parts = [p for p in self.folder_path.split('/') if p]
        return f"/{parts[0]}" if parts else "/"

    @property
    def is_github_document(self) -> bool:
        """Check if this is a GitHub-sourced document."""
        return self.github_repository_id is not None

    @property
    def display_path(self) -> str:
        """Get user-friendly display path."""
        if self.folder_path == '/':
            return self.name
        return f"{self.folder_path.strip('/')}/{self.name}"

    def get_folder_breadcrumbs(self) -> list[str]:
        """Get folder path as breadcrumb list."""
        if self.folder_path == '/':
            return []
        return [p for p in self.folder_path.split('/') if p]

    @classmethod
    def normalize_folder_path(cls, path: str) -> str:
        """Normalize folder path format."""
        if not path or path == '/':
            return '/'

        # Remove trailing slash, ensure leading slash
        path = '/' + path.strip('/')

        # Remove double slashes
        while '//' in path:
            path = path.replace('//', '/')

        return path
```

### Update Database Configuration

**File**: `backend/app/database.py` (if needed)

Add any database configuration changes for the new indexes or constraints.

## Testing the Migration

### Migration Test Script

**File**: `backend/scripts/test_folder_migration.py`

```python
#!/usr/bin/env python3
"""Test script for folder migration."""

import asyncio
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.document import Document
from app.models.category import Category
from app.database import get_database_url

async def test_migration():
    """Test that folder migration worked correctly."""

    # Create test database connection
    engine = create_engine(get_database_url())
    Session = sessionmaker(bind=engine)

    with Session() as session:
        # Test 1: All documents have folder_path
        docs_without_path = session.query(Document).filter(
            Document.folder_path.is_(None)
        ).count()

        if docs_without_path > 0:
            print(f"❌ Found {docs_without_path} documents without folder_path")
            return False

        # Test 2: All folder_paths are valid
        all_docs = session.query(Document).all()
        invalid_paths = []

        for doc in all_docs:
            if not doc.folder_path.startswith('/'):
                invalid_paths.append(f"Doc {doc.id}: '{doc.folder_path}'")

        if invalid_paths:
            print(f"❌ Found invalid folder paths: {invalid_paths}")
            return False

        # Test 3: Mapping from categories preserved
        categories = session.query(Category).all()
        for category in categories:
            expected_path = f"/{category.name}"
            docs_in_category = session.query(Document).filter(
                Document.category_id == category.id
            ).all()

            mismatched = [
                doc for doc in docs_in_category
                if doc.folder_path != expected_path
            ]

            if mismatched:
                print(f"❌ Category '{category.name}' has mismatched folder paths")
                return False

        print("✅ All migration tests passed!")
        print(f"✅ Migrated {len(all_docs)} documents")
        print(f"✅ Mapped {len(categories)} categories to folder paths")

        return True

if __name__ == "__main__":
    success = asyncio.run(test_migration())
    sys.exit(0 if success else 1)
```

## Updated API Preparation

### New Repository Methods

**File**: `backend/app/crud/document.py` (prepare for Phase 3)

Add folder-aware query methods:

```python
class DocumentRepository:
    # ... existing methods ...

    async def get_documents_by_folder_path(
        self,
        user_id: int,
        folder_path: str,
        include_subfolders: bool = False
    ) -> list[Document]:
        """Get documents in a specific folder path."""
        query = select(Document).where(Document.user_id == user_id)

        if include_subfolders:
            # Get all documents in folder and subfolders
            search_pattern = f"{folder_path.rstrip('/')}/%"
            query = query.where(Document.folder_path.like(search_pattern))
        else:
            # Get documents only in exact folder
            query = query.where(Document.folder_path == folder_path)

        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_folder_structure(self, user_id: int) -> dict:
        """Build folder tree structure for UI."""
        # Get all unique folder paths for user
        query = select(Document.folder_path).where(
            Document.user_id == user_id
        ).distinct()

        result = await self.session.execute(query)
        paths = result.scalars().all()

        # Build hierarchical structure
        tree = {}
        for path in paths:
            parts = [p for p in path.split('/') if p]
            current = tree
            for part in parts:
                if part not in current:
                    current[part] = {}
                current = current[part]

        return tree

    async def move_document_to_folder(
        self,
        document_id: int,
        new_folder_path: str,
        user_id: int
    ) -> Document:
        """Move document to a different folder."""
        # Normalize the folder path
        new_folder_path = Document.normalize_folder_path(new_folder_path)

        # Get and update document
        query = select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id
        )
        result = await self.session.execute(query)
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError(f"Document {document_id} not found")

        document.folder_path = new_folder_path
        await self.session.commit()
        await self.session.refresh(document)

        return document
```

## Running the Migration

### Development Environment

```bash
# 1. Create the migration
cd backend
alembic revision --autogenerate -m "Add folder_path to documents"

# 2. Review the generated migration file
# Edit if needed to match the planned migration

# 3. Run the migration
alembic upgrade head

# 4. Test the migration
python scripts/test_folder_migration.py

# 5. Verify in database
docker compose exec db psql -U postgres -d markdown_manager -c "
    SELECT folder_path, COUNT(*)
    FROM documents
    GROUP BY folder_path
    ORDER BY folder_path;
"
```

### Production Considerations

- **Backup**: Always backup database before migration
- **Rollback Plan**: Test downgrade migration in staging
- **Monitoring**: Monitor migration performance on large datasets
- **Indexing**: Consider adding indexes after migration for performance

## Success Criteria

- [ ] Migration runs successfully without errors
- [ ] All existing documents have valid folder_path values
- [ ] Folder paths correctly map to original category names
- [ ] New unique constraint prevents duplicate names within folders
- [ ] Indexes are created for performance
- [ ] Migration test script passes
- [ ] Rollback migration tested and works
- [ ] No data loss during migration

## Next Phase

Phase 3 will update the backend API endpoints to support folder-based operations, enabling the frontend to use the new folder structure.

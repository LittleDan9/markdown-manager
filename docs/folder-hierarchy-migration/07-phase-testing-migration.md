# Phase 7: Testing & Migration Scripts

## Objective

Create comprehensive testing for the new folder-based system, build production migration scripts, and establish procedures for safely transitioning from the category-based system to the folder-based system in production.

## Duration

2-3 days

## Risk Level

Low - Focuses on testing and safe migration procedures.

## Testing Strategy

### Comprehensive Test Coverage

We need to ensure all aspects of the folder migration work correctly:

1. **Database Migration Tests** - Verify data integrity during schema changes
2. **API Endpoint Tests** - Ensure all folder-based operations work correctly
3. **Frontend Integration Tests** - Verify UI components work with new data structure
4. **GitHub Integration Tests** - Confirm GitHub folder mapping works properly
5. **Custom Dictionary Tests** - Validate dictionary scoping works correctly
6. **Performance Tests** - Ensure folder operations perform well at scale

## Database Migration Testing

### Migration Validation Suite

**File**: `backend/tests/test_migration_validation.py`

```python
import pytest
import asyncio
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.document import Document
from app.models.category import Category
from app.models.custom_dictionary import CustomDictionary
from app.models.github_models import GitHubRepository
from app.database import get_database_url

class TestMigrationValidation:
    """Test suite to validate database migrations are successful."""

    @pytest.fixture
    async def migration_session(self):
        """Create a test session for migration validation."""
        engine = create_async_engine(get_database_url())
        async_session = sessionmaker(engine, class_=AsyncSession)

        async with async_session() as session:
            yield session

    async def test_document_folder_path_migration(self, migration_session):
        """Test that all documents have valid folder paths after migration."""
        # Check that no documents have NULL folder_path
        null_paths = await migration_session.execute(
            select(func.count(Document.id)).where(Document.folder_path.is_(None))
        )
        assert null_paths.scalar() == 0, "Found documents with NULL folder_path"

        # Check that all folder paths start with '/'
        invalid_paths = await migration_session.execute(
            select(Document.id, Document.folder_path).where(
                ~Document.folder_path.like('/%')
            )
        )
        invalid_list = invalid_paths.all()
        assert len(invalid_list) == 0, f"Found invalid folder paths: {invalid_list}"

        # Check that folder paths don't contain invalid characters
        invalid_chars_query = await migration_session.execute(
            select(Document.id, Document.folder_path).where(
                Document.folder_path.op('~')('[\\\\:*?"<>|]')
            )
        )
        invalid_chars = invalid_chars_query.all()
        assert len(invalid_chars) == 0, f"Found folder paths with invalid characters: {invalid_chars}"

    async def test_category_to_folder_mapping(self, migration_session):
        """Test that category names correctly map to folder paths."""
        # Get all categories and verify documents are mapped correctly
        categories_query = await migration_session.execute(
            select(Category.id, Category.name)
        )
        categories = categories_query.all()

        for category_id, category_name in categories:
            expected_folder_path = f"/{category_name}"

            # Check documents that were in this category
            docs_query = await migration_session.execute(
                select(Document.folder_path).where(
                    Document.category_id == category_id
                )
            )
            folder_paths = docs_query.scalars().all()

            # All documents from this category should have the expected folder path
            for folder_path in folder_paths:
                assert folder_path == expected_folder_path, \
                    f"Document folder path '{folder_path}' doesn't match expected '{expected_folder_path}'"

    async def test_github_document_folder_structure(self, migration_session):
        """Test that GitHub documents have proper folder structure."""
        github_docs_query = await migration_session.execute(
            select(Document).where(Document.github_repository_id.isnot(None))
        )
        github_docs = github_docs_query.scalars().all()

        for doc in github_docs:
            # Should start with /GitHub/
            assert doc.folder_path.startswith('/GitHub/'), \
                f"GitHub document {doc.id} has invalid folder path: {doc.folder_path}"

            # Should have at least repo and branch
            path_parts = doc.folder_path.split('/')
            assert len(path_parts) >= 4, \
                f"GitHub document {doc.id} has insufficient path depth: {doc.folder_path}"

            assert path_parts[1] == 'GitHub', \
                f"GitHub document {doc.id} doesn't have 'GitHub' as second path part"

    async def test_custom_dictionary_migration(self, migration_session):
        """Test that custom dictionaries migrated correctly."""
        # Check that dictionaries with root_folder_path have valid paths
        folder_dicts_query = await migration_session.execute(
            select(CustomDictionary).where(
                CustomDictionary.root_folder_path.isnot(None)
            )
        )
        folder_dicts = folder_dicts_query.scalars().all()

        for dict_entry in folder_dicts:
            # Should start with '/'
            assert dict_entry.root_folder_path.startswith('/'), \
                f"Dictionary {dict_entry.id} has invalid root_folder_path: {dict_entry.root_folder_path}"

            # Should not be empty
            assert len(dict_entry.root_folder_path) > 1, \
                f"Dictionary {dict_entry.id} has empty root_folder_path"

    async def test_unique_constraints(self, migration_session):
        """Test that unique constraints are working properly."""
        # Test document uniqueness within folders
        duplicate_docs_query = await migration_session.execute(
            text("""
                SELECT user_id, folder_path, name, COUNT(*) as count
                FROM documents
                GROUP BY user_id, folder_path, name
                HAVING COUNT(*) > 1
            """)
        )
        duplicates = duplicate_docs_query.all()
        assert len(duplicates) == 0, f"Found duplicate documents: {duplicates}"

        # Test dictionary word uniqueness within scope
        duplicate_words_query = await migration_session.execute(
            text("""
                SELECT user_id, root_folder_path, word, COUNT(*) as count
                FROM custom_dictionaries
                WHERE root_folder_path IS NOT NULL
                GROUP BY user_id, root_folder_path, word
                HAVING COUNT(*) > 1
            """)
        )
        word_duplicates = duplicate_words_query.all()
        assert len(word_duplicates) == 0, f"Found duplicate dictionary words: {word_duplicates}"

    async def test_migration_performance(self, migration_session):
        """Test that folder-based queries perform well."""
        import time

        # Test folder structure query performance
        start_time = time.time()
        folder_structure_query = await migration_session.execute(
            select(Document.folder_path).distinct().limit(1000)
        )
        folder_paths = folder_structure_query.scalars().all()
        end_time = time.time()

        query_time = end_time - start_time
        assert query_time < 1.0, f"Folder structure query took too long: {query_time}s"

        # Test folder document lookup performance
        if folder_paths:
            test_folder = folder_paths[0]
            start_time = time.time()
            folder_docs_query = await migration_session.execute(
                select(Document).where(Document.folder_path == test_folder)
            )
            docs = folder_docs_query.scalars().all()
            end_time = time.time()

            query_time = end_time - start_time
            assert query_time < 0.5, f"Folder document query took too long: {query_time}s"
```

### API Integration Testing

**File**: `backend/tests/test_folder_api_integration.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestFolderAPIIntegration:
    """Integration tests for folder-based API endpoints."""

    @pytest.fixture
    def auth_headers(self, test_user_token):
        return {"Authorization": f"Bearer {test_user_token}"}

    async def test_full_document_workflow(self, auth_headers):
        """Test complete document workflow with folders."""
        # 1. Create a document in a folder
        create_response = client.post(
            "/documents/",
            json={
                "name": "test-workflow.md",
                "content": "# Test Document",
                "folder_path": "/TestWorkflow"
            },
            headers=auth_headers
        )
        assert create_response.status_code == 200
        document = create_response.json()
        assert document["folder_path"] == "/TestWorkflow"

        # 2. Get folder structure
        structure_response = client.get("/documents/folders", headers=auth_headers)
        assert structure_response.status_code == 200
        structure = structure_response.json()
        assert "TestWorkflow" in str(structure["tree"])

        # 3. Get documents in folder
        folder_docs_response = client.get(
            "/documents/folders/TestWorkflow",
            headers=auth_headers
        )
        assert folder_docs_response.status_code == 200
        folder_docs = folder_docs_response.json()
        assert len(folder_docs) >= 1
        assert any(doc["name"] == "test-workflow.md" for doc in folder_docs)

        # 4. Move document to different folder
        move_response = client.put(
            f"/documents/{document['id']}/move",
            json={"new_folder_path": "/MovedDocuments"},
            headers=auth_headers
        )
        assert move_response.status_code == 200
        moved_doc = move_response.json()
        assert moved_doc["folder_path"] == "/MovedDocuments"

        # 5. Search documents
        search_response = client.get(
            "/documents/search",
            params={"q": "Test Document", "folder_path": "/MovedDocuments"},
            headers=auth_headers
        )
        assert search_response.status_code == 200
        search_results = search_response.json()
        assert len(search_results) >= 1

        # 6. Clean up
        delete_response = client.delete(
            f"/documents/{document['id']}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200

    async def test_github_folder_integration(self, auth_headers, test_github_repo):
        """Test GitHub integration with folder structure."""
        # Import GitHub files
        import_response = client.post(
            f"/github/repositories/{test_github_repo.id}/import",
            json={
                "branch": "main",
                "file_paths": ["README.md", "docs/setup.md"]
            },
            headers=auth_headers
        )
        assert import_response.status_code == 200
        import_results = import_response.json()

        # Check that GitHub documents have proper folder structure
        github_folders_response = client.get(
            "/github/folders",
            headers=auth_headers
        )
        assert github_folders_response.status_code == 200

        # Verify folder structure contains GitHub repository
        folder_tree = github_folders_response.json()["folder_tree"]
        assert "GitHub" in folder_tree

    async def test_dictionary_folder_scoping(self, auth_headers):
        """Test that custom dictionaries work with folder scoping."""
        # Add word to specific folder
        add_word_response = client.post(
            "/dictionaries/words",
            json={
                "word": "testword",
                "folder_path": "/TestProject",
                "notes": "Test word for project"
            },
            headers=auth_headers
        )
        assert add_word_response.status_code == 200

        # Check word in folder context
        check_response = client.get(
            "/dictionaries/words/check",
            params={
                "folder_path": "/TestProject/subfolder",
                "words": ["testword", "otherword"]
            },
            headers=auth_headers
        )
        assert check_response.status_code == 200
        check_results = check_response.json()
        assert check_results["results"]["testword"] == True
        assert check_results["results"]["otherword"] == False
```

## Production Migration Scripts

### Safe Production Migration

**File**: `backend/scripts/production_migration.py`

```python
#!/usr/bin/env python3
"""
Production migration script for folder hierarchy migration.
This script provides safe migration with rollback capabilities.
"""

import asyncio
import sys
import argparse
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.database import get_database_url
from app.models.document import Document
from app.models.category import Category
from app.models.custom_dictionary import CustomDictionary

class ProductionMigration:
    def __init__(self, database_url: str, dry_run: bool = True):
        self.database_url = database_url
        self.dry_run = dry_run
        self.engine = create_async_engine(database_url)
        self.session_factory = sessionmaker(self.engine, class_=AsyncSession)
        self.migration_log = []

    def log(self, message: str):
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.migration_log.append(log_entry)

    async def create_backup(self):
        """Create a database backup before migration."""
        self.log("Creating database backup...")

        if self.dry_run:
            self.log("DRY RUN: Would create database backup")
            return

        # This would be implemented based on your database setup
        # For PostgreSQL, you might use pg_dump
        # For now, we'll log the recommendation
        self.log("IMPORTANT: Ensure you have created a database backup before proceeding!")
        self.log("Use: pg_dump markdown_manager > backup_$(date +%Y%m%d_%H%M%S).sql")

    async def validate_prerequisites(self):
        """Validate that the system is ready for migration."""
        self.log("Validating migration prerequisites...")

        async with self.session_factory() as session:
            # Check if migration has already been run
            try:
                result = await session.execute(
                    text("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'folder_path'")
                )
                folder_path_exists = result.scalar() > 0

                if folder_path_exists:
                    self.log("WARNING: folder_path column already exists. Migration may have been run before.")
                    return False

            except Exception as e:
                self.log(f"Error checking prerequisites: {e}")
                return False

            # Check data integrity
            doc_count_result = await session.execute(text("SELECT COUNT(*) FROM documents"))
            doc_count = doc_count_result.scalar()
            self.log(f"Found {doc_count} documents to migrate")

            category_count_result = await session.execute(text("SELECT COUNT(*) FROM categories"))
            category_count = category_count_result.scalar()
            self.log(f"Found {category_count} categories to migrate")

            return True

    async def run_migration(self):
        """Execute the main migration."""
        self.log("Starting folder hierarchy migration...")

        if not await self.validate_prerequisites():
            self.log("Prerequisites validation failed. Aborting migration.")
            return False

        try:
            async with self.session_factory() as session:
                # Step 1: Add folder_path column
                self.log("Adding folder_path column to documents table...")
                if not self.dry_run:
                    await session.execute(text("""
                        ALTER TABLE documents
                        ADD COLUMN folder_path VARCHAR(1000) DEFAULT '/'
                    """))
                    await session.commit()
                else:
                    self.log("DRY RUN: Would add folder_path column")

                # Step 2: Populate folder_path from categories
                self.log("Populating folder_path from category names...")
                if not self.dry_run:
                    await session.execute(text("""
                        UPDATE documents
                        SET folder_path = '/' || categories.name
                        FROM categories
                        WHERE documents.category_id = categories.id
                    """))

                    # Handle documents without categories
                    await session.execute(text("""
                        UPDATE documents
                        SET folder_path = '/General'
                        WHERE folder_path = '/' AND category_id IS NULL
                    """))
                    await session.commit()
                else:
                    self.log("DRY RUN: Would populate folder_path from categories")

                # Step 3: Add constraints and indexes
                self.log("Adding constraints and indexes...")
                if not self.dry_run:
                    await session.execute(text("""
                        ALTER TABLE documents
                        ALTER COLUMN folder_path SET NOT NULL
                    """))

                    await session.execute(text("""
                        CREATE INDEX idx_documents_folder_path
                        ON documents (folder_path)
                    """))

                    await session.execute(text("""
                        ALTER TABLE documents
                        ADD CONSTRAINT uq_user_folder_name
                        UNIQUE (user_id, folder_path, name)
                    """))
                    await session.commit()
                else:
                    self.log("DRY RUN: Would add constraints and indexes")

                # Step 4: Migrate custom dictionaries
                await self.migrate_custom_dictionaries(session)

                # Step 5: Update GitHub documents
                await self.migrate_github_documents(session)

                self.log("Migration completed successfully!")
                return True

        except Exception as e:
            self.log(f"Migration failed: {e}")
            if not self.dry_run:
                self.log("Rolling back transaction...")
                await session.rollback()
            return False

    async def migrate_custom_dictionaries(self, session):
        """Migrate custom dictionaries to folder-based system."""
        self.log("Migrating custom dictionaries...")

        if not self.dry_run:
            # Add root_folder_path column
            await session.execute(text("""
                ALTER TABLE custom_dictionaries
                ADD COLUMN root_folder_path VARCHAR(255)
            """))

            # Populate from categories
            await session.execute(text("""
                UPDATE custom_dictionaries
                SET root_folder_path = '/' || categories.name
                FROM categories
                WHERE custom_dictionaries.category_id = categories.id
            """))

            # Add constraints
            await session.execute(text("""
                ALTER TABLE custom_dictionaries
                ADD CONSTRAINT uq_user_folder_dictionary_word
                UNIQUE (user_id, root_folder_path, word)
            """))
            await session.commit()
        else:
            self.log("DRY RUN: Would migrate custom dictionaries")

    async def migrate_github_documents(self, session):
        """Migrate GitHub documents to proper folder structure."""
        self.log("Migrating GitHub documents...")

        if not self.dry_run:
            await session.execute(text("""
                UPDATE documents
                SET folder_path = CONCAT(
                    '/GitHub/',
                    COALESCE(
                        (SELECT CONCAT(gr.owner, '-', gr.name)
                         FROM github_repositories gr
                         WHERE gr.id = documents.github_repository_id),
                        'unknown-repo'
                    ),
                    '/',
                    COALESCE(documents.github_branch, 'main'),
                    CASE
                        WHEN documents.github_file_path IS NOT NULL
                            AND documents.github_file_path != documents.name
                        THEN CONCAT('/', SUBSTRING(documents.github_file_path FROM 1 FOR
                            LENGTH(documents.github_file_path) - LENGTH(documents.name) - 1))
                        ELSE ''
                    END
                )
                WHERE github_repository_id IS NOT NULL
            """))
            await session.commit()
        else:
            self.log("DRY RUN: Would migrate GitHub documents")

    async def validate_migration(self):
        """Validate that migration was successful."""
        self.log("Validating migration results...")

        async with self.session_factory() as session:
            # Check that all documents have folder_path
            null_paths_result = await session.execute(
                text("SELECT COUNT(*) FROM documents WHERE folder_path IS NULL")
            )
            null_paths = null_paths_result.scalar()

            if null_paths > 0:
                self.log(f"ERROR: {null_paths} documents have NULL folder_path")
                return False

            # Check folder path format
            invalid_paths_result = await session.execute(
                text("SELECT COUNT(*) FROM documents WHERE folder_path NOT LIKE '/%'")
            )
            invalid_paths = invalid_paths_result.scalar()

            if invalid_paths > 0:
                self.log(f"ERROR: {invalid_paths} documents have invalid folder_path format")
                return False

            self.log("Migration validation passed!")
            return True

    async def create_rollback_script(self):
        """Create a rollback script for the migration."""
        rollback_script = """
-- Rollback script for folder hierarchy migration
-- Run this if you need to revert the migration

-- Remove new constraints
ALTER TABLE documents DROP CONSTRAINT IF EXISTS uq_user_folder_name;
ALTER TABLE custom_dictionaries DROP CONSTRAINT IF EXISTS uq_user_folder_dictionary_word;

-- Remove indexes
DROP INDEX IF EXISTS idx_documents_folder_path;

-- Remove new columns
ALTER TABLE documents DROP COLUMN IF EXISTS folder_path;
ALTER TABLE custom_dictionaries DROP COLUMN IF EXISTS root_folder_path;

-- Make category_id required again
ALTER TABLE documents ALTER COLUMN category_id SET NOT NULL;
"""

        with open(f"rollback_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql", "w") as f:
            f.write(rollback_script)

        self.log("Rollback script created")

async def main():
    parser = argparse.ArgumentParser(description="Production folder hierarchy migration")
    parser.add_argument("--dry-run", action="store_true", help="Run migration in dry-run mode")
    parser.add_argument("--database-url", help="Database URL (uses env var if not provided)")
    args = parser.parse_args()

    database_url = args.database_url or get_database_url()

    migration = ProductionMigration(database_url, dry_run=args.dry_run)

    # Create backup reminder
    await migration.create_backup()

    if not args.dry_run:
        confirm = input("Are you sure you want to run the migration? Type 'YES' to confirm: ")
        if confirm != "YES":
            print("Migration cancelled")
            return

    # Run migration
    success = await migration.run_migration()

    if success and not args.dry_run:
        # Validate results
        validation_success = await migration.validate_migration()
        if validation_success:
            await migration.create_rollback_script()
            print("Migration completed successfully!")
        else:
            print("Migration validation failed!")
            sys.exit(1)
    elif success and args.dry_run:
        print("Dry run completed successfully!")
    else:
        print("Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
```

### Migration Monitoring Script

**File**: `backend/scripts/monitor_migration.py`

```python
#!/usr/bin/env python3
"""
Monitor migration progress and health.
"""

import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.database import get_database_url

class MigrationMonitor:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = create_async_engine(database_url)
        self.session_factory = sessionmaker(self.engine, class_=AsyncSession)

    async def check_migration_status(self):
        """Check the status of the folder migration."""
        async with self.session_factory() as session:
            # Check if folder_path column exists
            folder_path_exists = await session.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_name = 'documents' AND column_name = 'folder_path'
            """))
            has_folder_path = folder_path_exists.scalar() > 0

            if not has_folder_path:
                return {
                    "status": "not_migrated",
                    "message": "Migration has not been run"
                }

            # Check migration completeness
            total_docs = await session.execute(text("SELECT COUNT(*) FROM documents"))
            total_count = total_docs.scalar()

            null_paths = await session.execute(text("""
                SELECT COUNT(*) FROM documents WHERE folder_path IS NULL
            """))
            null_count = null_paths.scalar()

            invalid_paths = await session.execute(text("""
                SELECT COUNT(*) FROM documents WHERE folder_path NOT LIKE '/%'
            """))
            invalid_count = invalid_paths.scalar()

            if null_count > 0 or invalid_count > 0:
                return {
                    "status": "partial",
                    "message": f"Migration incomplete: {null_count} null paths, {invalid_count} invalid paths",
                    "total_documents": total_count,
                    "issues": null_count + invalid_count
                }

            return {
                "status": "complete",
                "message": "Migration completed successfully",
                "total_documents": total_count
            }

    async def get_migration_stats(self):
        """Get detailed statistics about the migration."""
        async with self.session_factory() as session:
            # Folder distribution
            folder_stats = await session.execute(text("""
                SELECT folder_path, COUNT(*) as doc_count
                FROM documents
                GROUP BY folder_path
                ORDER BY doc_count DESC
            """))
            folder_distribution = dict(folder_stats.all())

            # GitHub documents
            github_docs = await session.execute(text("""
                SELECT COUNT(*) FROM documents
                WHERE github_repository_id IS NOT NULL
            """))
            github_count = github_docs.scalar()

            # Custom dictionary stats
            dict_stats = await session.execute(text("""
                SELECT
                    COUNT(*) as total_words,
                    COUNT(CASE WHEN root_folder_path IS NULL THEN 1 END) as global_words,
                    COUNT(CASE WHEN root_folder_path IS NOT NULL THEN 1 END) as folder_words
                FROM custom_dictionaries
            """))
            dict_data = dict_stats.first()

            return {
                "folder_distribution": folder_distribution,
                "github_documents": github_count,
                "dictionary_stats": {
                    "total_words": dict_data.total_words,
                    "global_words": dict_data.global_words,
                    "folder_words": dict_data.folder_words
                }
            }

async def main():
    monitor = MigrationMonitor(get_database_url())

    status = await monitor.check_migration_status()
    print(f"Migration Status: {status['status']}")
    print(f"Message: {status['message']}")

    if status['status'] in ['complete', 'partial']:
        print(f"Total Documents: {status['total_documents']}")

        if status['status'] == 'partial':
            print(f"Issues Found: {status['issues']}")

    if status['status'] == 'complete':
        print("\nDetailed Statistics:")
        stats = await monitor.get_migration_stats()

        print(f"GitHub Documents: {stats['github_documents']}")
        print(f"Dictionary Words: {stats['dictionary_stats']['total_words']} total")
        print(f"  - Global: {stats['dictionary_stats']['global_words']}")
        print(f"  - Folder-specific: {stats['dictionary_stats']['folder_words']}")

        print("\nTop Folders by Document Count:")
        for folder, count in list(stats['folder_distribution'].items())[:10]:
            print(f"  {folder}: {count} documents")

if __name__ == "__main__":
    asyncio.run(main())
```

## Frontend Testing

### End-to-End Tests

**File**: `frontend/src/tests/e2e/folder_migration.spec.js`

```javascript
// Playwright E2E tests for folder migration
const { test, expect } = require('@playwright/test');

test.describe('Folder Migration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login and setup
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/editor');
  });

  test('should display documents in folder structure', async ({ page }) => {
    // Open file browser
    await page.click('[data-testid="open-file-button"]');

    // Should show unified file browser
    await expect(page.locator('.unified-file-browser')).toBeVisible();

    // Should show folder tree
    await expect(page.locator('.file-tree')).toBeVisible();

    // Should show root folders
    await expect(page.locator('text=Root')).toBeVisible();
  });

  test('should navigate folder hierarchy', async ({ page }) => {
    await page.click('[data-testid="open-file-button"]');

    // Click on a folder in the tree
    await page.click('.file-tree-node:has-text("Work")');

    // Should update current path
    await expect(page.locator('.folder-breadcrumb')).toContainText('Work');

    // Should show documents in that folder
    await expect(page.locator('.file-list')).toBeVisible();
  });

  test('should create document in folder', async ({ page }) => {
    // Create new document
    await page.click('[data-testid="new-document-button"]');

    // Should show folder selection
    const folderSelect = page.locator('[data-testid="folder-select"]');
    await folderSelect.selectOption('/TestFolder');

    // Fill document details
    await page.fill('[data-testid="document-name"]', 'test-folder-doc.md');
    await page.click('[data-testid="create-button"]');

    // Should create document in correct folder
    await expect(page.locator('text=Document created successfully')).toBeVisible();
  });

  test('should move document between folders', async ({ page }) => {
    // Open existing document
    await page.click('[data-testid="open-file-button"]');
    await page.click('.file-list-item:first-child');
    await page.click('[data-testid="open-selected"]');

    // Move document
    await page.click('[data-testid="document-menu"]');
    await page.click('[data-testid="move-document"]');

    // Select new folder
    const newFolderSelect = page.locator('[data-testid="new-folder-select"]');
    await newFolderSelect.selectOption('/Archive');
    await page.click('[data-testid="move-confirm"]');

    // Should show success message
    await expect(page.locator('text=Document moved successfully')).toBeVisible();
  });

  test('should search within folders', async ({ page }) => {
    await page.click('[data-testid="open-file-button"]');

    // Navigate to specific folder
    await page.click('.file-tree-node:has-text("Work")');

    // Search within folder
    await page.fill('[data-testid="search-input"]', 'meeting');
    await page.click('[data-testid="search-button"]');

    // Should show filtered results
    await expect(page.locator('.file-list-item')).toBeVisible();
    await expect(page.locator('.file-list-item:has-text("meeting")')).toBeVisible();
  });

  test('should manage custom dictionaries per folder', async ({ page }) => {
    // Open dictionary manager
    await page.click('[data-testid="dictionary-button"]');

    // Should show dictionary modal
    await expect(page.locator('.dictionary-manager')).toBeVisible();

    // Switch to folder dictionary tab
    await page.click('[data-testid="folder-dictionary-tab"]');

    // Add word to folder dictionary
    await page.fill('[data-testid="new-word-input"]', 'testword');
    await page.click('[data-testid="add-to-folder"]');

    // Should show success
    await expect(page.locator('text=Word added successfully')).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing Script

**File**: `backend/tests/performance/test_folder_performance.py`

```python
import asyncio
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
import requests

class FolderPerformanceTest:
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {auth_token}"}
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def test_folder_structure_performance(self, iterations: int = 100):
        """Test folder structure endpoint performance."""
        times = []

        for _ in range(iterations):
            start_time = time.time()
            response = self.session.get(f"{self.base_url}/documents/folders")
            end_time = time.time()

            if response.status_code == 200:
                times.append(end_time - start_time)

        return {
            "endpoint": "folder_structure",
            "iterations": len(times),
            "avg_time": statistics.mean(times),
            "median_time": statistics.median(times),
            "min_time": min(times),
            "max_time": max(times),
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0
        }

    def test_folder_documents_performance(self, folder_path: str, iterations: int = 100):
        """Test folder documents endpoint performance."""
        times = []

        for _ in range(iterations):
            start_time = time.time()
            response = self.session.get(
                f"{self.base_url}/documents/folders/{folder_path.lstrip('/')}"
            )
            end_time = time.time()

            if response.status_code == 200:
                times.append(end_time - start_time)

        return {
            "endpoint": f"folder_documents_{folder_path}",
            "iterations": len(times),
            "avg_time": statistics.mean(times),
            "median_time": statistics.median(times),
            "min_time": min(times),
            "max_time": max(times),
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0
        }

    def test_search_performance(self, query: str, iterations: int = 50):
        """Test search endpoint performance."""
        times = []

        for _ in range(iterations):
            start_time = time.time()
            response = self.session.get(
                f"{self.base_url}/documents/search",
                params={"q": query}
            )
            end_time = time.time()

            if response.status_code == 200:
                times.append(end_time - start_time)

        return {
            "endpoint": f"search_{query}",
            "iterations": len(times),
            "avg_time": statistics.mean(times),
            "median_time": statistics.median(times),
            "min_time": min(times),
            "max_time": max(times),
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0
        }

    def run_full_performance_suite(self):
        """Run complete performance test suite."""
        results = []

        print("Running folder structure performance test...")
        results.append(self.test_folder_structure_performance())

        print("Running folder documents performance test...")
        results.append(self.test_folder_documents_performance("/Work"))
        results.append(self.test_folder_documents_performance("/GitHub"))

        print("Running search performance test...")
        results.append(self.test_search_performance("test"))
        results.append(self.test_search_performance("document"))

        return results

def print_performance_results(results):
    """Print performance test results in a readable format."""
    print("\n" + "="*60)
    print("FOLDER MIGRATION PERFORMANCE TEST RESULTS")
    print("="*60)

    for result in results:
        print(f"\nEndpoint: {result['endpoint']}")
        print(f"Iterations: {result['iterations']}")
        print(f"Average Time: {result['avg_time']:.3f}s")
        print(f"Median Time: {result['median_time']:.3f}s")
        print(f"Min Time: {result['min_time']:.3f}s")
        print(f"Max Time: {result['max_time']:.3f}s")
        print(f"Std Deviation: {result['std_dev']:.3f}s")

        # Performance thresholds
        if result['avg_time'] > 1.0:
            print("⚠️  WARNING: Average response time exceeds 1 second")
        elif result['avg_time'] > 0.5:
            print("⚡ NOTICE: Average response time exceeds 0.5 seconds")
        else:
            print("✅ GOOD: Performance within acceptable range")

if __name__ == "__main__":
    # Configure these for your environment
    BASE_URL = "http://localhost:8000"
    AUTH_TOKEN = "your_test_token_here"

    tester = FolderPerformanceTest(BASE_URL, AUTH_TOKEN)
    results = tester.run_full_performance_suite()
    print_performance_results(results)
```

## Success Criteria

- [ ] All database migration tests pass
- [ ] API integration tests verify folder operations work correctly
- [ ] Frontend E2E tests confirm UI functionality
- [ ] Performance tests show acceptable response times
- [ ] Production migration script runs successfully in dry-run mode
- [ ] Migration monitoring tools provide accurate status information
- [ ] Rollback procedures are tested and documented
- [ ] All edge cases are covered in test suite

## Deployment Checklist

### Pre-Migration Checklist

- [ ] Database backup created and verified
- [ ] Migration scripts tested in staging environment
- [ ] Performance baseline established
- [ ] Rollback procedures tested
- [ ] Monitoring tools configured
- [ ] Team notified of migration schedule

### Migration Day Checklist

- [ ] Final database backup created
- [ ] Application put in maintenance mode
- [ ] Migration script executed
- [ ] Migration validation completed
- [ ] Performance tests run
- [ ] Application brought back online
- [ ] User acceptance testing performed
- [ ] Monitoring dashboards checked

### Post-Migration Checklist

- [ ] All functionality verified working
- [ ] Performance metrics within acceptable range
- [ ] User feedback collected
- [ ] Documentation updated
- [ ] Legacy code cleanup scheduled
- [ ] Migration marked as complete

## Final Notes

This completes the comprehensive folder hierarchy migration plan. The system will be transformed from a simple category-based organization to a modern folder-based hierarchy that provides:

1. **Unified UI Experience** - Same interface for local and GitHub documents
2. **Natural Organization** - Folder structure that matches user expectations
3. **Scalable Architecture** - Foundation for future enhancements
4. **Backward Compatibility** - Smooth transition without data loss
5. **Enhanced GitHub Integration** - Natural mapping of repository structure

The migration is designed to be safe, reversible, and thoroughly tested to ensure a successful transition to the new system.

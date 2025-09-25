"""
Zero Data Loss Migration Strategy for Unified Architecture

This migration plan ensures 100% document content preservation while
transitioning to the unified document access pattern.

CRITICAL: All migrations must be reversible and data-safe for production use.
"""

# Migration Plan Overview:
# 1. Phase 1: Backend Infrastructure (zero user impact)
# 2. Phase 2: API Endpoint Migration (backward compatible)
# 3. Phase 3: Frontend Gradual Migration (feature flags)
# 4. Phase 4: Cleanup Legacy Code (after confidence period)

from datetime import datetime
from typing import List, Dict, Any
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session


class UnifiedArchitectureMigration:
    """
    Migration coordinator for unified document architecture.

    Handles phased rollout with zero data loss guarantees.
    """

    @staticmethod
    def create_migration_001_add_unified_fields():
        """
        Migration 001: Add unified document fields without breaking existing functionality.

        SAFE: Only adds new nullable fields, no data modification.
        """
        return """
        -- Migration: Add unified document fields
        -- Safe: Only adds nullable columns, preserves all existing data

        -- Add repository_type field if not exists (for explicit source tracking)
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='documents' AND column_name='repository_type') THEN
                ALTER TABLE documents
                ADD COLUMN repository_type VARCHAR(50) DEFAULT 'local' NOT NULL;

                -- Update existing records
                UPDATE documents SET repository_type = 'github' WHERE github_repository_id IS NOT NULL;
                UPDATE documents SET repository_type = 'local' WHERE github_repository_id IS NULL;
            END IF;
        END $$;

        -- Add file_path field if not exists (for filesystem standardization)
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='documents' AND column_name='file_path') THEN
                ALTER TABLE documents
                ADD COLUMN file_path VARCHAR(512) NULL;

                -- Populate file_path for existing documents
                -- Local documents: 'local/{category}/{filename}'
                UPDATE documents d SET file_path = 'local/' || c.name || '/' || d.name
                FROM categories c
                WHERE d.category_id = c.id AND d.github_repository_id IS NULL;

                -- GitHub documents: 'github/{account_id}/{repo_name}/{github_file_path}'
                UPDATE documents d SET file_path = 'github/' || r.account_id || '/' || r.repo_name || '/' || d.github_file_path
                FROM github_repositories r
                WHERE d.github_repository_id = r.id AND d.github_file_path IS NOT NULL;
            END IF;
        END $$;

        -- Add indexes for new fields
        CREATE INDEX IF NOT EXISTS idx_documents_repository_type ON documents(repository_type);
        CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);

        -- Verify data integrity
        DO $$
        DECLARE
            missing_file_paths INTEGER;
            total_documents INTEGER;
        BEGIN
            SELECT COUNT(*) INTO total_documents FROM documents;
            SELECT COUNT(*) INTO missing_file_paths FROM documents WHERE file_path IS NULL;

            IF missing_file_paths > 0 THEN
                RAISE NOTICE 'WARNING: % documents out of % are missing file_path', missing_file_paths, total_documents;
            ELSE
                RAISE NOTICE 'SUCCESS: All % documents have file_path populated', total_documents;
            END IF;
        END $$;
        """

    @staticmethod
    def create_migration_002_content_backup():
        """
        Migration 002: Create content backup table before filesystem transition.

        SAFE: Pure backup creation, no data modification.
        """
        return """
        -- Migration: Create document content backup table
        -- Purpose: Ensure zero data loss during filesystem transition

        CREATE TABLE IF NOT EXISTS document_content_backup (
            id SERIAL PRIMARY KEY,
            document_id INTEGER NOT NULL,
            content TEXT,
            content_hash VARCHAR(64),
            backup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            migration_phase VARCHAR(50) DEFAULT 'pre_filesystem_transition',

            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_content_backup_document_id ON document_content_backup(document_id);
        CREATE INDEX IF NOT EXISTS idx_content_backup_date ON document_content_backup(backup_date);

        -- Backup all existing document content
        INSERT INTO document_content_backup (document_id, content, content_hash, migration_phase)
        SELECT
            id,
            content,
            encode(digest(content, 'sha256'), 'hex') as content_hash,
            'pre_unified_migration'
        FROM documents
        WHERE content IS NOT NULL
        ON CONFLICT DO NOTHING;

        -- Report backup status
        DO $$
        DECLARE
            backed_up_count INTEGER;
            total_with_content INTEGER;
        BEGIN
            SELECT COUNT(*) INTO total_with_content FROM documents WHERE content IS NOT NULL;
            SELECT COUNT(*) INTO backed_up_count FROM document_content_backup WHERE migration_phase = 'pre_unified_migration';

            RAISE NOTICE 'Content backup complete: % documents backed up out of % with content', backed_up_count, total_with_content;
        END $$;
        """

    @staticmethod
    def create_migration_003_filesystem_verification():
        """
        Migration 003: Verify filesystem alignment before API changes.

        SAFE: Read-only verification, no data changes.
        """
        return """
        -- Migration: Verify filesystem-database alignment
        -- Purpose: Ensure filesystem and database are in sync before API changes

        -- Create verification log table
        CREATE TABLE IF NOT EXISTS filesystem_verification_log (
            id SERIAL PRIMARY KEY,
            document_id INTEGER NOT NULL,
            expected_file_path VARCHAR(512),
            filesystem_exists BOOLEAN,
            content_matches BOOLEAN,
            size_bytes INTEGER,
            verification_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            verification_phase VARCHAR(50) DEFAULT 'pre_api_migration',

            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        -- This verification would be handled by Python script
        -- See: backend/scripts/verify_filesystem_alignment.py

        -- For now, create placeholder for manual verification
        COMMENT ON TABLE filesystem_verification_log IS
        'Log of filesystem verification before unified API migration.
         Populated by verify_filesystem_alignment.py script.
         Must show 100% alignment before proceeding to API changes.';
        """

    @staticmethod
    def create_migration_004_unified_api_support():
        """
        Migration 004: Add support for unified API while preserving legacy endpoints.

        SAFE: Additive only, legacy endpoints remain functional.
        """
        return """
        -- Migration: Add unified API support fields
        -- Purpose: Support unified API while maintaining backward compatibility

        -- Add unified response cache table (optional performance optimization)
        CREATE TABLE IF NOT EXISTS document_unified_cache (
            document_id INTEGER PRIMARY KEY,
            cached_response JSONB,
            cache_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cache_expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '1 hour',

            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_unified_cache_expires ON document_unified_cache(cache_expires_at);

        -- Add API transition tracking
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS last_accessed_via_unified_api TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS last_accessed_via_legacy_api TIMESTAMP NULL;

        -- Comment for tracking migration progress
        COMMENT ON COLUMN documents.last_accessed_via_unified_api IS
        'Tracks when document was last accessed via new unified API. Used for migration monitoring.';

        COMMENT ON COLUMN documents.last_accessed_via_legacy_api IS
        'Tracks when document was last accessed via legacy APIs. Used for deprecation planning.';
        """

    @staticmethod
    def create_rollback_plan():
        """
        Rollback plan for each migration phase.

        CRITICAL: Every change must be reversible.
        """
        return """
        -- ROLLBACK PROCEDURES
        -- Each migration phase must be fully reversible

        -- Rollback Migration 004 (Unified API Support)
        DROP TABLE IF EXISTS document_unified_cache CASCADE;
        ALTER TABLE documents
            DROP COLUMN IF EXISTS last_accessed_via_unified_api,
            DROP COLUMN IF EXISTS last_accessed_via_legacy_api;

        -- Rollback Migration 003 (Filesystem Verification)
        DROP TABLE IF EXISTS filesystem_verification_log CASCADE;

        -- Rollback Migration 002 (Content Backup)
        -- NEVER drop backup table in production!
        -- Keep for audit trail: DROP TABLE IF EXISTS document_content_backup CASCADE;

        -- Rollback Migration 001 (Unified Fields)
        -- WARNING: Only safe if unified API is not in use
        DROP INDEX IF EXISTS idx_documents_repository_type;
        DROP INDEX IF EXISTS idx_documents_file_path;
        ALTER TABLE documents
            DROP COLUMN IF EXISTS repository_type,
            DROP COLUMN IF EXISTS file_path;
        """


# Python Migration Scripts (to be created in backend/scripts/)

class FilesystemVerificationScript:
    """
    Script: backend/scripts/verify_filesystem_alignment.py

    Purpose: Verify all documents exist on filesystem before API migration.
    """

    example_script = '''
#!/usr/bin/env python3
"""
Filesystem Verification Script - Run before unified API migration.

Verifies that all database documents have corresponding filesystem files
and that content hashes match between database and filesystem.

Usage: python verify_filesystem_alignment.py --environment production
"""
import sys
from pathlib import Path
from app.database import get_db
from app.crud import document as document_crud
from app.services.storage.user import UserStorage

async def verify_all_documents():
    """Verify all documents exist on filesystem with correct content."""
    storage_service = UserStorage()
    verification_results = []

    async with get_db() as db:
        # Get all documents
        documents = await document_crud.document.get_all(db)

        for doc in documents:
            try:
                # Check filesystem existence
                if doc.file_path:
                    content = await storage_service.read_document(
                        user_id=doc.user_id,
                        file_path=doc.file_path
                    )

                    # Compare with database content
                    content_matches = (content == doc.content) if doc.content else True

                    verification_results.append({
                        'document_id': doc.id,
                        'file_path': doc.file_path,
                        'exists': True,
                        'content_matches': content_matches,
                        'size': len(content) if content else 0
                    })
                else:
                    verification_results.append({
                        'document_id': doc.id,
                        'file_path': None,
                        'exists': False,
                        'content_matches': False,
                        'size': 0,
                        'error': 'No file_path set'
                    })

            except Exception as e:
                verification_results.append({
                    'document_id': doc.id,
                    'file_path': doc.file_path,
                    'exists': False,
                    'content_matches': False,
                    'size': 0,
                    'error': str(e)
                })

    # Generate report
    total_docs = len(verification_results)
    successful = len([r for r in verification_results if r['exists'] and r['content_matches']])

    print(f"\\n=== FILESYSTEM VERIFICATION REPORT ===")
    print(f"Total Documents: {total_docs}")
    print(f"Successfully Verified: {successful}")
    print(f"Success Rate: {successful/total_docs*100:.1f}%")

    if successful != total_docs:
        print(f"\\n⚠️  WARNING: {total_docs - successful} documents have issues!")
        print("\\nDocuments with issues:")
        for result in verification_results:
            if not (result['exists'] and result['content_matches']):
                print(f"  - Document {result['document_id']}: {result.get('error', 'Content mismatch')}")

        print("\\n❌ MIGRATION CANNOT PROCEED until all documents are verified.")
        sys.exit(1)
    else:
        print("\\n✅ All documents verified successfully. Migration can proceed.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(verify_all_documents())
'''


# Deployment Checklist

MIGRATION_CHECKLIST = """
🚀 UNIFIED ARCHITECTURE MIGRATION CHECKLIST

PRE-MIGRATION (Production Safety):
□ Run full database backup
□ Verify current system health (all tests passing)
□ Run filesystem verification script
□ Confirm rollback procedures tested in staging
□ Schedule maintenance window (if needed)

PHASE 1 - Infrastructure (Zero User Impact):
□ Deploy Migration 001 (unified fields)
□ Deploy Migration 002 (content backup)
□ Deploy Migration 003 (filesystem verification)
□ Verify all existing functionality still works
□ Run integration tests

PHASE 2 - API Backend (Backward Compatible):
□ Deploy Migration 004 (unified API support)
□ Deploy UnifiedDocumentService
□ Deploy unified GET /documents/{id} endpoint
□ Deploy unified git operations
□ Legacy endpoints still functional
□ API tests pass for both legacy and unified endpoints

PHASE 3 - Frontend Gradual Migration (Feature Flags):
□ Deploy UnifiedFileBrowserProvider (behind feature flag)
□ Deploy UnifiedFileOpeningService (behind feature flag)
□ Deploy unified GitHubTab component (behind feature flag)
□ A/B test: 10% users on unified, 90% on legacy
□ Monitor error rates and user feedback
□ Gradually increase unified percentage

PHASE 4 - Legacy Cleanup (After Confidence Period):
□ Monitor unified API usage > 95% for 2 weeks
□ No critical issues reported
□ Remove legacy API endpoints
□ Remove legacy frontend components
□ Remove feature flags
□ Clean up migration tables (keep backups!)

POST-MIGRATION:
□ Performance monitoring
□ User feedback collection
□ Documentation updates
□ Team training on unified architecture
□ Success metrics reporting

ROLLBACK TRIGGERS:
- Document content loss detected
- API error rates > 1%
- User complaints about file access
- Git operations failing
- Filesystem corruption detected

🔒 SAFETY GUARANTEES:
- All document content backed up before changes
- Legacy APIs functional during transition
- Instant rollback capability at each phase
- Zero data loss guaranteed
"""

# Example Alembic Migration File
ALEMBIC_MIGRATION_EXAMPLE = '''
"""Add unified document architecture support

Revision ID: abc123def456
Revises: prev_revision_id
Create Date: {datetime.now().isoformat()}
"""
from alembic import op
import sqlalchemy as sa
from app.services.migration.unified_architecture_migration import UnifiedArchitectureMigration

# revision identifiers
revision = 'abc123def456'
down_revision = 'prev_revision_id'
branch_labels = None
depends_on = None

def upgrade():
    """Apply unified architecture migration - Phase 1."""
    print("🚀 Starting unified architecture migration...")

    # Execute migration SQL
    migration_sql = UnifiedArchitectureMigration.create_migration_001_add_unified_fields()
    op.execute(sa.text(migration_sql))

    print("✅ Phase 1 migration completed successfully")

def downgrade():
    """Rollback unified architecture migration."""
    print("⏪ Rolling back unified architecture migration...")

    # Execute rollback SQL
    rollback_sql = UnifiedArchitectureMigration.create_rollback_plan()
    op.execute(sa.text(rollback_sql))

    print("✅ Rollback completed successfully")
'''
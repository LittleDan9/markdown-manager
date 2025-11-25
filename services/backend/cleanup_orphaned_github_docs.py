#!/usr/bin/env python3
"""
Cleanup script for orphaned GitHub documents.

When a GitHub account is deleted, documents imported from that account
become orphaned - they still have GitHub metadata but no valid account.
This script identifies and optionally removes these orphaned documents.
"""

import asyncio
import sys
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def find_orphaned_github_documents():
    """Find documents with GitHub metadata but no valid GitHub account."""
    async with AsyncSessionLocal() as db:
        # Find documents with GitHub repository IDs that don't have valid accounts
        query = text("""
            SELECT
                d.id,
                d.name,
                d.folder_path,
                d.github_repository_id,
                d.github_file_path,
                d.github_branch,
                d.created_at,
                d.updated_at,
                r.repo_name,
                r.repo_owner,
                a.username as account_username,
                a.is_active as account_active
            FROM documents d
            LEFT JOIN github_repositories r ON d.github_repository_id = r.id
            LEFT JOIN github_accounts a ON r.account_id = a.id
            WHERE d.github_repository_id IS NOT NULL
            AND (a.id IS NULL OR a.is_active = false)
            ORDER BY d.folder_path, d.name
        """)
        
        result = await db.execute(query)
        orphaned_docs = result.fetchall()
        
        return orphaned_docs


async def cleanup_orphaned_documents(document_ids: list[int], dry_run: bool = True):
    """Remove orphaned GitHub documents."""
    if not document_ids:
        print("No documents to clean up.")
        return
    
    async with AsyncSessionLocal() as db:
        if dry_run:
            print(f"\n[DRY RUN] Would delete {len(document_ids)} orphaned documents")
            return
        
        # Delete the orphaned documents
        placeholders = ','.join(['?' for _ in document_ids])
        delete_query = text(f"DELETE FROM documents WHERE id IN ({placeholders})")
        
        result = await db.execute(delete_query, document_ids)
        await db.commit()
        
        print(f"✅ Deleted {result.rowcount} orphaned GitHub documents")


async def main():
    print("🔍 Scanning for orphaned GitHub documents...")
    
    orphaned_docs = await find_orphaned_github_documents()
    
    if not orphaned_docs:
        print("✅ No orphaned GitHub documents found!")
        return
    
    print(f"\n📋 Found {len(orphaned_docs)} orphaned GitHub documents:")
    print("-" * 80)
    
    orphaned_ids = []
    for doc in orphaned_docs:
        print(f"ID: {doc.id:3d} | {doc.name:30s} | {doc.folder_path or 'No folder'}")
        print(f"     Repository: {doc.repo_owner}/{doc.repo_name} (ID: {doc.github_repository_id})")
        print(f"     Account: {doc.account_username or 'MISSING'} (Active: {doc.account_active})")
        print(f"     File: {doc.github_file_path}")
        print()
        orphaned_ids.append(doc.id)
    
    print("-" * 80)
    print("\n💡 These documents have GitHub metadata but no valid GitHub account.")
    print("   This typically happens when a GitHub account is disconnected or deleted.")
    print("   They cannot be synced and may cause import conflicts.")
    
    # Ask user what to do
    while True:
        choice = input(f"\n❓ Delete these {len(orphaned_ids)} orphaned documents? (y/N/dry-run): ").strip().lower()
        
        if choice in ['n', 'no', '']:
            print("❌ Cleanup cancelled.")
            break
        elif choice in ['y', 'yes']:
            await cleanup_orphaned_documents(orphaned_ids, dry_run=False)
            break
        elif choice in ['dry-run', 'dry', 'd']:
            await cleanup_orphaned_documents(orphaned_ids, dry_run=True)
        else:
            print("Please enter 'y' (yes), 'n' (no), or 'dry-run'")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n❌ Cleanup cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        sys.exit(1)
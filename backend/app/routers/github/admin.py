"""GitHub Admin endpoints for administrative operations."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter()


@router.get("/orphaned-documents")
async def get_orphaned_github_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get list of orphaned GitHub documents (documents with GitHub metadata but no valid account)."""
    
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
        AND d.user_id = :user_id
        AND (a.id IS NULL OR a.is_active = false)
        ORDER BY d.folder_path, d.name
    """)
    
    result = await db.execute(query, {"user_id": current_user.id})
    orphaned_docs = result.fetchall()
    
    # Convert to list of dictionaries
    docs_list = []
    for doc in orphaned_docs:
        docs_list.append({
            "id": doc.id,
            "name": doc.name,
            "folder_path": doc.folder_path,
            "github_repository_id": doc.github_repository_id,
            "github_file_path": doc.github_file_path,
            "github_branch": doc.github_branch,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            "repo_name": doc.repo_name,
            "repo_owner": doc.repo_owner,
            "account_username": doc.account_username,
            "account_active": doc.account_active,
        })
    
    return docs_list


@router.delete("/orphaned-documents")
async def cleanup_orphaned_github_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete all orphaned GitHub documents for the current user."""
    
    # First, get the list of orphaned documents
    query = text("""
        SELECT d.id
        FROM documents d
        LEFT JOIN github_repositories r ON d.github_repository_id = r.id
        LEFT JOIN github_accounts a ON r.account_id = a.id
        WHERE d.github_repository_id IS NOT NULL
        AND d.user_id = :user_id
        AND (a.id IS NULL OR a.is_active = false)
    """)
    
    result = await db.execute(query, {"user_id": current_user.id})
    orphaned_ids = [row.id for row in result.fetchall()]
    
    if not orphaned_ids:
        return {"message": "No orphaned GitHub documents found", "deleted_count": 0}
    
    # Delete the orphaned documents
    delete_query = text("""
        DELETE FROM documents
        WHERE id = ANY(:doc_ids) AND user_id = :user_id
    """)
    
    delete_result = await db.execute(delete_query, {
        "doc_ids": orphaned_ids,
        "user_id": current_user.id
    })
    await db.commit()
    
    return {
        "message": f"Successfully deleted {delete_result.rowcount} orphaned GitHub documents",  # type: ignore
        "deleted_count": delete_result.rowcount,  # type: ignore
        "deleted_ids": orphaned_ids
    }
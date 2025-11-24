"""
Recent documents API endpoints.
Handles tracking and retrieval of recently opened documents.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document

router = APIRouter()


@router.get("/recent", response_model=List[Document])
async def get_recent_documents(
    limit: int = Query(6, ge=1, le=20, description="Number of recent documents to return"),
    source: Optional[str] = Query(None, description="Filter by source: 'local' or 'github'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recently opened documents for the authenticated user.

    Returns up to `limit` recently opened documents, optionally filtered by source:
    - source='local': Only local documents (non-GitHub)
    - source='github': Only GitHub documents
    - source=None: All documents

    Documents are ordered by last_opened_at desc.
    """
    from .response_utils import create_document_list_response

    orm_documents = await document_crud.document.get_recent_documents(
        db=db, user_id=current_user.id, limit=limit, source=source
    )

    return await create_document_list_response(
        documents=orm_documents,
        user_id=current_user.id
    )


@router.get("/recent/local", response_model=List[Document])
async def get_recent_local_documents(
    limit: int = Query(3, ge=1, le=10, description="Number of recent local documents to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recently opened local documents (non-GitHub) for the authenticated user."""
    from .response_utils import create_document_list_response

    orm_documents = await document_crud.document.get_recent_documents(
        db=db, user_id=current_user.id, limit=limit, source="local"
    )

    return await create_document_list_response(
        documents=orm_documents,
        user_id=current_user.id
    )


@router.get("/recent/github", response_model=List[Document])
async def get_recent_github_documents(
    limit: int = Query(3, ge=1, le=10, description="Number of recent GitHub documents to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recently opened GitHub documents for the authenticated user."""
    from .response_utils import create_document_list_response

    orm_documents = await document_crud.document.get_recent_documents(
        db=db, user_id=current_user.id, limit=limit, source="github"
    )

    return await create_document_list_response(
        documents=orm_documents,
        user_id=current_user.id
    )


@router.put("/{document_id}/mark-opened")
async def mark_document_opened(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a document as recently opened by updating its last_opened_at timestamp."""
    document = await document_crud.document.mark_document_opened(
        db=db, document_id=document_id, user_id=current_user.id
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "message": "Document marked as opened",
        "last_opened_at": document.last_opened_at
    }

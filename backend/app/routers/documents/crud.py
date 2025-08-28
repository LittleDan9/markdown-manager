"""Document CRUD operations API endpoints (document-specific operations only)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    Document,
    DocumentUpdate,
)
from .docs import DOCUMENT_CRUD_DOCS

router = APIRouter()


@router.get("/{document_id}", response_model=Document, **DOCUMENT_CRUD_DOCS["get"])
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Get a specific document."""
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.put("/{document_id}", response_model=Document, **DOCUMENT_CRUD_DOCS["update"])
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Update a document."""
    document = await document_crud.document.update(
        db=db,
        document_id=document_id,
        user_id=current_user.id,
        name=document_data.name,
        content=document_data.content,
        category_id=document_data.category_id,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}", **DOCUMENT_CRUD_DOCS["delete"])
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a document."""
    success = await document_crud.document.delete(
        db=db, document_id=document_id, user_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}

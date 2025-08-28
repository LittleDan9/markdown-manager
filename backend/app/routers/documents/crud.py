"""Document CRUD operations API endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    Document,
    DocumentCreate,
    DocumentList,
    DocumentUpdate,
)
from .docs import DOCUMENT_CRUD_DOCS

router = APIRouter()


@router.get("/", response_model=DocumentList, **DOCUMENT_CRUD_DOCS["list"])
async def get_documents(
    category: Optional[str] = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentList:
    """Get all documents for the current user."""
    if category and category != "All":
        orm_documents = await document_crud.document.get_by_user_and_category(
            db=db, user_id=current_user.id, category=category, skip=skip, limit=limit
        )
    else:
        orm_documents = await document_crud.document.get_by_user(
            db=db, user_id=current_user.id, skip=skip, limit=limit
        )

    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=current_user.id
    )

    documents = [
        Document.model_validate(doc, from_attributes=True) for doc in orm_documents
    ]
    return DocumentList(
        documents=documents, total=len(documents), categories=categories
    )


@router.post("/", response_model=Document, **DOCUMENT_CRUD_DOCS["create"])
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Create a new document, enforcing uniqueness of (name, category) per user."""
    # Check for duplicate
    from sqlalchemy import select

    from app.models.document import Document

    existing_result = await db.execute(
        select(Document).filter(
            Document.user_id == current_user.id,
            Document.name == document_data.name,
            Document.category_id == document_data.category_id,
        )
    )
    existing_doc = existing_result.scalar_one_or_none()

    if existing_doc:
        from fastapi import HTTPException

        from app.schemas.document import Document as DocumentSchema
        from app.schemas.document import DocumentConflictError

        # Convert to response schema
        existing_document_schema = DocumentSchema.model_validate(
            existing_doc, from_attributes=True
        )

        # Create detailed error response with conflicting document
        conflict_detail = DocumentConflictError(
            detail="A document with this name and category already exists.",
            conflict_type="name_conflict",
            existing_document=existing_document_schema,
        )

        raise HTTPException(status_code=400, detail=conflict_detail.model_dump())

    document = await document_crud.document.create(
        db=db,
        user_id=current_user.id,
        name=document_data.name,
        content=document_data.content,
        category_id=document_data.category_id,
    )
    return document


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

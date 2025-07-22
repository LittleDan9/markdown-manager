"""Document management API endpoints."""
from typing import List, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document, DocumentCreate, DocumentList, DocumentUpdate

router = APIRouter()


@router.get("/current", response_model=Document | None)
async def get_current_document(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document | None:
    """Get the user's current document."""
    if current_user.current_doc_id:
        document = await document_crud.document.get(
            db=db, id=current_user.current_doc_id
        )
        if document and document.user_id == current_user.id:
            return Document.model_validate(document, from_attributes=True)
    return None


@router.post("/current", response_model=dict)
async def set_current_document(
    doc_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    """Set the user's current document ID."""
    # Validate document ownership
    document = await document_crud.document.get(db=db, id=doc_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=404, detail="Document not found or not owned by user"
        )
    # Update user
    await db.execute(
        sa.update(User).where(User.id == current_user.id).values(current_doc_id=doc_id)
    )
    await db.commit()
    return {"message": "Current document updated", "current_doc_id": doc_id}


@router.post("/categories/", response_model=List[str])
async def add_category(
    category: str = Body(..., embed=True, description="Category name to add"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Add a category for the current user."""
    success = await document_crud.document.add_category_for_user(
        db=db, user_id=int(current_user.id), category=category
    )
    if not success:
        raise HTTPException(status_code=400, detail="Category already exists")
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )
    return categories


@router.delete("/categories/{category}", response_model=List[str])
async def delete_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Delete a category for the current user. Moves all documents to 'General'."""
    affected = await document_crud.document.delete_category_for_user(
        db=db, user_id=int(current_user.id), category=category
    )
    if affected == 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete General or category not found"
        )
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )
    return categories


@router.get("/", response_model=DocumentList)
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


@router.post("/", response_model=Document)
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Create a new document, enforcing uniqueness of (name, category) per user."""
    # Check for duplicate
    from sqlalchemy import select

    from app.models.document import Document

    existing = await db.execute(
        select(Document).filter(
            Document.user_id == current_user.id,
            Document.name == document_data.name,
            Document.category == document_data.category,
        )
    )
    if existing.scalar_one_or_none():
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="A document with this name and category already exists.",
        )
    document = await document_crud.document.create(
        db=db,
        user_id=current_user.id,
        name=document_data.name,
        content=document_data.content,
        category=document_data.category,
    )
    return document


@router.get("/{document_id}", response_model=Document)
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


@router.put("/{document_id}", response_model=Document)
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
        category=document_data.category,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}")
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


@router.get("/categories/", response_model=List[str])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get all categories used by the current user."""
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=current_user.id
    )
    return categories

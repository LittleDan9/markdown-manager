"""Document management API endpoints."""
from typing import List, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document, DocumentCreate, DocumentList, DocumentUpdate, ShareResponse, SharedDocument

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
    delete_docs: bool = Query(
        False, alias="delete_docs", description="Delete all documents in this category"
    ),
    migrate_to: Optional[str] = Query(
        None, alias="migrate_to", description="Category to migrate documents to"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """
    Delete a category for the current user.
    If delete_docs=True, removes all documents in this category.
    Otherwise, moves documents to migrate_to (or 'General').
    """
    # Perform delete or migrate as requested
    affected = await document_crud.document.delete_category_for_user(
        db=db,
        user_id=int(current_user.id),
        category=category,
        delete_docs=delete_docs,
        migrate_to=migrate_to,
    )
    if affected == 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete General or category not found"
        )
    # Return updated category list
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

    existing_result = await db.execute(
        select(Document).filter(
            Document.user_id == current_user.id,
            Document.name == document_data.name,
            Document.category == document_data.category,
        )
    )
    existing_doc = existing_result.scalar_one_or_none()

    if existing_doc:
        from fastapi import HTTPException
        from app.schemas.document import DocumentConflictError, Document as DocumentSchema

        # Convert to response schema
        existing_document_schema = DocumentSchema.model_validate(existing_doc, from_attributes=True)

        # Create detailed error response with conflicting document
        conflict_detail = DocumentConflictError(
            detail="A document with this name and category already exists.",
            conflict_type="name_conflict",
            existing_document=existing_document_schema
        )

        raise HTTPException(
            status_code=400,
            detail=conflict_detail.model_dump()
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


@router.post("/{document_id}/share", response_model=ShareResponse)
async def enable_document_sharing(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareResponse:
    """Enable sharing for a document and return the share link."""
    share_token = await document_crud.document.enable_sharing(
        db=db, document_id=document_id, user_id=current_user.id
    )
    if not share_token:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Generate share URL - in production, use the actual domain
    share_url = f"http://localhost:3000/shared/{share_token}"
    
    return ShareResponse(
        share_token=share_token,
        share_url=share_url,
        is_shared=True
    )


@router.delete("/{document_id}/share")
async def disable_document_sharing(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Disable sharing for a document."""
    success = await document_crud.document.disable_sharing(
        db=db, document_id=document_id, user_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document sharing disabled"}


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

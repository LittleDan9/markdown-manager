"""Document management API endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document, DocumentCreate, DocumentList, DocumentUpdate

router = APIRouter()


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
        documents = await document_crud.document.get_by_user_and_category(
            db=db,
            user_id=int(current_user.id),
            category=category,
            skip=skip,
            limit=limit,
        )
    else:
        documents = await document_crud.document.get_by_user(
            db=db, user_id=int(current_user.id), skip=skip, limit=limit
        )

    # Convert ORM models to Pydantic schemas
    document_schemas = [Document.model_validate(doc) for doc in documents]

    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )

    return DocumentList(
        documents=document_schemas, total=len(document_schemas), categories=categories
    )


@router.post("/", response_model=Document)
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Create a new document."""
    document = await document_crud.document.create(
        db=db,
        user_id=int(current_user.id),
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
    if not document or document.user_id != int(current_user.id):
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
        user_id=int(current_user.id),
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
        db=db, document_id=document_id, user_id=int(current_user.id)
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
        db=db, user_id=int(current_user.id)
    )
    return categories

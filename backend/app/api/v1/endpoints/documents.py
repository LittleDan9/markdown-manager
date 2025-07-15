"""Document management API endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document, DocumentCreate, DocumentList, DocumentUpdate

router = APIRouter()


@router.patch("/categories/{old_name}", response_model=List[str])
async def rename_category(
    old_name: str,
    new_name: str = Body(..., embed=True, description="New category name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Rename a category for the current user."""
    updated = await document_crud.document.update_category_name_for_user(
        db=db, user_id=int(current_user.id), old_name=old_name, new_name=new_name
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found or name already exists")
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=int(current_user.id)
    )
    return categories


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
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Delete a category for the current user. Optionally migrate or delete documents in the category.
    Query params:
      - migrate_to: str (move docs to this category)
      - delete_docs: bool (delete all docs in this category)
      - If neither is provided, moves docs to 'General'.
    """
    migrate_to = request.query_params.get("migrate_to")
    delete_docs_req = request.query_params.get("delete_docs")
    delete_docs = True if delete_docs_req == 'true' and delete_docs_req is not None else False

    if delete_docs:
        # Delete all documents in the category for this user
        await document_crud.document.delete_documents_in_category_for_user(
            db=db, user_id=int(current_user.id), category=category
        )
    elif migrate_to:
        # Migrate all documents to another category
        await document_crud.document.migrate_documents_to_category_for_user(
            db=db, user_id=int(current_user.id), old_category=category, new_category=migrate_to
        )
    else:
        # Default: move to 'General'
        await document_crud.document.migrate_documents_to_category_for_user(
            db=db, user_id=int(current_user.id), old_category=category, new_category="General"
        )

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
    """
    Get all documents for the current user.
    - If category is provided and not 'All', filters by category.
    - Returns: { documents: [...], total: int, categories: [...] }
    """
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
    """Create a new document."""
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

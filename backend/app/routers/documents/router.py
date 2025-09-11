"""Main documents router that aggregates all document sub-routers."""
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
)
from . import categories, crud, current, sharing, folders, recents
from .docs import DOCUMENT_CRUD_DOCS

router = APIRouter()


# Base document operations (list and create) - these need to be on the main router
@router.get("", response_model=DocumentList, **DOCUMENT_CRUD_DOCS["list"])
async def get_documents(
    category: Optional[str] = Query(None, description="Filter by category (legacy)"),
    folder_path: Optional[str] = Query(None, description="Filter by folder path"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentList:
    """Get all documents for the current user with folder or category filtering."""

    if folder_path is not None:
        # New folder-based filtering
        from app.models.document import Document as DocumentModel
        normalized_path = DocumentModel.normalize_folder_path(folder_path)
        orm_documents = await document_crud.document.get_documents_by_folder_path(
            db, current_user.id, normalized_path
        )
        # Apply pagination manually since folder method doesn't support it yet
        orm_documents = orm_documents[skip:skip + limit]

    elif category and category != "All":
        # Legacy category-based filtering
        orm_documents = await document_crud.document.get_by_user_and_category(
            db=db, user_id=current_user.id, category=category, skip=skip, limit=limit
        )
    else:
        # All documents
        orm_documents = await document_crud.document.get_by_user(
            db=db, user_id=current_user.id, skip=skip, limit=limit
        )

    # Get categories for backward compatibility
    categories = await document_crud.document.get_categories_by_user(
        db=db, user_id=current_user.id
    )

    documents = [
        Document.model_validate(doc, from_attributes=True) for doc in orm_documents
    ]
    return DocumentList(
        documents=documents, total=len(documents), categories=categories
    )


@router.post("", response_model=Document, **DOCUMENT_CRUD_DOCS["create"])
async def create_document(
    document_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Create a new document with folder or category support during transition."""

    # Handle both folder_path and category_id during transition
    folder_path = None
    category_id = None

    if hasattr(document_data, 'folder_path') and document_data.folder_path:
        # New folder-based approach
        from app.models.document import Document as DocumentModel
        folder_path = DocumentModel.normalize_folder_path(document_data.folder_path)

        # Check for duplicate in folder
        existing_docs = await document_crud.document.get_documents_by_folder_path(
            db, current_user.id, folder_path
        )

        for existing_doc in existing_docs:
            if existing_doc.name == document_data.name:
                existing_document_schema = Document.model_validate(
                    existing_doc, from_attributes=True
                )

                from app.schemas.document import DocumentConflictError
                conflict_detail = DocumentConflictError(
                    detail="A document with this name already exists in this folder.",
                    conflict_type="name_conflict",
                    existing_document=existing_document_schema,
                )
                raise HTTPException(status_code=400, detail=conflict_detail.model_dump())

    elif hasattr(document_data, 'category_id') and document_data.category_id:
        # Legacy category-based approach
        category_id = document_data.category_id

        # Check for duplicate (name, category) per user - existing logic
        from sqlalchemy import select
        from app.models.document import Document as DocumentModel

        existing_result = await db.execute(
            select(DocumentModel).filter(
                DocumentModel.user_id == current_user.id,
                DocumentModel.name == document_data.name,
                DocumentModel.category_id == document_data.category_id,
            )
        )
        existing_doc = existing_result.scalar_one_or_none()

        if existing_doc:
            existing_document_schema = Document.model_validate(
                existing_doc, from_attributes=True
            )

            from app.schemas.document import DocumentConflictError
            conflict_detail = DocumentConflictError(
                detail="A document with this name and category already exists.",
                conflict_type="name_conflict",
                existing_document=existing_document_schema,
            )
            raise HTTPException(status_code=400, detail=conflict_detail.model_dump())

        # Convert category to folder path for storage
        from app.crud.category import get_user_categories
        categories = await get_user_categories(db, current_user.id)
        category = next((cat for cat in categories if cat.id == category_id), None)
        if category:
            folder_path = f"/{category.name}"
    else:
        # Default folder if neither provided
        folder_path = "/General"

    # Create document with folder path
    from app.models.document import Document as DocumentModel
    document = DocumentModel(
        name=document_data.name,
        content=document_data.content or "",
        folder_path=folder_path or "/General",
        category_id=category_id,  # Keep for transition
        user_id=current_user.id
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    return Document.model_validate(document, from_attributes=True)


# Include all document sub-routers
# NOTE: Order matters! More specific routes must come before generic ones
router.include_router(recents.router, tags=["documents"])  # /recent before /{document_id}
router.include_router(current.router, tags=["documents"])  # /current before /{document_id}
router.include_router(folders.router, tags=["documents"])  # NEW: folder operations
router.include_router(categories.router, tags=["documents"])
router.include_router(sharing.router, tags=["documents"])
router.include_router(crud.router, tags=["documents"])  # /{document_id} must come last

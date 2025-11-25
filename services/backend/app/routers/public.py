"""Public API endpoints that don't require authentication."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import document as document_crud
from app.database import get_db
from app.schemas.document import SharedDocument
from app.routers.documents.response_utils import create_document_response

router = APIRouter()


@router.get("/shared/{share_token}", response_model=SharedDocument)
async def get_shared_document(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> SharedDocument:
    """Get a shared document by its share token (no authentication required)."""
    document = await document_crud.document.get_by_share_token(
        db=db, share_token=share_token
    )
    if not document:
        raise HTTPException(
            status_code=404, detail="Shared document not found or sharing disabled"
        )

    # Use the response utility to load content from filesystem
    document_response = await create_document_response(
        document=document,
        user_id=document.user_id
    )

    # Create the shared document response with author information
    shared_doc_data = {
        "id": document_response.id,
        "name": document_response.name,
        "content": document_response.content,
        "category": document_response.category,
        "category_id": document_response.category_id,
        "folder_path": document_response.folder_path,
        "updated_at": document_response.updated_at,
        "author_name": document.owner.full_name,
    }

    return SharedDocument.model_validate(shared_doc_data)

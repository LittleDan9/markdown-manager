"""Public API endpoints that don't require authentication."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import document as document_crud
from app.database import get_db
from app.schemas.document import SharedDocument

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

    # Create the response with author information
    shared_doc_data = {
        "id": document.id,
        "name": document.name,
        "content": document.content,
        "category": document.category,
        "updated_at": document.updated_at,
        "author_name": document.owner.full_name,
    }

    return SharedDocument.model_validate(shared_doc_data)

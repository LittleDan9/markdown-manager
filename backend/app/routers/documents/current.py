"""Current document management API endpoints."""
import sqlalchemy as sa
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import Document
from .docs import CURRENT_DOCUMENT_DOCS

router = APIRouter()


@router.get("/current", response_model=Document | None, **CURRENT_DOCUMENT_DOCS["get"])
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


@router.post("/current", response_model=dict, **CURRENT_DOCUMENT_DOCS["set"])
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

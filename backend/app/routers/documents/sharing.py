"""Document sharing API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import ShareResponse
from .docs import SHARING_DOCS

router = APIRouter()


@router.post("/{document_id}/share", response_model=ShareResponse, **SHARING_DOCS["enable"])
async def enable_document_sharing(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareResponse:
    """Enable sharing for a document and return the share token."""
    share_token = await document_crud.document.enable_sharing(
        db=db, document_id=document_id, user_id=current_user.id
    )
    if not share_token:
        raise HTTPException(status_code=404, detail="Document not found")

    return ShareResponse(share_token=share_token, is_shared=True)


@router.delete("/{document_id}/share", **SHARING_DOCS["disable"])
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

"""Document helper functions for API endpoints."""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.document import Document as DocumentResponse


async def get_document_response(
    db: AsyncSession,
    document_id: int,
    current_user: User
) -> DocumentResponse:
    """
    Get a document by ID and return it in the standard API response format.

    This function ensures consistent document responses across all endpoints,
    whether the document is retrieved from regular document operations or
    GitHub import/open operations.

    Args:
        db: Database session
        document_id: ID of the document to retrieve
        current_user: Current authenticated user

    Returns:
        Document in standard API response format

    Raises:
        HTTPException: If document not found or access denied
    """
    from app.crud.document import DocumentCRUD

    document_crud = DocumentCRUD()
    document = await document_crud.get(db, document_id)

    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Convert to Pydantic model - this ensures consistent response format
    # and includes all GitHub metadata fields when present
    return DocumentResponse.from_orm(document)

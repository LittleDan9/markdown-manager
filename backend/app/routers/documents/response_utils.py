"""Utilities for constructing document API responses."""
from typing import Optional
from app.models.document import Document as DocumentModel
from app.schemas.document import Document as DocumentSchema
from app.services.storage.user import UserStorage


async def create_document_response(
    document: DocumentModel,
    user_id: int,
    content: Optional[str] = None
) -> DocumentSchema:
    """
    Create a Document schema response from a database model.

    This helper centralizes the logic for constructing Document responses
    that include filesystem content, avoiding duplication across endpoints.

    Args:
        document: The Document ORM model from the database
        user_id: The user ID for filesystem access
        content: Optional pre-loaded content. If None, will load from filesystem

    Returns:
        DocumentSchema: Complete document response with content from filesystem
    """
    # Load content from filesystem if not provided
    if content is None:
        storage_service = UserStorage()
        content = await storage_service.read_document(
            user_id=user_id,
            file_path=document.file_path or ""
        )
        # If content is still None, use empty string as fallback
        if content is None:
            content = ""

    # Manually construct the Document response schema
    return DocumentSchema(
        id=document.id,
        name=document.name,
        content=content,
        category_id=document.category_id,
        user_id=document.user_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_shared=document.is_shared,
        share_token=document.share_token,
        category=None,  # Will be populated by calling function if needed
        folder_path=document.folder_path,
        file_path=document.file_path,
        repository_type=document.repository_type,
        github_repository_id=document.github_repository_id,
        github_file_path=document.github_file_path,
        github_sha=document.github_sha,
        github_sync_status=document.github_sync_status,
        last_github_sync_at=document.last_github_sync_at
    )


async def create_document_list_response(
    documents: list[DocumentModel],
    user_id: int
) -> list[DocumentSchema]:
    """
    Create a list of Document schema responses from database models.

    Args:
        documents: List of Document ORM models from the database
        user_id: The user ID for filesystem access

    Returns:
        list[DocumentSchema]: List of complete document responses with content
    """
    responses = []
    storage_service = UserStorage()

    for document in documents:
        try:
            content = await storage_service.read_document(
                user_id=user_id,
                file_path=document.file_path or ""
            )
            response = await create_document_response(
                document=document,
                user_id=user_id,
                content=content
            )
            responses.append(response)
        except Exception as e:
            # Log error but continue with other documents
            print(f"Error loading content for document {document.id}: {e}")
            # Create response with empty content as fallback
            response = await create_document_response(
                document=document,
                user_id=user_id,
                content=""
            )
            responses.append(response)

    return responses

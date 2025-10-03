"""Utilities for constructing document API responses."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import Document as DocumentModel
from app.schemas.document import Document as DocumentSchema
from app.services.storage.user import UserStorage


async def create_document_response(
    document: DocumentModel,
    user_id: int,
    content: Optional[str] = None,
    db: Optional[AsyncSession] = None
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
        try:
            content = await storage_service.read_document(
                user_id=user_id,
                file_path=document.file_path or ""
            )
        except Exception as e:
            # Log the specific error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to read document {document.id} from filesystem: {e}")
            content = None

        # If content is still None, provide helpful fallback message
        if content is None:
            if document.file_path:
                content = (
                    f"# File Not Found\n\n"
                    f"The document file at `{document.file_path}` could not be loaded.\n\n"
                    f"This may indicate:\n"
                    f"- The file was deleted from the filesystem\n"
                    f"- There's a permission issue\n"
                    f"- The file path is incorrect\n\n"
                    f"Please check the document's file path or re-import the document if it's from GitHub."
                )
            else:
                content = "# No Content\n\nThis document has no associated file path."

    # Check if category name is already populated (from CRUD layer joins)
    category_name = getattr(document, 'category', None)

    # If not available, try to get it from category_id using provided db session
    if not category_name and document.category_id and db:
        try:
            from app.crud.category import get_category_by_id
            category = await get_category_by_id(db=db, category_id=document.category_id, user_id=user_id)
            if category:
                category_name = category.name
        except Exception as e:
            print(f"Error fetching category name for category_id {document.category_id}: {e}")

    # Use the folder path to infer category name as final fallback
    # But skip this for GitHub documents which have complex folder paths
    if not category_name and document.folder_path and document.folder_path != '/':
        # Don't extract category from GitHub folder paths (they contain repository info)
        if document.repository_type != 'github':
            category_name = document.folder_path.strip('/').split('/')[-1]

    # Manually construct the Document response schema
    response = DocumentSchema(
        id=document.id,
        name=document.name,
        content=content,
        category_id=document.category_id,
        user_id=document.user_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_shared=document.is_shared,
        share_token=document.share_token,
        category=category_name,  # Now populated with actual category name
        folder_path=document.folder_path,
        file_path=document.file_path,
        repository_type=document.repository_type,
        github_repository_id=document.github_repository_id,
        github_file_path=document.github_file_path,
        github_sha=document.github_sha,
        github_sync_status=document.github_sync_status,
        last_github_sync_at=document.last_github_sync_at,
        last_opened_at=document.last_opened_at,  # Add the missing field
        # Add GitHub repository information if available
        # Safely access github_repository relationship
        github_repository=None,
        repository_name=None,
        github_branch=document.github_branch
    )

    # Safely populate GitHub repository information after creating the base response
    try:
        if hasattr(document, 'github_repository') and document.github_repository:
            github_repo = document.github_repository
            response.github_repository = {
                "id": github_repo.id,
                "name": github_repo.repo_name,
                "full_name": github_repo.repo_full_name,
                "owner": github_repo.repo_owner,
                "default_branch": github_repo.default_branch,
                "is_private": github_repo.is_private,
                "description": github_repo.description
            }
            response.repository_name = github_repo.repo_name
    except Exception as e:
        # Log error but don't fail the response
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Error accessing github_repository for document {document.id}: {e}")

    return response


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

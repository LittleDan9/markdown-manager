from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.models.document import Document as DocumentModel
from app.schemas.document import Document, DocumentUpdate
from .response_utils import create_document_response
from .docs import DOCUMENT_CRUD_DOCS

router = APIRouter()


@router.get("/{document_id}", response_model=Document, **DOCUMENT_CRUD_DOCS["get"])
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Get a specific document with content from filesystem."""

    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Use the helper function to create the response with filesystem content
    return await create_document_response(
        document=document,
        user_id=current_user.id
    )


async def _update_document_content(
    document: Document,
    storage_service,
    user_id: int,
    new_content: str
) -> bool:
    """Helper function to update document content."""
    if document.file_path:
        # Update filesystem content
        return await storage_service.write_document(
            user_id=user_id,
            file_path=document.file_path,
            content=new_content,
            commit_message=f"Update content: {document.name}",
            auto_commit=True
        )
    else:
        # Legacy: Update database content directly (during migration)
        document.content = new_content
        return True


async def _validate_category(db: AsyncSession, category_id: int, user_id: int):
    """Helper function to validate category ownership."""
    from app.models.category import Category

    result = await db.execute(
        select(Category).filter(
            Category.id == category_id,
            Category.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


@router.put("/{document_id}", response_model=Document, **DOCUMENT_CRUD_DOCS["update"])
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Update a document with filesystem storage and git versioning."""
    from app.services.storage.user import UserStorage
    from datetime import datetime, timezone

    storage_service = UserStorage()

    # Get the existing document
    document = await document_crud.document.get(db=db, id=document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Handle content updates
    if document_data.content is not None:
        success = await _update_document_content(
            document, storage_service, current_user.id, document_data.content
        )
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update document content in filesystem"
            )

    # Handle name updates
    if document_data.name is not None:
        document.name = document_data.name

    # Handle category updates
    if document_data.category_id is not None:
        category_obj = await _validate_category(db, document_data.category_id, current_user.id)
        if not category_obj:
            raise ValueError(f"Category with ID {document_data.category_id} not found for user")
        document.category_id = document_data.category_id

    # Handle folder path updates
    if document_data.folder_path is not None:
        from app.models.document import Document as DocumentModel
        new_folder_path = DocumentModel.normalize_folder_path(document_data.folder_path)
        document.folder_path = new_folder_path

    # Always set updated_at to current UTC time
    document.updated_at = datetime.now(timezone.utc)

    # Commit database changes
    await db.commit()
    await db.refresh(document)

    # Use the helper function to create the response
    return await create_document_response(
        document=document,
        user_id=current_user.id
    )


@router.delete("/{document_id}", **DOCUMENT_CRUD_DOCS["delete"])
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a document from both filesystem and database."""
    from app.services.storage import UserStorage

    storage_service = UserStorage()

    # Get the document first to check ownership and get file_path
    result = await db.execute(
        select(Document).filter(
            Document.id == document_id, Document.user_id == current_user.id
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from filesystem if file_path exists
    if document.file_path:
        filesystem_success = await storage_service.delete_document(
            user_id=current_user.id,
            file_path=document.file_path,
            commit_message=f"Delete document: {document.name}",
            auto_commit=True
        )
        if not filesystem_success:
            # Log warning but continue with database deletion
            # This ensures we don't have orphaned database records
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to delete filesystem file for document {document_id}: {document.file_path}")

    # Delete from database
    await db.delete(document)
    await db.commit()

    return {"message": "Document deleted successfully"}


@router.put("/{document_id}/move", response_model=Document)
async def move_document(
    document_id: int,
    move_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Move a document to a different folder/category with filesystem operations."""
    from app.services.storage import UserStorage
    from app.models.document import Document as DocumentModel

    storage_service = UserStorage()

    # Get new folder path from request
    new_folder_path = move_data.get("new_folder_path")
    if not new_folder_path:
        raise HTTPException(status_code=400, detail="new_folder_path is required")

    new_folder_path = DocumentModel.normalize_folder_path(new_folder_path)

    # Get the document
    result = await db.execute(
        select(Document).filter(
            Document.id == document_id, Document.user_id == current_user.id
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # If already in the target folder, no action needed
    if document.folder_path == new_folder_path:
        # Read content for response
        content = ""
        if document.file_path:
            content = await storage_service.read_document(current_user.id, document.file_path)
            if content is None:
                content = getattr(document, 'content', "")
        else:
            content = getattr(document, 'content', "")

        return await create_document_response(
            document=document,
            user_id=current_user.id
        )

    # Handle filesystem move if using filesystem storage
    if document.file_path:
        # Calculate new file path
        filename = document.file_path.split('/')[-1]  # Get filename from current path
        category_name = new_folder_path.strip('/').split('/')[-1] if new_folder_path != '/' else 'General'
        new_file_path = f"local/{category_name}/{filename}"

        # Move in filesystem
        success = await storage_service.move_document(
            user_id=current_user.id,
            old_path=document.file_path,
            new_path=new_file_path,
            commit_message=f"Move {document.name} to {new_folder_path}",
            auto_commit=True
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to move document in filesystem"
            )

        # Update file_path in database
        document.file_path = new_file_path

    # Update folder_path in database
    document.folder_path = new_folder_path

    # Update timestamp
    from datetime import datetime, timezone
    document.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(document)

    # Read content for response
    content = ""
    if document.file_path:
        content = await storage_service.read_document(current_user.id, document.file_path)
        if content is None:
            content = getattr(document, 'content', "")
    else:
        content = getattr(document, 'content', "")

    return await create_document_response(
        document=document,
        user_id=current_user.id
    )


@router.get("/{document_id}/history")
async def get_document_history(
    document_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get git commit history for a document."""
    from app.services.storage import UserStorage

    storage_service = UserStorage()

    # Get the document
    result = await db.execute(
        select(Document).filter(
            Document.id == document_id, Document.user_id == current_user.id
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get history from git if file_path exists
    history = []
    if document.file_path:
        commits = await storage_service.get_document_history(
            user_id=current_user.id,
            file_path=document.file_path,
            limit=limit
        )

        # Convert GitCommit objects to dict
        history = [
            {
                "hash": commit.hash,
                "message": commit.message,
                "author": commit.author,
                "date": commit.date.isoformat() if commit.date else None,
                "files": commit.files
            }
            for commit in commits
        ]

    return {
        "document_id": document_id,
        "document_name": document.name,
        "repository_type": document.repository_type or "local",
        "history": history
    }


@router.get("/{document_id}/history/{commit_hash}")
async def get_document_at_commit(
    document_id: int,
    commit_hash: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get document content at a specific commit."""
    from app.services.storage import UserStorage

    storage_service = UserStorage()

    # Get the document
    result = await db.execute(
        select(Document).filter(
            Document.id == document_id, Document.user_id == current_user.id
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get content at specific commit
    content = None
    if document.file_path:
        content = await storage_service.get_document_at_commit(
            user_id=current_user.id,
            file_path=document.file_path,
            commit_hash=commit_hash
        )

    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document content not found at commit {commit_hash}"
        )

    return {
        "document_id": document_id,
        "document_name": document.name,
        "commit_hash": commit_hash,
        "content": content
    }

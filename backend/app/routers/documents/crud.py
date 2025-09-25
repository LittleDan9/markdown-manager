from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Optional

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
    force_sync: bool = Query(False, description="Force sync from remote source for GitHub documents"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """
    Get a specific document with content - UNIFIED for all source types.

    This single endpoint handles:
    - Local documents (reads from filesystem)
    - GitHub documents (auto-syncs repo and reads from filesystem)
    - Future source types (extensible)

    No more branching logic needed in frontend!
    """
    try:
        # Get document from database with category relationship loaded
        result = await db.execute(
            select(DocumentModel)
            .options(selectinload(DocumentModel.category_ref))
            .filter(DocumentModel.id == document_id, DocumentModel.user_id == current_user.id)
        )
        document = result.scalar_one_or_none()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found or access denied")

        # Pre-load all fields we'll need for the response before any commits
        # This prevents lazy loading issues later
        document_data = {
            'id': document.id,
            'name': document.name,
            'category_id': document.category_id,
            'user_id': document.user_id,
            'created_at': document.created_at,
            'updated_at': document.updated_at,
            'is_shared': document.is_shared,
            'share_token': document.share_token,
            'folder_path': document.folder_path,
            'file_path': document.file_path,
            'repository_type': document.repository_type,
            'github_repository_id': document.github_repository_id,
            'github_file_path': document.github_file_path,
            'github_sha': document.github_sha,
            'github_sync_status': document.github_sync_status,
            'last_github_sync_at': document.last_github_sync_at
        }

        # Handle GitHub document sync if needed
        if document.repository_type == "github" and force_sync:
            # Use unified service to handle GitHub sync automatically
            from app.services.unified_document import unified_document_service
            try:
                # The unified service will handle GitHub sync as part of get_document_with_content
                await unified_document_service.get_document_with_content(
                    db=db,
                    document_id=document_id,
                    user_id=current_user.id,
                    force_sync=True
                )
            except Exception as e:
                print(f"Warning: GitHub sync failed for document {document_id}: {e}")
                # Continue with normal document retrieval

        # Update last opened timestamp
        try:
            document.last_opened_at = datetime.utcnow()
            db.add(document)
            await db.commit()
        except Exception as e:
            print(f"Warning: Failed to update last_opened_at for document {document_id}: {e}")
            await db.rollback()

        # Set category name attribute for response helper
        if document.category_ref:
            document.category = document.category_ref.name
        else:
            document.category = None

        # Create a new DocumentModel instance with the pre-loaded data
        # This avoids lazy loading issues with the committed/expired object
        detached_doc = DocumentModel(**document_data)
        detached_doc.category = getattr(document, 'category', None)

        # Use existing response helper for content loading and response construction
        return await create_document_response(
            document=detached_doc,
            user_id=current_user.id,
            content=None,  # Let response helper load content
            db=db  # Pass database session to avoid async context issues
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Error getting document {document_id}: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document")


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


async def _handle_document_filesystem_changes(
    document,
    storage_service,
    user_id: int,
    db,
    original_file_path: str,
    new_name: str,
    new_category_name: Optional[str],
    name_changed: bool,
    category_changed: bool
) -> None:
    """Handle filesystem operations when document name or category changes."""

    # Determine repository type and construct new file path
    if original_file_path.startswith('local/'):
        # Local document: local/{category}/{filename}
        path_parts = original_file_path.split('/')
        old_category = path_parts[1] if len(path_parts) >= 2 else 'General'

        # Use new category name if category changed, otherwise keep old category
        target_category = new_category_name if category_changed and new_category_name else old_category
        new_file_path = f"local/{target_category}/{new_name}.md"

        # Only perform filesystem operation if the path actually changed
        if new_file_path != original_file_path:
            # Move/rename the file in filesystem
            success = await storage_service.move_document(
                user_id=user_id,
                old_path=original_file_path,
                new_path=new_file_path,
                commit_message=_build_commit_message(name_changed, category_changed, new_name, target_category),
                auto_commit=True
            )

            if not success:
                raise Exception(f"Failed to move document from {original_file_path} to {new_file_path}")

            # Update the file_path in the document
            document.file_path = new_file_path

    elif original_file_path.startswith('github/'):
        # GitHub document: github/{account_id}/{repo_name}/{github_file_path}
        path_parts = original_file_path.split('/')
        if len(path_parts) >= 4:
            account_id = path_parts[1]
            repo_name = path_parts[2]
            old_github_path = '/'.join(path_parts[3:])

            # For GitHub documents, only handle filename changes within the same directory
            # Category changes don't apply to GitHub documents as they follow repo structure
            if name_changed:
                # Extract directory path and construct new filename
                github_path_parts = old_github_path.split('/')
                github_path_parts[-1] = f"{new_name}.md"  # Replace filename
                new_github_path = '/'.join(github_path_parts)
                new_file_path = f"github/{account_id}/{repo_name}/{new_github_path}"

                # Move/rename the file in filesystem
                success = await storage_service.move_document(
                    user_id=user_id,
                    old_path=original_file_path,
                    new_path=new_file_path,
                    commit_message=f"Rename {old_github_path.split('/')[-1]} to {new_name}.md",
                    auto_commit=True
                )

                if not success:
                    raise Exception(f"Failed to rename GitHub document from {original_file_path} to {new_file_path}")

                # Update both file_path and github_file_path in the document
                document.file_path = new_file_path
                document.github_file_path = new_github_path


def _build_commit_message(name_changed: bool, category_changed: bool, new_name: str, new_category: str) -> str:
    """Build descriptive commit message for document changes."""
    if name_changed and category_changed:
        return f"Rename and move document to {new_name} in {new_category}"
    elif name_changed:
        return f"Rename document to {new_name}"
    elif category_changed:
        return f"Move document to category {new_category}"
    else:
        return "Update document"


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


async def _process_document_updates(
    document,
    document_data: DocumentUpdate,
    storage_service,
    current_user,
    db: AsyncSession
) -> None:
    """Process document name and category changes with filesystem operations."""

    # Store original values
    original_name = document.name
    original_category_id = document.category_id
    original_file_path = document.file_path

    # Determine changes
    name_changed = document_data.name is not None and document_data.name != original_name
    category_changed = (
        document_data.category_id is not None
        and document_data.category_id != original_category_id
    )

    # Handle category updates first
    new_category_name = None
    if category_changed and document_data.category_id is not None:
        category_obj = await _validate_category(db, document_data.category_id, current_user.id)
        if not category_obj:
            raise ValueError(f"Category with ID {document_data.category_id} not found for user")
        new_category_name = category_obj.name
        document.category_id = document_data.category_id

    # Handle name updates
    if name_changed and document_data.name is not None:
        document.name = document_data.name

    # Handle filesystem operations
    if (name_changed or category_changed) and original_file_path:
        final_name = document_data.name or original_name
        await _handle_document_filesystem_changes(
            document=document,
            storage_service=storage_service,
            user_id=current_user.id,
            db=db,
            original_file_path=original_file_path,
            new_name=final_name,
            new_category_name=new_category_name,
            name_changed=name_changed,
            category_changed=category_changed
        )


@router.put("/{document_id}", response_model=Document, **DOCUMENT_CRUD_DOCS["update"])
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    """Update a document with filesystem storage and git versioning."""
    from app.services.storage import UserStorage
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

    # Handle name/category changes with filesystem operations
    try:
        await _process_document_updates(document, document_data, storage_service, current_user, db)
    except Exception as e:
        # Rollback database changes if filesystem operations fail
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update document in filesystem: {str(e)}"
        )

    # Handle folder path updates
    if document_data.folder_path is not None:
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
        select(DocumentModel).filter(
            DocumentModel.id == document_id, DocumentModel.user_id == current_user.id
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
        select(DocumentModel).filter(
            DocumentModel.id == document_id, DocumentModel.user_id == current_user.id
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
        select(DocumentModel).filter(
            DocumentModel.id == document_id, DocumentModel.user_id == current_user.id
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
        select(DocumentModel).filter(
            DocumentModel.id == document_id, DocumentModel.user_id == current_user.id
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

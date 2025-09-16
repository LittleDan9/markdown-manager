"""Folder-based document operations router."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.crud import document as document_crud
from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    CreateFolderRequest,
    DocumentResponse,
    FolderStructureResponse,
    MoveDocumentRequest,
)

router = APIRouter()


@router.get("/folders", response_model=FolderStructureResponse)
async def get_folder_structure(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Folder Structure

    Returns the hierarchical folder structure for the current user's documents.

    Returns:
        - tree: Nested dictionary representing folder hierarchy
        - total_folders: Number of folders containing documents
        - user_id: Current user's ID
    """
    structure = await document_crud.document.get_folder_structure(db, current_user.id)

    return FolderStructureResponse(
        tree=structure,
        total_folders=len(structure),
        user_id=current_user.id
    )


@router.get("/folders/{folder_path:path}", response_model=list[DocumentResponse])
async def get_documents_in_folder(
    folder_path: str,
    include_subfolders: bool = Query(False, description="Include documents from subfolders"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Documents in Folder

    Retrieve all documents in a specific folder path.

    Args:
        folder_path: The folder path (e.g., 'Work/Projects')
        include_subfolders: Whether to include documents from subfolders

    Returns:
        List of documents in the specified folder
    """
    # Normalize folder path
    if not folder_path.startswith('/'):
        folder_path = f"/{folder_path}"

    documents = await document_crud.document.get_documents_by_folder_path(
        db,
        current_user.id,
        folder_path,
        include_subfolders
    )

    # Convert to response format with computed fields
    response_docs = []
    for doc in documents:
        doc_data = DocumentResponse.model_validate(doc, from_attributes=True)
        # Add computed fields
        doc_data.root_folder = doc.root_folder
        doc_data.display_path = doc.display_path
        doc_data.breadcrumbs = doc.get_folder_breadcrumbs()

        # Add category info if available
        if hasattr(doc, 'category_ref') and doc.category_ref:
            doc_data.category_name = doc.category_ref.name
            doc_data.category_id = doc.category_id

        response_docs.append(doc_data)

    return response_docs


@router.post("/folders", response_model=dict)
async def create_folder(
    folder_data: CreateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create Folder

    Create a new folder structure. Folders are virtual and created when documents are added.

    Args:
        folder_data: Folder creation request with path

    Returns:
        Folder information including existence status and document count
    """
    from app.models.document import Document

    folder_path = Document.normalize_folder_path(folder_data.path)

    # Validate folder path
    if not folder_path or folder_path == '/':
        raise HTTPException(status_code=400, detail="Invalid folder path")

    # Check if folder already exists (has documents)
    existing_docs = await document_crud.document.get_documents_by_folder_path(
        db,
        current_user.id,
        folder_path
    )

    return {
        "folder_path": folder_path,
        "exists": len(existing_docs) > 0,
        "document_count": len(existing_docs)
    }


@router.put("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: int,
    move_data: MoveDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Move Document

    Move a document to a different folder.

    Args:
        document_id: ID of the document to move
        move_data: New folder path information

    Returns:
        Updated document with new folder location
    """
    try:
        document = await document_crud.document.move_document_to_folder(
            db,
            document_id,
            move_data.new_folder_path,
            current_user.id
        )

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Convert to response format
        doc_response = DocumentResponse.model_validate(document, from_attributes=True)
        doc_response.root_folder = document.root_folder
        doc_response.display_path = document.display_path
        doc_response.breadcrumbs = document.get_folder_breadcrumbs()

        return doc_response

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/search", response_model=list[DocumentResponse])
async def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    folder_path: Optional[str] = Query(None, description="Limit search to specific folder"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search Documents

    Search documents by content and name with optional folder filtering.

    Args:
        q: Search query string
        folder_path: Optional folder path to limit search scope

    Returns:
        List of matching documents
    """
    # Use existing search method from CRUD
    documents = await document_crud.document.search_documents(
        db,
        current_user.id,
        query=q,
        folder_path=folder_path
    )

    # Convert to response format
    response_docs = []
    for doc in documents:
        doc_data = DocumentResponse.model_validate(doc, from_attributes=True)
        doc_data.root_folder = doc.root_folder
        doc_data.display_path = doc.display_path
        doc_data.breadcrumbs = doc.get_folder_breadcrumbs()
        response_docs.append(doc_data)

    return response_docs

# Phase 3: Backend API Updates

## Objective

Update backend API endpoints to support folder-based operations while maintaining backward compatibility with category-based requests during the transition.

## Duration

2-3 days

## Risk Level

Medium - API changes require careful handling of both old and new request formats.

## API Endpoint Changes

### New Folder-Based Endpoints

**File**: `backend/app/routers/documents.py`

Add new endpoints that work with folder paths:

```python
@router.get("/folders", response_model=dict)
async def get_folder_structure(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get the folder tree structure for the current user."""
    repo = DocumentRepository(db)
    structure = await repo.get_folder_structure(current_user.id)

    return {
        "tree": structure,
        "total_folders": len(structure),
        "user_id": current_user.id
    }

@router.get("/folders/{folder_path:path}", response_model=list[DocumentResponse])
async def get_documents_in_folder(
    folder_path: str,
    include_subfolders: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get documents in a specific folder."""
    # Normalize folder path
    if not folder_path.startswith('/'):
        folder_path = f"/{folder_path}"

    repo = DocumentRepository(db)
    documents = await repo.get_documents_by_folder_path(
        current_user.id,
        folder_path,
        include_subfolders
    )

    return [DocumentResponse.from_orm(doc) for doc in documents]

@router.post("/folders", response_model=dict)
async def create_folder(
    folder_data: CreateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new folder (virtual - creates folder structure when document added)."""
    folder_path = Document.normalize_folder_path(folder_data.path)

    # Validate folder path
    if not folder_path or folder_path == '/':
        raise HTTPException(status_code=400, detail="Invalid folder path")

    # Check if folder already exists (has documents)
    repo = DocumentRepository(db)
    existing_docs = await repo.get_documents_by_folder_path(
        current_user.id,
        folder_path
    )

    return {
        "folder_path": folder_path,
        "exists": len(existing_docs) > 0,
        "document_count": len(existing_docs)
    }

@router.put("/documents/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: int,
    move_data: MoveDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Move a document to a different folder."""
    repo = DocumentRepository(db)

    try:
        document = await repo.move_document_to_folder(
            document_id,
            move_data.new_folder_path,
            current_user.id
        )
        return DocumentResponse.from_orm(document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/documents/search", response_model=list[DocumentResponse])
async def search_documents(
    q: str = Query(..., min_length=1),
    folder_path: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Search documents with optional folder filtering."""
    repo = DocumentRepository(db)
    documents = await repo.search_documents(
        current_user.id,
        query=q,
        folder_path=folder_path
    )

    return [DocumentResponse.from_orm(doc) for doc in documents]
```

### Enhanced Existing Endpoints

Update existing document endpoints to support both folder and category operations:

```python
@router.post("/", response_model=DocumentResponse)
async def create_document(
    document_data: CreateDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Create a new document with folder or category support."""
    repo = DocumentRepository(db)

    # Handle both folder_path and category_id during transition
    folder_path = None
    category_id = None

    if hasattr(document_data, 'folder_path') and document_data.folder_path:
        folder_path = Document.normalize_folder_path(document_data.folder_path)
    elif hasattr(document_data, 'category_id') and document_data.category_id:
        # Legacy: convert category to folder path
        category_repo = CategoryRepository(db)
        category = await category_repo.get_by_id(document_data.category_id, current_user.id)
        if category:
            folder_path = f"/{category.name}"
            category_id = category.id
    else:
        # Default folder
        folder_path = "/General"

    # Create document
    document = Document(
        name=document_data.name,
        content=document_data.content or "",
        folder_path=folder_path,
        category_id=category_id,  # Keep for transition
        user_id=current_user.id
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    return DocumentResponse.from_orm(document)

@router.get("/", response_model=list[DocumentResponse])
async def get_user_documents(
    folder_path: str = Query(None),
    category_id: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get user documents with folder or category filtering."""
    repo = DocumentRepository(db)

    if folder_path is not None:
        # New folder-based filtering
        documents = await repo.get_documents_by_folder_path(
            current_user.id,
            folder_path
        )
    elif category_id is not None:
        # Legacy category-based filtering
        documents = await repo.get_by_category(current_user.id, category_id)
    else:
        # All documents
        documents = await repo.get_all_for_user(current_user.id)

    return [DocumentResponse.from_orm(doc) for doc in documents]
```

### Custom Dictionary API Updates

**File**: `backend/app/routers/custom_dictionary.py`

Add folder-based endpoints for custom dictionary management:

## Request/Response Schema Updates

### New Pydantic Models

**File**: `backend/app/schemas/document.py`

```python
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime

class CreateFolderRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=1000)

    @validator('path')
    def validate_folder_path(cls, v):
        if not v.startswith('/'):
            v = f"/{v}"
        # Additional validation for invalid characters
        invalid_chars = ['\\', ':', '*', '?', '"', '<', '>', '|']
        if any(char in v for char in invalid_chars):
            raise ValueError(f"Folder path contains invalid characters")
        return v

class MoveDocumentRequest(BaseModel):
    new_folder_path: str = Field(..., min_length=1, max_length=1000)

    @validator('new_folder_path')
    def validate_folder_path(cls, v):
        if not v.startswith('/'):
            v = f"/{v}"
        return v

class CreateDocumentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = ""

    # Support both new and legacy request formats
    folder_path: Optional[str] = None
    category_id: Optional[int] = None  # Legacy support

    @validator('folder_path')
    def validate_folder_path(cls, v):
        if v is not None and not v.startswith('/'):
            v = f"/{v}"
        return v

class UpdateDocumentRequest(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    folder_path: Optional[str] = None

    @validator('folder_path')
    def validate_folder_path(cls, v):
        if v is not None and not v.startswith('/'):
            v = f"/{v}"
        return v

class DocumentResponse(BaseModel):
    id: int
    name: str
    content: str
    folder_path: str
    created_at: datetime
    updated_at: datetime

    # Optional fields for backward compatibility
    category_id: Optional[int] = None
    category_name: Optional[str] = None

    # GitHub integration fields
    github_repository_id: Optional[int] = None
    github_file_path: Optional[str] = None
    github_branch: Optional[str] = None
    github_sync_status: Optional[str] = None

    # Computed fields
    root_folder: Optional[str] = None
    display_path: Optional[str] = None
    breadcrumbs: Optional[list[str]] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, document: Document):
        """Enhanced from_orm with computed fields."""
        data = {
            "id": document.id,
            "name": document.name,
            "content": document.content,
            "folder_path": document.folder_path,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "category_id": document.category_id,
            "github_repository_id": document.github_repository_id,
            "github_file_path": document.github_file_path,
            "github_branch": document.github_branch,
            "github_sync_status": document.github_sync_status,
            "root_folder": document.root_folder,
            "display_path": document.display_path,
            "breadcrumbs": document.get_folder_breadcrumbs()
        }

        # Add category name if available
        if document.category_ref:
            data["category_name"] = document.category_ref.name

        return cls(**data)

class FolderStructureResponse(BaseModel):
    tree: dict
    total_folders: int
    user_id: int
```

## Enhanced Repository Methods

**File**: `backend/app/crud/document.py`

Complete the repository methods started in Phase 2:

```python
class DocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def search_documents(
        self,
        user_id: int,
        query: str,
        folder_path: Optional[str] = None
    ) -> list[Document]:
        """Search documents by content/name with optional folder filtering."""
        search_query = select(Document).where(Document.user_id == user_id)

        # Add text search
        search_query = search_query.where(
            or_(
                Document.name.ilike(f"%{query}%"),
                Document.content.ilike(f"%{query}%")
            )
        )

        # Add folder filtering if specified
        if folder_path:
            search_query = search_query.where(
                Document.folder_path.like(f"{folder_path.rstrip('/')}%")
            )

        result = await self.session.execute(search_query)
        return result.scalars().all()

    async def get_folder_stats(self, user_id: int) -> dict:
        """Get statistics about folder usage."""
        # Get document count per folder
        query = select(
            Document.folder_path,
            func.count(Document.id).label('document_count')
        ).where(
            Document.user_id == user_id
        ).group_by(Document.folder_path)

        result = await self.session.execute(query)
        folder_stats = dict(result.all())

        return {
            "folder_counts": folder_stats,
            "total_folders": len(folder_stats),
            "total_documents": sum(folder_stats.values())
        }

    async def create_document_in_folder(
        self,
        user_id: int,
        name: str,
        content: str,
        folder_path: str,
        github_data: Optional[dict] = None
    ) -> Document:
        """Create a new document in specified folder."""
        # Normalize folder path
        folder_path = Document.normalize_folder_path(folder_path)

        # Check for duplicate names in folder
        existing = await self.session.execute(
            select(Document).where(
                Document.user_id == user_id,
                Document.folder_path == folder_path,
                Document.name == name
            )
        )

        if existing.scalar_one_or_none():
            raise ValueError(f"Document '{name}' already exists in folder '{folder_path}'")

        # Create document
        document = Document(
            name=name,
            content=content,
            folder_path=folder_path,
            user_id=user_id
        )

        # Add GitHub data if provided
        if github_data:
            document.github_repository_id = github_data.get('repository_id')
            document.github_file_path = github_data.get('file_path')
            document.github_branch = github_data.get('branch')
            document.github_sha = github_data.get('sha')

        self.session.add(document)
        await self.session.commit()
        await self.session.refresh(document)

        return document
```

## Error Handling

**File**: `backend/app/core/exceptions.py`

Add folder-specific exceptions:

```python
class FolderException(HTTPException):
    """Base exception for folder operations."""
    pass

class FolderNotFound(FolderException):
    def __init__(self, folder_path: str):
        super().__init__(
            status_code=404,
            detail=f"Folder '{folder_path}' not found"
        )

class InvalidFolderPath(FolderException):
    def __init__(self, folder_path: str, reason: str = "Invalid path format"):
        super().__init__(
            status_code=400,
            detail=f"Invalid folder path '{folder_path}': {reason}"
        )

class DuplicateDocumentInFolder(FolderException):
    def __init__(self, name: str, folder_path: str):
        super().__init__(
            status_code=409,
            detail=f"Document '{name}' already exists in folder '{folder_path}'"
        )
```

## API Testing

**File**: `backend/tests/test_folder_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestFolderAPI:

    def test_get_folder_structure(self, auth_headers):
        """Test folder structure endpoint."""
        response = client.get("/documents/folders", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "tree" in data
        assert "total_folders" in data
        assert "user_id" in data

    def test_get_documents_in_folder(self, auth_headers):
        """Test getting documents in a specific folder."""
        response = client.get("/documents/folders/Work", headers=auth_headers)
        assert response.status_code == 200

        documents = response.json()
        assert isinstance(documents, list)

        # All documents should be in the Work folder
        for doc in documents:
            assert doc["folder_path"].startswith("/Work")

    def test_create_document_with_folder(self, auth_headers):
        """Test creating document with folder path."""
        document_data = {
            "name": "test-folder-doc.md",
            "content": "# Test Document",
            "folder_path": "/Projects/TestProject"
        }

        response = client.post(
            "/documents/",
            json=document_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        doc = response.json()
        assert doc["folder_path"] == "/Projects/TestProject"
        assert doc["name"] == "test-folder-doc.md"

    def test_move_document(self, auth_headers, test_document):
        """Test moving document to different folder."""
        move_data = {
            "new_folder_path": "/Archive"
        }

        response = client.put(
            f"/documents/{test_document.id}/move",
            json=move_data,
            headers=auth_headers
        )
        assert response.status_code == 200

        doc = response.json()
        assert doc["folder_path"] == "/Archive"

    def test_search_documents_with_folder_filter(self, auth_headers):
        """Test document search with folder filtering."""
        response = client.get(
            "/documents/search",
            params={"q": "test", "folder_path": "/Work"},
            headers=auth_headers
        )
        assert response.status_code == 200

        documents = response.json()
        for doc in documents:
            assert doc["folder_path"].startswith("/Work")
```

## Documentation Updates

**File**: `backend/app/routers/documents.py` (docstring updates)

Update API documentation for new endpoints:

```python
@router.get("/folders", response_model=dict, tags=["folders"])
async def get_folder_structure(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get Folder Structure

    Returns the hierarchical folder structure for the current user's documents.

    Returns:
        - tree: Nested dictionary representing folder hierarchy
        - total_folders: Number of folders containing documents
        - user_id: Current user's ID
    """
    # ... implementation
```

## Success Criteria

- [ ] All new folder-based endpoints work correctly
- [ ] Existing endpoints support both folder and category operations
- [ ] API documentation is updated and accurate
- [ ] Error handling covers folder-specific scenarios
- [ ] Unit tests pass for all new endpoints
- [ ] Integration tests verify folder operations
- [ ] Backward compatibility maintained for category-based requests
- [ ] Performance is acceptable for folder queries

## Next Phase

Phase 4 will refactor the GitHub integration to use the new folder structure, mapping repository files to natural folder hierarchies instead of artificial categories.

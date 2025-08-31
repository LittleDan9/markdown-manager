# Phase 4: GitHub Integration Refactor

## Objective

Refactor GitHub integration to use natural folder structures (`/GitHub/repo-name/branch/path/to/file.md`) instead of artificial categories, while preserving existing sync relationships and improving the import process.

## Duration

3-4 days

## Risk Level

Medium - GitHub integration changes require careful handling of existing sync data and API relationships.

## Current GitHub Integration Issues

### Problems to Solve

1. **Artificial Categories**: GitHub repos currently create categories like `repo/branch` which feels unnatural
2. **Flat Structure**: All files from a repo/branch get dumped into one category regardless of their actual folder structure
3. **Poor Organization**: Complex repositories become unmanageable in the current system
4. **Inconsistent Paths**: GitHub file paths don't match the stored document organization

### Current Flow

```
GitHub: owner/repo/branch/docs/api/auth.md
Current: Category "repo/branch" → Document "auth.md"
Desired: Folder "/GitHub/repo/branch/docs/api" → Document "auth.md"
```

## New GitHub Folder Structure

### Folder Path Mapping

**GitHub Repository Structure**:
```
/GitHub/{repo-name}/{branch-name}/{file-path}
```

**Examples**:
- `docs/README.md` → `/GitHub/my-project/main/docs/README.md`
- `src/components/Button.jsx` → `/GitHub/my-project/main/src/components/Button.jsx`
- `README.md` → `/GitHub/my-project/main/README.md`

### Benefits

1. **Natural Navigation**: Folder structure matches GitHub repository layout
2. **Multiple Branches**: Different branches can coexist with clear separation
3. **Preserved Context**: File paths maintain their repository context
4. **Scalable**: Works for repositories of any complexity

## Database Changes

### GitHub Document Migration

**File**: `backend/migrations/versions/migrate_github_folder_structure.py`

```python
"""Migrate GitHub documents to folder structure

Revision ID: 003_github_folder_migration
Revises: 002_add_folder_path
Create Date: 2025-08-30 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision = '003_github_folder_migration'
down_revision = '002_add_folder_path'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate GitHub documents to proper folder structure."""

    # Step 1: Update GitHub documents with proper folder paths
    # This query rebuilds folder_path for GitHub documents based on their metadata
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/GitHub/',
            COALESCE(
                (SELECT CONCAT(gr.owner, '-', gr.name)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'unknown-repo'
            ),
            '/',
            COALESCE(documents.github_branch, 'main'),
            CASE
                WHEN documents.github_file_path IS NOT NULL
                    AND documents.github_file_path != documents.name
                THEN CONCAT('/', SUBSTRING(documents.github_file_path FROM 1 FOR
                    LENGTH(documents.github_file_path) - LENGTH(documents.name) - 1))
                ELSE ''
            END
        )
        WHERE github_repository_id IS NOT NULL
        AND github_file_path IS NOT NULL
    """))

    # Step 2: Handle edge cases where GitHub file path doesn't end with document name
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/GitHub/',
            COALESCE(
                (SELECT CONCAT(gr.owner, '-', gr.name)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'unknown-repo'
            ),
            '/',
            COALESCE(documents.github_branch, 'main')
        )
        WHERE github_repository_id IS NOT NULL
        AND (github_file_path IS NULL OR folder_path LIKE '%//')
    """))


def downgrade() -> None:
    """Revert GitHub documents to category-based structure."""

    # Revert GitHub documents back to category-based folder paths
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/',
            COALESCE(
                (SELECT CONCAT(gr.name, '-', documents.github_branch)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'github-import'
            )
        )
        WHERE github_repository_id IS NOT NULL
    """))
```

### Enhanced GitHub Models

**File**: `backend/app/models/github_models.py` (if it exists, or add to document.py)

```python
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class GitHubRepository(Base):
    __tablename__ = "github_repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)  # owner/name

    # Add computed properties for folder path generation
    @property
    def folder_name(self) -> str:
        """Get sanitized folder name for this repository."""
        return f"{self.owner}-{self.name}".replace('/', '-').replace(' ', '-')

    def get_branch_folder_path(self, branch: str = "main") -> str:
        """Get the root folder path for a branch of this repository."""
        return f"/GitHub/{self.folder_name}/{branch}"

    def get_file_folder_path(self, file_path: str, branch: str = "main") -> str:
        """Get the folder path for a specific file in this repository."""
        # Extract directory from file path
        parts = file_path.split('/')
        if len(parts) > 1:
            dir_path = '/'.join(parts[:-1])
            return f"/GitHub/{self.folder_name}/{branch}/{dir_path}"
        else:
            return f"/GitHub/{self.folder_name}/{branch}"
```

## GitHub Service Updates

### Enhanced Import Logic

**File**: `backend/app/services/github_service.py`

```python
class GitHubService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.document_repo = DocumentRepository(session)

    async def import_repository_file(
        self,
        user_id: int,
        repository: GitHubRepository,
        file_data: dict,
        branch: str = "main"
    ) -> Document:
        """Import a single file from GitHub repository with proper folder structure."""

        # Extract file information
        file_path = file_data['path']
        file_name = file_data['name']
        file_content = await self.get_file_content(repository, file_path, branch)

        # Generate proper folder path
        folder_path = repository.get_file_folder_path(file_path, branch)

        # Check if document already exists
        existing_doc = await self.document_repo.get_github_document(
            user_id,
            repository.id,
            file_path,
            branch
        )

        if existing_doc:
            # Update existing document
            existing_doc.content = file_content
            existing_doc.folder_path = folder_path
            existing_doc.github_sha = file_data.get('sha')
            existing_doc.github_sync_status = 'synced'
            existing_doc.last_github_sync_at = datetime.utcnow()

            await self.session.commit()
            return existing_doc
        else:
            # Create new document
            document = await self.document_repo.create_document_in_folder(
                user_id=user_id,
                name=file_name,
                content=file_content,
                folder_path=folder_path,
                github_data={
                    'repository_id': repository.id,
                    'file_path': file_path,
                    'branch': branch,
                    'sha': file_data.get('sha')
                }
            )

            document.github_sync_status = 'synced'
            document.last_github_sync_at = datetime.utcnow()
            await self.session.commit()

            return document

    async def import_repository_batch(
        self,
        user_id: int,
        repository: GitHubRepository,
        file_list: list[dict],
        branch: str = "main"
    ) -> dict:
        """Import multiple files from repository maintaining folder structure."""

        results = {
            'imported': [],
            'updated': [],
            'errors': []
        }

        for file_data in file_list:
            try:
                # Skip non-markdown files or directories
                if file_data['type'] != 'file' or not file_data['name'].endswith('.md'):
                    continue

                document = await self.import_repository_file(
                    user_id, repository, file_data, branch
                )

                if document.created_at == document.updated_at:
                    results['imported'].append(document.id)
                else:
                    results['updated'].append(document.id)

            except Exception as e:
                results['errors'].append({
                    'file': file_data['name'],
                    'error': str(e)
                })

        return results

    async def sync_repository_structure(
        self,
        user_id: int,
        repository: GitHubRepository,
        branch: str = "main"
    ) -> dict:
        """Sync entire repository structure, updating folder paths for existing documents."""

        # Get all files from GitHub
        github_files = await self.get_repository_tree(repository, branch)

        # Get existing documents for this repository/branch
        existing_docs = await self.document_repo.get_github_documents_by_repo_branch(
            user_id, repository.id, branch
        )

        # Update folder paths for existing documents
        for doc in existing_docs:
            if doc.github_file_path:
                new_folder_path = repository.get_file_folder_path(
                    doc.github_file_path, branch
                )
                if doc.folder_path != new_folder_path:
                    doc.folder_path = new_folder_path

        await self.session.commit()

        # Import/update files
        return await self.import_repository_batch(
            user_id, repository, github_files, branch
        )
```

### Repository Query Updates

**File**: `backend/app/crud/document.py` (additions)

```python
class DocumentRepository:
    # ... existing methods ...

    async def get_github_document(
        self,
        user_id: int,
        repository_id: int,
        file_path: str,
        branch: str
    ) -> Document | None:
        """Get a specific GitHub document by repository metadata."""
        query = select(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_file_path == file_path,
            Document.github_branch == branch
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_github_documents_by_repo_branch(
        self,
        user_id: int,
        repository_id: int,
        branch: str
    ) -> list[Document]:
        """Get all documents for a specific repository/branch."""
        query = select(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_branch == branch
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_github_folders_for_user(self, user_id: int) -> list[str]:
        """Get all GitHub folder paths for a user."""
        query = select(Document.folder_path).where(
            Document.user_id == user_id,
            Document.github_repository_id.isnot(None),
            Document.folder_path.like('/GitHub/%')
        ).distinct()

        result = await self.session.execute(query)
        return result.scalars().all()

    async def cleanup_orphaned_github_documents(
        self,
        user_id: int,
        repository_id: int,
        branch: str,
        current_file_paths: list[str]
    ) -> int:
        """Remove documents that no longer exist in the GitHub repository."""
        query = delete(Document).where(
            Document.user_id == user_id,
            Document.github_repository_id == repository_id,
            Document.github_branch == branch,
            Document.github_file_path.notin_(current_file_paths)
        )

        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount
```

## API Endpoint Updates

### Enhanced GitHub Import Endpoints

**File**: `backend/app/routers/github.py`

```python
@router.post("/repositories/{repository_id}/import")
async def import_repository_files(
    repository_id: int,
    import_request: GitHubImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Import files from GitHub repository with proper folder structure."""

    # Get repository
    repo_query = select(GitHubRepository).where(GitHubRepository.id == repository_id)
    result = await db.execute(repo_query)
    repository = result.scalar_one_or_none()

    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Import files
    github_service = GitHubService(db)

    if import_request.file_paths:
        # Import specific files
        results = {'imported': [], 'updated': [], 'errors': []}
        for file_path in import_request.file_paths:
            try:
                file_data = await github_service.get_file_info(
                    repository, file_path, import_request.branch
                )
                document = await github_service.import_repository_file(
                    current_user.id, repository, file_data, import_request.branch
                )
                results['imported'].append(document.id)
            except Exception as e:
                results['errors'].append({'file': file_path, 'error': str(e)})
    else:
        # Import entire repository
        results = await github_service.import_repository_batch(
            current_user.id,
            repository,
            await github_service.get_repository_tree(repository, import_request.branch),
            import_request.branch
        )

    return {
        "repository_id": repository_id,
        "branch": import_request.branch,
        "results": results
    }

@router.post("/repositories/{repository_id}/sync")
async def sync_repository_structure(
    repository_id: int,
    sync_request: GitHubSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Sync repository structure and update folder paths."""

    repo_query = select(GitHubRepository).where(GitHubRepository.id == repository_id)
    result = await db.execute(repo_query)
    repository = result.scalar_one_or_none()

    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    github_service = GitHubService(db)
    results = await github_service.sync_repository_structure(
        current_user.id, repository, sync_request.branch
    )

    return {
        "repository_id": repository_id,
        "branch": sync_request.branch,
        "sync_results": results
    }

@router.get("/folders")
async def get_github_folders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Get all GitHub folder structures for the user."""

    doc_repo = DocumentRepository(db)
    github_folders = await doc_repo.get_github_folders_for_user(current_user.id)

    # Build hierarchical structure
    folder_tree = {}
    for folder_path in github_folders:
        parts = [p for p in folder_path.split('/') if p]
        current = folder_tree
        for part in parts:
            if part not in current:
                current[part] = {}
            current = current[part]

    return {
        "folder_tree": folder_tree,
        "total_folders": len(github_folders)
    }
```

### Request/Response Models

**File**: `backend/app/schemas/github.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List

class GitHubImportRequest(BaseModel):
    branch: str = Field(default="main", max_length=100)
    file_paths: Optional[List[str]] = None  # If None, import all files
    overwrite_existing: bool = Field(default=False)

class GitHubSyncRequest(BaseModel):
    branch: str = Field(default="main", max_length=100)
    cleanup_orphaned: bool = Field(default=True)

class GitHubImportResponse(BaseModel):
    repository_id: int
    branch: str
    results: dict
    folder_structure: dict

class GitHubFileInfo(BaseModel):
    name: str
    path: str
    folder_path: str  # New: computed folder path in our system
    sha: str
    size: int
    type: str  # file or dir
    download_url: Optional[str] = None
```

## Frontend Provider Updates

### GitHub Provider Enhancements

**File**: `frontend/src/services/FileBrowserProviders.js` (update from Phase 1)

```javascript
export class GitHubProvider extends BaseFileBrowserProvider {
  constructor(githubService, repository, branch) {
    super();
    this.githubService = githubService;
    this.repository = repository;
    this.branch = branch;
    this.rootPath = `/GitHub/${repository.owner}-${repository.name}/${branch}`;
  }

  async getTreeStructure() {
    const treeData = await this.githubService.getRepositoryTree(
      this.repository,
      this.branch
    );

    return this.convertGitHubTreeToFileNodes(treeData);
  }

  convertGitHubTreeToFileNodes(githubTree) {
    const rootNode = {
      id: 'root',
      name: `${this.repository.name} (${this.branch})`,
      type: 'folder',
      path: this.rootPath,
      source: 'github',
      children: []
    };

    // Build folder structure from flat GitHub tree
    const folderMap = new Map();
    folderMap.set('', rootNode);

    // Sort by path to ensure parent folders are created first
    const sortedFiles = githubTree.sort((a, b) => a.path.localeCompare(b.path));

    for (const item of sortedFiles) {
      const pathParts = item.path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const folderPath = pathParts.slice(0, -1).join('/');

      // Create intermediate folders if they don't exist
      let currentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        const partialPath = pathParts.slice(0, i + 1).join('/');
        if (!folderMap.has(partialPath)) {
          const folderNode = {
            id: `folder-${partialPath}`,
            name: pathParts[i],
            type: 'folder',
            path: `${this.rootPath}/${partialPath}`,
            source: 'github',
            children: []
          };

          const parentPath = pathParts.slice(0, i).join('/');
          const parent = folderMap.get(parentPath);
          parent.children.push(folderNode);
          folderMap.set(partialPath, folderNode);
        }
      }

      // Add file to its parent folder
      if (item.type === 'file' && item.name.endsWith('.md')) {
        const fileNode = {
          id: item.sha,
          name: fileName,
          type: 'file',
          path: `${this.rootPath}/${item.path}`,
          source: 'github',
          sha: item.sha,
          size: item.size,
          githubPath: item.path,
          downloadUrl: item.download_url
        };

        const parentFolder = folderMap.get(folderPath);
        if (parentFolder) {
          parentFolder.children.push(fileNode);
        }
      }
    }

    return [rootNode];
  }

  async getFilesInPath(path) {
    // Extract GitHub path from our internal path
    const githubPath = path.replace(this.rootPath, '').replace(/^\//, '');

    const treeData = await this.githubService.getRepositoryTree(
      this.repository,
      this.branch
    );

    // Filter files in the specific path
    return treeData
      .filter(item => {
        const itemFolder = item.path.split('/').slice(0, -1).join('/');
        return itemFolder === githubPath && item.type === 'file' && item.name.endsWith('.md');
      })
      .map(item => ({
        id: item.sha,
        name: item.name,
        type: 'file',
        path: `${this.rootPath}/${item.path}`,
        source: 'github',
        sha: item.sha,
        githubPath: item.path
      }));
  }

  async getFileContent(fileNode) {
    return await this.githubService.getFileContent(
      this.repository,
      fileNode.githubPath,
      this.branch
    );
  }
}
```

## Migration Script

**File**: `backend/scripts/migrate_github_structure.py`

```python
#!/usr/bin/env python3
"""Migration script for GitHub folder structure."""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.document import Document
from app.models.github_models import GitHubRepository
from app.database import get_database_url

async def migrate_github_documents():
    """Migrate existing GitHub documents to new folder structure."""

    engine = create_async_engine(get_database_url())
    async_session = sessionmaker(engine, class_=AsyncSession)

    async with async_session() as session:
        # Get all GitHub documents
        github_docs = await session.execute(
            select(Document).where(Document.github_repository_id.isnot(None))
        )
        documents = github_docs.scalars().all()

        print(f"Found {len(documents)} GitHub documents to migrate")

        updated_count = 0
        for doc in documents:
            if doc.github_repository and doc.github_file_path:
                # Generate new folder path
                new_folder_path = doc.github_repository.get_file_folder_path(
                    doc.github_file_path,
                    doc.github_branch or 'main'
                )

                if doc.folder_path != new_folder_path:
                    old_path = doc.folder_path
                    doc.folder_path = new_folder_path
                    updated_count += 1

                    print(f"Updated: {old_path} → {new_folder_path}")

        await session.commit()
        print(f"Migration complete: {updated_count} documents updated")

if __name__ == "__main__":
    asyncio.run(migrate_github_documents())
```

## Success Criteria

- [ ] GitHub documents use natural folder structure (`/GitHub/repo/branch/path`)
- [ ] Existing GitHub sync relationships are preserved
- [ ] Repository imports maintain original folder hierarchy
- [ ] Multiple branches from same repository can coexist
- [ ] Migration script successfully updates existing documents
- [ ] GitHub provider works with unified file browser
- [ ] Import/sync APIs work with new folder structure
- [ ] Performance is acceptable for large repositories

## Next Phase

Phase 5 will migrate the custom dictionary system to work with the new folder structure, implementing the simplified two-level approach (user + root folder) discussed earlier.

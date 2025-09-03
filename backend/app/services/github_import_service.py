"""Enhanced GitHub service for handling folder structure import and sync."""
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.crud.document import DocumentCRUD
from app.models.github_models import GitHubRepository
from app.models.document import Document
from app.services.github_service import GitHubService as BaseGitHubService


class GitHubImportService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.document_crud = DocumentCRUD()
        self.github_service = BaseGitHubService()

    async def import_repository_file(
        self,
        user_id: int,
        repository: GitHubRepository,
        access_token: str,
        file_data: dict,
        branch: str = "main"
    ) -> Document:
        """Import a single file from GitHub repository with proper folder structure."""

        # Extract file information
        file_path = file_data['path']
        file_name = file_data['name']
        
        # Get file content from GitHub
        try:
            file_content, github_sha = await self.github_service.get_file_content(
                access_token,
                repository.repo_owner,
                repository.repo_name,
                file_path,
                branch
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get file content: {str(e)}"
            )

        # Generate proper folder path using repository method
        folder_path = repository.get_file_folder_path(file_path, branch)

        # Check if document already exists
        existing_doc = await self.document_crud.get_github_document(
            self.session,
            user_id,
            repository.id,
            file_path,
            branch
        )

        if existing_doc:
            # Update existing document
            existing_doc.content = file_content
            existing_doc.folder_path = folder_path
            existing_doc.github_sha = github_sha
            existing_doc.github_sync_status = 'synced'
            existing_doc.last_github_sync_at = datetime.utcnow()
            existing_doc.local_sha = self._generate_content_hash(file_content)

            await self.session.commit()
            return existing_doc
        else:
            # Create new document
            document = await self.document_crud.create_document_in_folder(
                self.session,
                user_id=user_id,
                name=file_name,
                content=file_content,
                folder_path=folder_path,
                github_data={
                    'repository_id': repository.id,
                    'file_path': file_path,
                    'branch': branch,
                    'sha': github_sha
                }
            )

            document.github_sync_status = 'synced'
            document.last_github_sync_at = datetime.utcnow()
            document.local_sha = self._generate_content_hash(file_content)
            await self.session.commit()

            return document

    async def import_repository_batch(
        self,
        user_id: int,
        repository: GitHubRepository,
        access_token: str,
        file_list: List[dict],
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Import multiple files from repository maintaining folder structure."""

        results = {
            'imported': [],
            'updated': [],
            'errors': [],
            'skipped': []
        }

        for file_data in file_list:
            try:
                # Skip non-markdown files or directories
                if file_data['type'] != 'file' or not file_data['name'].endswith('.md'):
                    results['skipped'].append({
                        'file': file_data['name'],
                        'reason': 'Not a markdown file'
                    })
                    continue

                # Check if document already exists
                existing_doc = await self.document_crud.get_github_document(
                    self.session,
                    user_id,
                    repository.id,
                    file_data['path'],
                    branch
                )

                document = await self.import_repository_file(
                    user_id, repository, access_token, file_data, branch
                )

                if existing_doc:
                    results['updated'].append({
                        'document_id': document.id,
                        'file_path': file_data['path'],
                        'name': document.name
                    })
                else:
                    results['imported'].append({
                        'document_id': document.id,
                        'file_path': file_data['path'],
                        'name': document.name
                    })

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
        access_token: str,
        branch: str = "main"
    ) -> Dict[str, Any]:
        """Sync entire repository structure, updating folder paths for existing documents."""

        try:
            # Get all files from GitHub
            github_files = await self.github_service.get_repository_contents_cached(
                access_token,
                repository.repo_owner,
                repository.repo_name,
                repository.id,
                path="",
                ref=branch,
                force_refresh=True
            )

            # Filter for markdown files and flatten the structure
            markdown_files = await self._flatten_repository_files(github_files, access_token, repository, branch)

            # Get existing documents for this repository/branch
            existing_docs = await self.document_crud.get_github_documents_by_repo_branch(
                self.session, user_id, repository.id, branch
            )

            # Update folder paths for existing documents
            updated_paths = 0
            for doc in existing_docs:
                if doc.github_file_path:
                    new_folder_path = repository.get_file_folder_path(
                        doc.github_file_path, branch
                    )
                    if doc.folder_path != new_folder_path:
                        doc.folder_path = new_folder_path
                        updated_paths += 1

            await self.session.commit()

            # Import/update files
            import_results = await self.import_repository_batch(
                user_id, repository, access_token, markdown_files, branch
            )

            # Cleanup orphaned documents
            current_file_paths = [f['path'] for f in markdown_files]
            orphaned_count = await self.document_crud.cleanup_orphaned_github_documents(
                self.session, user_id, repository.id, branch, current_file_paths
            )

            return {
                'sync_results': import_results,
                'updated_folder_paths': updated_paths,
                'orphaned_documents_removed': orphaned_count,
                'total_files_processed': len(markdown_files)
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to sync repository structure: {str(e)}"
            )

    async def _flatten_repository_files(
        self,
        files: List[dict],
        access_token: str,
        repository: GitHubRepository,
        branch: str,
        current_path: str = ""
    ) -> List[dict]:
        """Recursively flatten repository structure to get all markdown files."""
        markdown_files = []

        for file_data in files:
            if file_data['type'] == 'file' and file_data['name'].endswith('.md'):
                markdown_files.append(file_data)
            elif file_data['type'] == 'dir':
                # Recursively get files from subdirectory
                try:
                    sub_path = file_data['path']
                    subdirectory_files = await self.github_service.get_repository_contents(
                        access_token,
                        repository.repo_owner,
                        repository.repo_name,
                        sub_path,
                        branch
                    )
                    
                    sub_markdown_files = await self._flatten_repository_files(
                        subdirectory_files, access_token, repository, branch, sub_path
                    )
                    markdown_files.extend(sub_markdown_files)
                    
                except Exception as e:
                    # Log error but continue processing other directories
                    print(f"Error processing directory {file_data['path']}: {e}")

        return markdown_files

    def _generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content for comparison."""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    async def get_folder_structure_for_user(self, user_id: int) -> Dict[str, Any]:
        """Get GitHub folder structure for a user as hierarchical tree."""
        
        github_folders = await self.document_crud.get_github_folders_for_user(
            self.session, user_id
        )

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
            "total_folders": len(github_folders),
            "github_folders": github_folders
        }

    async def get_repository_by_id(self, repository_id: int) -> Optional[GitHubRepository]:
        """Get repository by ID with account relationship loaded."""
        query = select(GitHubRepository).options(
            selectinload(GitHubRepository.account)
        ).where(GitHubRepository.id == repository_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

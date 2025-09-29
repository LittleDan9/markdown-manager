"""Validation utilities for GitHub save operations."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.document import DocumentCRUD
from app.crud.github_crud import GitHubCRUD
from app.models import User


async def validate_document_access(
    document_crud: DocumentCRUD,
    db: AsyncSession,
    document_id: int,
    current_user: User
):
    """Validate document ownership."""
    document = await document_crud.get(db, document_id)

    if not document or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    return document


async def validate_repository_access(
    github_crud: GitHubCRUD,
    db: AsyncSession,
    repository_id: int,
    current_user: User
):
    """Validate repository access for selected repositories."""
    # First try to get from GitHubRepository table
    repository = await github_crud.get_repository(db, repository_id)

    if repository and repository.account.user_id == current_user.id:
        return repository

    # If not found in GitHubRepository, check if it's a selected repository
    from app.services.github.repository_selector import GitHubRepositorySelector

    repository_selector = GitHubRepositorySelector()

    # Get all user accounts
    accounts = await github_crud.get_user_accounts(db, current_user.id)

    for account in accounts:
        selected_repos = await repository_selector.get_selected_repositories(
            db, account.id, active_only=True
        )

        for selection in selected_repos:
            # Check if this selection matches our repository_id
            if selection.id == repository_id:
                # Create a repository-like object from the selection data
                class MockRepository:
                    def __init__(self, selection, account):
                        self.id = selection.id
                        self.repo_name = selection.repo_name
                        self.repo_owner = selection.repo_owner
                        self.default_branch = selection.default_branch
                        self.is_private = selection.is_private
                        self.github_repo_id = selection.github_repo_id
                        self.account = account
                        self.account_id = account.id

                return MockRepository(selection, account)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Repository not found or not selected"
    )


def load_document_content_sync(storage_service, document, current_user: User) -> str:
    """Load document content from storage or fallback - synchronous version."""
    document_content = ""

    if hasattr(document, 'file_path') and document.file_path:
        try:
            # This would need to be adapted based on your storage service
            # For now, fallback to database content
            document_content = getattr(document, 'content', "")
        except Exception:
            # Fallback to database content
            document_content = getattr(document, 'content', "")
    else:
        # Legacy document without file_path
        document_content = getattr(document, 'content', "")

    if not document_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no content to save"
        )

    return document_content


async def get_existing_file_sha(
    github_service,
    repository,
    file_path: str,
    branch: str
) -> Optional[str]:
    """Get existing file SHA if file exists."""
    try:
        _, existing_sha = await github_service.get_file_content(
            repository.account.access_token,
            repository.repo_owner,
            repository.repo_name,
            file_path,
            branch
        )
        return existing_sha
    except Exception:
        # File doesn't exist, which is fine for new files
        return None
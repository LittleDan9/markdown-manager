"""migrate_github_folder_structure

Revision ID: 78bcb483103e
Revises: 3947d03d36fd
Create Date: 2025-09-01 00:40:43.813506

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = '78bcb483103e'
down_revision: Union[str, Sequence[str], None] = '3947d03d36fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate GitHub documents to proper folder structure."""
    
    # Step 1: Update GitHub documents with proper folder paths
    # This query rebuilds folder_path for GitHub documents based on their metadata
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/GitHub/',
            COALESCE(
                (SELECT CONCAT(gr.repo_owner, '-', gr.repo_name)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'unknown-repo'
            ),
            '/',
            COALESCE(documents.github_branch, 'main'),
            CASE
                WHEN documents.github_file_path IS NOT NULL
                    AND documents.github_file_path != documents.name
                    AND POSITION('/' IN documents.github_file_path) > 0
                THEN CONCAT('/', SUBSTRING(documents.github_file_path FROM 1 FOR
                    GREATEST(0, LENGTH(documents.github_file_path) - LENGTH(
                        SUBSTRING(documents.github_file_path FROM '[^/]*$')
                    ) - 1)))
                ELSE ''
            END
        )
        WHERE github_repository_id IS NOT NULL
        AND github_file_path IS NOT NULL
    """))

    # Step 2: Handle edge cases where folder path construction fails
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/GitHub/',
            COALESCE(
                (SELECT CONCAT(gr.repo_owner, '-', gr.repo_name)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'unknown-repo'
            ),
            '/',
            COALESCE(documents.github_branch, 'main')
        )
        WHERE github_repository_id IS NOT NULL
        AND (folder_path IS NULL OR folder_path = '' OR folder_path LIKE '%//')
    """))

    # Step 3: Clean up any double slashes in folder paths
    op.execute(text("""
        UPDATE documents
        SET folder_path = REPLACE(folder_path, '//', '/')
        WHERE github_repository_id IS NOT NULL
        AND folder_path LIKE '%//%'
    """))


def downgrade() -> None:
    """Revert GitHub documents to category-based folder paths."""
    
    # Revert GitHub documents back to category-based folder paths
    # This tries to reconstruct the old structure: /{repo-name}-{branch}
    op.execute(text("""
        UPDATE documents
        SET folder_path = CONCAT(
            '/',
            COALESCE(
                (SELECT CONCAT(gr.repo_name, '-', documents.github_branch)
                 FROM github_repositories gr
                 WHERE gr.id = documents.github_repository_id),
                'github-import'
            )
        )
        WHERE github_repository_id IS NOT NULL
    """))

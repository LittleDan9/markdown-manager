"""fix_document_uniqueness_constraints

Revision ID: 8e053a703637
Revises: 5592013a5379
Create Date: 2025-09-10 23:27:47.415904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e053a703637'
down_revision: Union[str, Sequence[str], None] = '5592013a5379'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Replace global name uniqueness with conditional constraints."""
    # Drop the problematic global name constraint
    op.drop_constraint('uq_user_name', 'documents', type_='unique')
    
    # Create conditional partial indexes for proper uniqueness
    
    # For local documents (where github_repository_id IS NULL)
    # Ensure unique (user_id, folder_path, name) for local documents
    op.execute("""
        CREATE UNIQUE INDEX uq_local_documents
        ON documents (user_id, folder_path, name)
        WHERE github_repository_id IS NULL
    """)
    
    # For GitHub documents (where github_repository_id IS NOT NULL)
    # Ensure unique (user_id, github_repository_id, github_file_path, github_branch)
    op.execute("""
        CREATE UNIQUE INDEX uq_github_documents
        ON documents (user_id, github_repository_id, github_file_path, github_branch)
        WHERE github_repository_id IS NOT NULL
    """)


def downgrade() -> None:
    """Downgrade schema: Restore original constraints (may fail if data conflicts)."""
    # Drop the conditional indexes
    op.drop_index('uq_github_documents', 'documents')
    op.drop_index('uq_local_documents', 'documents')
    
    # Restore the original constraint (this may fail if there are name conflicts)
    op.create_unique_constraint('uq_user_name', 'documents', ['user_id', 'name'])

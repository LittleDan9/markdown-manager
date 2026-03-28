"""fix_document_fk_cascades

Revision ID: d4d26c59b46c
Revises: f5a6b7c8d9e0
Create Date: 2026-03-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4d26c59b46c'
down_revision: Union[str, Sequence[str], None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add ondelete=SET NULL to git_operation_logs and github_sync_history FKs."""
    # git_operation_logs.document_id — drop and recreate FK with SET NULL
    op.drop_constraint(
        'git_operation_logs_document_id_fkey',
        'git_operation_logs',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'git_operation_logs_document_id_fkey',
        'git_operation_logs',
        'documents',
        ['document_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # github_sync_history.document_id — drop and recreate FK with SET NULL
    op.drop_constraint(
        'github_sync_history_document_id_fkey',
        'github_sync_history',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'github_sync_history_document_id_fkey',
        'github_sync_history',
        'documents',
        ['document_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Revert FKs back to NO ACTION (default)."""
    op.drop_constraint(
        'github_sync_history_document_id_fkey',
        'github_sync_history',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'github_sync_history_document_id_fkey',
        'github_sync_history',
        'documents',
        ['document_id'],
        ['id']
    )

    op.drop_constraint(
        'git_operation_logs_document_id_fkey',
        'git_operation_logs',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'git_operation_logs_document_id_fkey',
        'git_operation_logs',
        'documents',
        ['document_id'],
        ['id']
    )

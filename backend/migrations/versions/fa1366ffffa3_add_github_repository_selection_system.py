"""add_github_repository_selection_system

Revision ID: fa1366ffffa3
Revises: f6f4e8618f60
Create Date: 2025-09-19 13:05:43.163093

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa1366ffffa3'
down_revision: Union[str, Sequence[str], None] = 'f6f4e8618f60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add GitHub repository selection system."""

    # Create the GitHubRepositorySelection table
    op.create_table(
        'github_repository_selections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('github_account_id', sa.Integer(), nullable=False),
        sa.Column('github_repo_id', sa.Integer(), nullable=False),
        sa.Column('repo_name', sa.String(length=255), nullable=False),
        sa.Column('repo_full_name', sa.String(length=500), nullable=False),
        sa.Column('repo_owner', sa.String(length=255), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False, default=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('language', sa.String(length=50), nullable=True),
        sa.Column('default_branch', sa.String(length=255), nullable=False, default='main'),
        sa.Column('repo_updated_at', sa.DateTime(), nullable=True),
        sa.Column('selected_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('sync_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['github_account_id'], ['github_accounts.id']),
        sa.UniqueConstraint('github_account_id', 'github_repo_id', name='unique_account_repo_selection')
    )

    # Create indexes
    op.create_index('ix_github_repository_selections_github_account_id', 'github_repository_selections', ['github_account_id'])


def downgrade() -> None:
    """Remove GitHub repository selection system."""

    # Drop indexes
    op.drop_index('ix_github_repository_selections_github_account_id', table_name='github_repository_selections')

    # Drop table
    op.drop_table('github_repository_selections')

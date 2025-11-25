"""Add GitHub integration complete

Revision ID: 99d190ed73e6
Revises: e8ff44c7c77d
Create Date: 2025-08-28 12:46:49.830491

This migration combines the following previous migrations:
- 86770e62ceb7: Add GitHub integration models
- 4ce8da2733ee: Add last_sync field to github_account table
- 5577969e037f: Add Phase 2 GitHub fields

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99d190ed73e6'
down_revision: Union[str, Sequence[str], None] = 'e8ff44c7c77d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Complete GitHub integration."""

    # Create GitHub accounts table
    op.create_table('github_accounts',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('github_id', sa.Integer(), nullable=False),
                    sa.Column('username', sa.String(length=255), nullable=False),
                    sa.Column('display_name', sa.String(length=255), nullable=True),
                    sa.Column('email', sa.String(length=255), nullable=True),
                    sa.Column('avatar_url', sa.String(length=512), nullable=True),
                    sa.Column('access_token', sa.Text(), nullable=False),
                    sa.Column('refresh_token', sa.Text(), nullable=True),
                    sa.Column('token_expires_at', sa.DateTime(), nullable=True),
                    sa.Column('is_active', sa.Boolean(), nullable=True),
                    sa.Column('user_id', sa.Integer(), nullable=False),
                    sa.Column('last_sync', sa.DateTime(), nullable=True),  # From migration 4ce8da2733ee
                    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
                    sa.PrimaryKeyConstraint('id'),
                    sa.UniqueConstraint('github_id')
                    )
    op.create_index(op.f('ix_github_accounts_user_id'), 'github_accounts', ['user_id'], unique=False)

    # Create GitHub repositories table
    op.create_table('github_repositories',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('github_repo_id', sa.Integer(), nullable=False),
                    sa.Column('repo_full_name', sa.String(length=255), nullable=False),
                    sa.Column('repo_name', sa.String(length=255), nullable=False),
                    sa.Column('repo_owner', sa.String(length=255), nullable=False),
                    sa.Column('description', sa.Text(), nullable=True),
                    sa.Column('default_branch', sa.String(length=255), nullable=True),
                    sa.Column('is_private', sa.Boolean(), nullable=True),
                    sa.Column('is_enabled', sa.Boolean(), nullable=True),
                    sa.Column('last_sync_at', sa.DateTime(), nullable=True),
                    sa.Column('auto_sync_enabled', sa.Boolean(), nullable=True),
                    sa.Column('sync_interval_minutes', sa.Integer(), nullable=True),
                    sa.Column('account_id', sa.Integer(), nullable=False),
                    sa.ForeignKeyConstraint(['account_id'], ['github_accounts.id'], ),
                    sa.PrimaryKeyConstraint('id'),
                    sa.UniqueConstraint('account_id', 'repo_full_name', name='uq_account_repo')
                    )
    op.create_index(op.f('ix_github_repositories_account_id'), 'github_repositories', ['account_id'], unique=False)
    op.create_index(op.f('ix_github_repositories_repo_full_name'), 'github_repositories', ['repo_full_name'], unique=False)

    # Create GitHub sync history table
    op.create_table('github_sync_history',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('operation', sa.String(length=50), nullable=False),
                    sa.Column('status', sa.String(length=50), nullable=False),
                    sa.Column('commit_sha', sa.String(length=40), nullable=True),
                    sa.Column('branch_name', sa.String(length=255), nullable=True),
                    sa.Column('message', sa.Text(), nullable=True),
                    sa.Column('error_details', sa.Text(), nullable=True),
                    sa.Column('files_changed', sa.Integer(), nullable=True),
                    sa.Column('repository_id', sa.Integer(), nullable=False),
                    sa.Column('document_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
                    sa.ForeignKeyConstraint(['repository_id'], ['github_repositories.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )
    op.create_index(op.f('ix_github_sync_history_document_id'), 'github_sync_history', ['document_id'], unique=False)
    op.create_index(op.f('ix_github_sync_history_repository_id'), 'github_sync_history', ['repository_id'], unique=False)

    # Add GitHub integration fields to documents table (from migration 86770e62ceb7)
    op.add_column('documents', sa.Column('github_repository_id', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('github_file_path', sa.String(length=512), nullable=True))
    op.add_column('documents', sa.Column('github_sha', sa.String(length=40), nullable=True))
    op.add_column('documents', sa.Column('github_sync_status', sa.String(length=50), nullable=True))
    op.add_column('documents', sa.Column('last_github_sync_at', sa.DateTime(timezone=True), nullable=True))

    # Add Phase 2 GitHub fields to documents table (from migration 5577969e037f)
    op.add_column('documents', sa.Column('github_branch', sa.String(length=100), nullable=True))
    op.add_column('documents', sa.Column('local_sha', sa.String(length=64), nullable=True))
    op.add_column('documents', sa.Column('github_commit_message', sa.Text(), nullable=True))

    # Create indices and foreign keys for documents
    op.create_index(op.f('ix_documents_github_repository_id'), 'documents', ['github_repository_id'], unique=False)
    op.create_foreign_key(None, 'documents', 'github_repositories', ['github_repository_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema - Remove all GitHub integration."""

    # Drop foreign keys and indices from documents table
    op.drop_constraint(None, 'documents', type_='foreignkey')
    op.drop_index(op.f('ix_documents_github_repository_id'), table_name='documents')

    # Drop GitHub fields from documents table
    op.drop_column('documents', 'github_commit_message')
    op.drop_column('documents', 'local_sha')
    op.drop_column('documents', 'github_branch')
    op.drop_column('documents', 'last_github_sync_at')
    op.drop_column('documents', 'github_sync_status')
    op.drop_column('documents', 'github_sha')
    op.drop_column('documents', 'github_file_path')
    op.drop_column('documents', 'github_repository_id')

    # Drop GitHub sync history table
    op.drop_index(op.f('ix_github_sync_history_repository_id'), table_name='github_sync_history')
    op.drop_index(op.f('ix_github_sync_history_document_id'), table_name='github_sync_history')
    op.drop_table('github_sync_history')

    # Drop GitHub repositories table
    op.drop_index(op.f('ix_github_repositories_repo_full_name'), table_name='github_repositories')
    op.drop_index(op.f('ix_github_repositories_account_id'), table_name='github_repositories')
    op.drop_table('github_repositories')

    # Drop GitHub accounts table
    op.drop_index(op.f('ix_github_accounts_user_id'), table_name='github_accounts')
    op.drop_table('github_accounts')

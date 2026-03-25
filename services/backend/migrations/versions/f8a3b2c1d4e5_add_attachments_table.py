"""add_attachments_table

Revision ID: f8a3b2c1d4e5
Revises: 5933d9d6bdae
Create Date: 2026-05-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a3b2c1d4e5'
down_revision: Union[str, Sequence[str], None] = '5933d9d6bdae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False, comment='Original uploaded filename'),
        sa.Column('stored_filename', sa.String(length=255), nullable=False, comment='SHA-based stored filename'),
        sa.Column('mime_type', sa.String(length=100), nullable=False, comment='MIME type of the attachment'),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False, comment='File size in bytes'),
        sa.Column('content_hash', sa.String(length=64), nullable=False, comment='SHA-256 hash of file content'),
        sa.Column('scan_status', sa.String(length=20), nullable=False, server_default='pending', comment='Virus scan status: pending, clean, infected, error'),
        sa.Column('scan_result', sa.Text(), nullable=True, comment='Virus scan result details'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_attachments_id', 'attachments', ['id'])
    op.create_index('ix_attachments_document_id', 'attachments', ['document_id'])
    op.create_index('ix_attachments_user_id', 'attachments', ['user_id'])
    op.create_unique_constraint('uq_attachments_stored_filename', 'attachments', ['stored_filename'])

    op.add_column('users', sa.Column(
        'attachment_quota_bytes', sa.BigInteger(), nullable=True,
        comment='Per-user attachment storage quota in bytes (NULL = use site default)'
    ))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'attachment_quota_bytes')
    op.drop_index('ix_attachments_user_id', table_name='attachments')
    op.drop_index('ix_attachments_document_id', table_name='attachments')
    op.drop_index('ix_attachments_id', table_name='attachments')
    op.drop_constraint('uq_attachments_stored_filename', 'attachments', type_='unique')
    op.drop_table('attachments')

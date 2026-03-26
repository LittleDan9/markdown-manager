"""add_collaboration_tables

Revision ID: e4f5a6b7c8d9
Revises: f8a3b2c1d4e5
Create Date: 2026-03-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create collaboration tables."""
    # Document collaborators — who has access to a document and at what level
    op.create_table(
        'document_collaborators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='viewer',
                  comment='Permission level: editor or viewer'),
        sa.Column('invited_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'user_id', name='uq_document_collaborator'),
    )
    op.create_index('ix_document_collaborators_document_id', 'document_collaborators', ['document_id'])
    op.create_index('ix_document_collaborators_user_id', 'document_collaborators', ['user_id'])

    # Document collab state — persisted Yjs CRDT state for each document
    op.create_table(
        'document_collab_state',
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('yjs_state', sa.LargeBinary(), nullable=True, comment='Serialized Y.Doc state'),
        sa.Column('yjs_state_vector', sa.LargeBinary(), nullable=True, comment='Y.Doc state vector for incremental sync'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('document_id'),
    )


def downgrade() -> None:
    """Drop collaboration tables."""
    op.drop_table('document_collab_state')
    op.drop_index('ix_document_collaborators_user_id', table_name='document_collaborators')
    op.drop_index('ix_document_collaborators_document_id', table_name='document_collaborators')
    op.drop_table('document_collaborators')

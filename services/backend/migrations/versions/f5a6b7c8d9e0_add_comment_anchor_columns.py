"""add comment anchor columns

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-03-26 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('comments', sa.Column('anchor_text', sa.Text(), nullable=True))
    op.add_column('comments', sa.Column('anchor_ypos', sa.LargeBinary(), nullable=True))
    op.create_index('ix_comments_document_anchor', 'comments', ['document_id', 'anchor_text'])


def downgrade() -> None:
    op.drop_index('ix_comments_document_anchor', table_name='comments')
    op.drop_column('comments', 'anchor_ypos')
    op.drop_column('comments', 'anchor_text')

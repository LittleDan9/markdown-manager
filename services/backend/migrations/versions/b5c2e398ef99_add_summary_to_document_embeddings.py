"""add_summary_to_document_embeddings

Revision ID: b5c2e398ef99
Revises: 759207316785
Create Date: 2026-03-14 14:36:01.695574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5c2e398ef99'
down_revision: Union[str, Sequence[str], None] = '759207316785'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('document_embeddings', sa.Column('summary', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('document_embeddings', 'summary')

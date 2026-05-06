"""add_summary_and_cached_context_to_chat_conversations

Revision ID: f7a8b9c0d1e2
Revises: ca131637e68b
Create Date: 2026-05-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "ca131637e68b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_conversations", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("chat_conversations", sa.Column("cached_context", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_conversations", "cached_context")
    op.drop_column("chat_conversations", "summary")

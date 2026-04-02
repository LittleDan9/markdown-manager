"""add_notification_detail_column

Revision ID: a2b3c4d5e6f7
Revises: 4b60046cc7d9
Create Date: 2026-04-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str]] = '4b60046cc7d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('notifications', sa.Column('detail', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('notifications', 'detail')

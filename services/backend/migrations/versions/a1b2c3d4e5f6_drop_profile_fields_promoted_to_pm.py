"""drop profile fields promoted to platform manager

Revision ID: a1b2c3d4e5f6
Revises: fa1366ffffa3
Create Date: 2026-08-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fa1366ffffa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'first_name')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'bio')


def downgrade() -> None:
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('first_name', sa.String(100), nullable=True))

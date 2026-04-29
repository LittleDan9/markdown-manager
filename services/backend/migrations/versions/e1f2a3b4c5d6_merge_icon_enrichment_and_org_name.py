"""Merge icon enrichment and org name branches

Revision ID: e1f2a3b4c5d6
Revises: c4d5e6f7a8b9, f0a1b2c3d4e5
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = ('c4d5e6f7a8b9', 'f0a1b2c3d4e5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

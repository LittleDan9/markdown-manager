"""add_org_name_to_user_api_keys

Revision ID: f0a1b2c3d4e5
Revises: a1b2c3d4e5f7
Create Date: 2026-04-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_api_keys", sa.Column("org_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("user_api_keys", "org_name")

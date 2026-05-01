"""add_syntax_theme_settings

Revision ID: ca131637e68b
Revises: e1f2a3b4c5d6
Create Date: 2026-04-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ca131637e68b"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("syntax_theme", sa.String(50), nullable=False, server_default="one-dark"))
    op.add_column("users", sa.Column("syntax_overrides_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")))


def downgrade() -> None:
    op.drop_column("users", "syntax_overrides_enabled")
    op.drop_column("users", "syntax_theme")

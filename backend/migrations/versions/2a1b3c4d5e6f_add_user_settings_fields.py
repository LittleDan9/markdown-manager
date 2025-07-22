"""add sync_preview_scroll_enabled and autosave_enabled to users

Revision ID: 2a1b3c4d5e6f
Revises: 8f3a2c1d7b4a
Create Date: 2025-07-22 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a1b3c4d5e6f"
down_revision: Union[str, Sequence[str], None] = "8f3a2c1d7b4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "sync_preview_scroll_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "autosave_enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "sync_preview_scroll_enabled")
    op.drop_column("users", "autosave_enabled")

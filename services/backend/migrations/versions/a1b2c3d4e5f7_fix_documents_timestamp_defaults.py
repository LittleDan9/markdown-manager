"""fix documents timestamp defaults and nullable

Revision ID: a1b2c3d4e5f7
Revises: e9f0a1b2c3d4
Create Date: 2026-04-15 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fill any NULL timestamps before applying NOT NULL
    op.execute("UPDATE documents SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE documents SET updated_at = now() WHERE updated_at IS NULL")

    # Ensure server defaults exist
    op.alter_column(
        "documents",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )
    op.alter_column(
        "documents",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "documents",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=True,
    )
    op.alter_column(
        "documents",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        nullable=True,
    )

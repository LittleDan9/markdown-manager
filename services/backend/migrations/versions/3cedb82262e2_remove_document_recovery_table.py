"""Remove document_recovery table

Revision ID: 3cedb82262e2
Revises: 8821a39ebdc7
Create Date: 2025-08-14 00:01:08.520621

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3cedb82262e2"
down_revision: Union[str, Sequence[str], None] = "8821a39ebdc7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove document_recovery table and its index."""
    # Drop the index first
    op.drop_index(op.f("ix_document_recovery_id"), table_name="document_recovery")
    # Drop the table
    op.drop_table("document_recovery")


def downgrade() -> None:
    """Recreate document_recovery table and its index."""
    # Recreate the document_recovery table
    op.create_table(
        "document_recovery",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("recovered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("collision", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Recreate the index
    op.create_index(
        op.f("ix_document_recovery_id"), "document_recovery", ["id"], unique=False
    )

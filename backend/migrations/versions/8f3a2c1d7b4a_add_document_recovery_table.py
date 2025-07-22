"""add document recovery table

Revision ID: 8f3a2c1d7b4a
Revises: 0450cbd56879
Create Date: 2025-07-18 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f3a2c1d7b4a"
down_revision: Union[str, Sequence[str], None] = "0450cbd56879"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_recovery",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("document_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("recovered_at", sa.DateTime(), nullable=False),
        sa.Column("collision", sa.Boolean(), default=False),
    )


def downgrade() -> None:
    op.drop_table("document_recovery")

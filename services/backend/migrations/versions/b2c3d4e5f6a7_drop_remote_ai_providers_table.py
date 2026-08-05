"""drop remote_ai_providers table (cross-app provider sync removed)

Revision ID: b2c3d4e5f6a7
Revises: a1c2e3f4a5b6, 4b60046cc7d9
Create Date: 2026-07-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = ("a1c2e3f4a5b6", "4b60046cc7d9")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("remote_ai_providers")


def downgrade() -> None:
    op.create_table(
        "remote_ai_providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_app", sa.String(50), nullable=False),
        sa.Column("remote_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("label", sa.String(200), nullable=False, server_default=""),
        sa.Column("base_url", sa.String(500), nullable=True),
        sa.Column("preferred_model", sa.String(200), nullable=True),
        sa.Column("org_name", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("has_key", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "source_app", "remote_id", name="uq_remote_ai_provider"),
    )

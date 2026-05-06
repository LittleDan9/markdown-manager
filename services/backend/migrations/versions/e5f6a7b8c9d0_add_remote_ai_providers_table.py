"""add remote_ai_providers table for cross-app sync

Revision ID: e5f6a7b8c9d0
Revises: f7a8b9c0d1e2
Create Date: 2026-05-05
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "remote_ai_providers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_app", sa.String(50), nullable=False),
        sa.Column("remote_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("label", sa.String(200), server_default=""),
        sa.Column("base_url", sa.String(512), nullable=True),
        sa.Column("preferred_model", sa.String(200), nullable=True),
        sa.Column("org_name", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("has_key", sa.Boolean(), server_default="false"),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "source_app", "remote_id", name="uq_remote_ai_provider"),
    )


def downgrade() -> None:
    op.drop_table("remote_ai_providers")

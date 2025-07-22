"""add sync_preview_scroll_enabled and autosave_enabled to users

Revision ID: add_user_settings_fields
Revises: <previous_revision_id>
Create Date: 2025-07-22

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_user_settings_fields"
down_revision = "<previous_revision_id>"
branch_labels = None
depends_on = None


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

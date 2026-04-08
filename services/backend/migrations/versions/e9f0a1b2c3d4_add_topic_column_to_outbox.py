"""add topic column to outbox table

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-04-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e9f0a1b2c3d4'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add topic column to identity.outbox for per-event stream routing."""
    op.execute("""
        ALTER TABLE identity.outbox
        ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'identity.user.v1'
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_identity_outbox_topic
        ON identity.outbox(topic)
    """)


def downgrade() -> None:
    """Remove topic column."""
    op.execute("DROP INDEX IF EXISTS idx_identity_outbox_topic")
    op.execute("ALTER TABLE identity.outbox DROP COLUMN IF EXISTS topic")

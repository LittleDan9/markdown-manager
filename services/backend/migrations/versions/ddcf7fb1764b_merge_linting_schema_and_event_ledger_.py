"""Merge linting schema and event ledger migrations

Revision ID: ddcf7fb1764b
Revises: 4c62504c524d, a1b2c3d4e5f6
Create Date: 2025-11-24 02:49:56.452094

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ddcf7fb1764b'
down_revision: Union[str, Sequence[str], None] = ('4c62504c524d', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Apply event ledger migration that wasn't applied due to merge
    # Create event_ledger table for identity service
    op.create_table(
        'event_ledger',
        sa.Column('event_id', postgresql.UUID(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('consumer_group', sa.String(length=100), nullable=False),
        sa.Column('processing_result', sa.String(length=50), server_default=sa.text("'success'"), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.CheckConstraint("processing_result IN ('success', 'failure', 'skipped')", name='event_ledger_result_check'),
        sa.PrimaryKeyConstraint('event_id'),
        schema='identity'
    )
    op.create_index('idx_identity_event_ledger_type_processed', 'event_ledger', ['event_type', 'processed_at'], unique=False, schema='identity')
    op.create_index('idx_identity_event_ledger_consumer_group', 'event_ledger', ['consumer_group', 'processed_at'], unique=False, schema='identity')

    # Create event_ledger table for public schema (other consumers)
    op.create_table(
        'event_ledger',
        sa.Column('event_id', postgresql.UUID(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('consumer_group', sa.String(length=100), nullable=False),
        sa.Column('processing_result', sa.String(length=50), server_default=sa.text("'success'"), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.CheckConstraint("processing_result IN ('success', 'failure', 'skipped')", name='event_ledger_result_check'),
        sa.PrimaryKeyConstraint('event_id'),
        schema='public'
    )
    op.create_index('idx_public_event_ledger_type_processed', 'event_ledger', ['event_type', 'processed_at'], unique=False, schema='public')
    op.create_index('idx_public_event_ledger_consumer_group', 'event_ledger', ['consumer_group', 'processed_at'], unique=False, schema='public')

    # Create cleanup function (this is OK to use SQL for functions)
    op.execute("""
        CREATE OR REPLACE FUNCTION cleanup_event_ledger() RETURNS void AS $$
        BEGIN
            DELETE FROM identity.event_ledger
            WHERE processed_at < NOW() - INTERVAL '30 days';

            DELETE FROM public.event_ledger
            WHERE processed_at < NOW() - INTERVAL '30 days';

            RAISE NOTICE 'Event ledger cleanup completed';
        END;
        $$ LANGUAGE plpgsql
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove event ledger components
    op.execute("DROP FUNCTION IF EXISTS cleanup_event_ledger()")

    # Drop identity schema event_ledger (use IF EXISTS for safer downgrade)
    op.execute("DROP INDEX IF EXISTS identity.idx_identity_event_ledger_consumer_group")
    op.execute("DROP INDEX IF EXISTS identity.idx_identity_event_ledger_type_processed")
    op.execute("DROP TABLE IF EXISTS identity.event_ledger")

    # Drop public schema event_ledger (use IF EXISTS for safer downgrade)
    op.execute("DROP INDEX IF EXISTS public.idx_public_event_ledger_consumer_group")
    op.execute("DROP INDEX IF EXISTS public.idx_public_event_ledger_type_processed")
    op.execute("DROP TABLE IF EXISTS public.event_ledger")

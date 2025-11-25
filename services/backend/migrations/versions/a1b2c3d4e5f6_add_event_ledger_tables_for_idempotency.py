"""Add event ledger tables for idempotency tracking

Revision ID: a1b2c3d4e5f6
Revises: fa1366ffffa3
Create Date: 2025-11-24 07:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'fa1366ffffa3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create event_ledger table for identity service
    op.execute("""
        CREATE TABLE IF NOT EXISTS identity.event_ledger (
            event_id UUID PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            consumer_group VARCHAR(100) NOT NULL,
            processing_result VARCHAR(50) DEFAULT 'success',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

            CONSTRAINT event_ledger_result_check
                CHECK (processing_result IN ('success', 'failure', 'skipped'))
        )
    """)

    # Create indices for performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_identity_event_ledger_type_processed
            ON identity.event_ledger (event_type, processed_at)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_identity_event_ledger_consumer_group
            ON identity.event_ledger (consumer_group, processed_at)
    """)

    # Create event_ledger table for public schema (other consumers)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.event_ledger (
            event_id UUID PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            consumer_group VARCHAR(100) NOT NULL,
            processing_result VARCHAR(50) DEFAULT 'success',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

            CONSTRAINT event_ledger_result_check
                CHECK (processing_result IN ('success', 'failure', 'skipped'))
        )
    """)

    # Create indices for performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_public_event_ledger_type_processed
            ON public.event_ledger (event_type, processed_at)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_public_event_ledger_consumer_group
            ON public.event_ledger (consumer_group, processed_at)
    """)

    # Create cleanup function to remove old ledger entries (keep last 30 days)
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
    # Drop cleanup function
    op.execute("DROP FUNCTION IF EXISTS cleanup_event_ledger()")

    # Drop identity schema event_ledger
    op.execute("DROP INDEX IF EXISTS identity.idx_identity_event_ledger_consumer_group")
    op.execute("DROP INDEX IF EXISTS identity.idx_identity_event_ledger_type_processed")
    op.execute("DROP TABLE IF EXISTS identity.event_ledger")

    # Drop public schema event_ledger (only if it doesn't exist from manual creation)
    op.execute("DROP INDEX IF EXISTS public.idx_public_event_ledger_consumer_group")
    op.execute("DROP INDEX IF EXISTS public.idx_public_event_ledger_type_processed")
    # Note: We don't drop the public event_ledger table as it may have been created manually
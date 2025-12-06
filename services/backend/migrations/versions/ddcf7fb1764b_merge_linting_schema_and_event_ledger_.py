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
    # Ensure identity schema exists first
    op.execute("CREATE SCHEMA IF NOT EXISTS identity")
    
    # Apply event ledger migration that wasn't applied due to merge
    # Create event_ledger table for identity service (use IF NOT EXISTS since this is a merge)
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
    # Create indices for performance (use IF NOT EXISTS since this is a merge)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_identity_event_ledger_type_processed "
        "ON identity.event_ledger (event_type, processed_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_identity_event_ledger_consumer_group "
        "ON identity.event_ledger (consumer_group, processed_at)"
    )

    # Create event_ledger table for public schema (use IF NOT EXISTS since this is a merge)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.event_ledger (
            event_id UUID NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            consumer_group VARCHAR(100) NOT NULL,
            processing_result VARCHAR(50) DEFAULT 'success',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (event_id),
            CONSTRAINT event_ledger_result_check CHECK (processing_result IN ('success', 'failure', 'skipped'))
        )
    """)
    # Create indices for performance (use IF NOT EXISTS since this is a merge)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_public_event_ledger_type_processed "
        "ON public.event_ledger (event_type, processed_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_public_event_ledger_consumer_group "
        "ON public.event_ledger (consumer_group, processed_at)"
    )

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

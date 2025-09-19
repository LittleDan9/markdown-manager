"""fix_timezone_aware_datetimes

Revision ID: 4a00a3cac078
Revises: fa1366ffffa3
Create Date: 2025-09-19 13:06:01.823806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a00a3cac078'
down_revision: Union[str, Sequence[str], None] = 'fa1366ffffa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix all timezone-naive datetime columns to use timezone-aware timestamps."""

    # Convert all datetime columns to timestamptz (timezone-aware)
    # This automatically interprets existing naive timestamps as UTC

    # Fix github_accounts table
    op.execute("""
        ALTER TABLE github_accounts
        ALTER COLUMN last_sync TYPE timestamptz
        USING last_sync AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE github_accounts
        ALTER COLUMN token_expires_at TYPE timestamptz
        USING token_expires_at AT TIME ZONE 'UTC'
    """)

    # Fix github_repositories table
    op.execute("""
        ALTER TABLE github_repositories
        ALTER COLUMN last_sync_at TYPE timestamptz
        USING last_sync_at AT TIME ZONE 'UTC'
    """)

    # Fix github_repository_selections table
    op.execute("""
        ALTER TABLE github_repository_selections
        ALTER COLUMN selected_at TYPE timestamptz
        USING selected_at AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE github_repository_selections
        ALTER COLUMN last_synced_at TYPE timestamptz
        USING last_synced_at AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE github_repository_selections
        ALTER COLUMN repo_updated_at TYPE timestamptz
        USING repo_updated_at AT TIME ZONE 'UTC'
    """)

    # Fix base model timestamps
    op.execute("""
        ALTER TABLE github_repository_selections
        ALTER COLUMN created_at TYPE timestamptz
        USING created_at AT TIME ZONE 'UTC'
    """)
    op.execute("""
        ALTER TABLE github_repository_selections
        ALTER COLUMN updated_at TYPE timestamptz
        USING updated_at AT TIME ZONE 'UTC'
    """)

    # Fix github_sync_history table if it exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_sync_history') THEN
                ALTER TABLE github_sync_history ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
                ALTER TABLE github_sync_history ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Convert timezone-aware timestamps back to naive timestamps."""

    # Convert back to timestamp without timezone (loses timezone info)
    op.execute("ALTER TABLE github_accounts ALTER COLUMN last_sync TYPE timestamp")
    op.execute("ALTER TABLE github_accounts ALTER COLUMN token_expires_at TYPE timestamp")

    op.execute("ALTER TABLE github_repositories ALTER COLUMN last_sync_at TYPE timestamp")

    op.execute("ALTER TABLE github_repository_selections ALTER COLUMN selected_at TYPE timestamp")
    op.execute("ALTER TABLE github_repository_selections ALTER COLUMN last_synced_at TYPE timestamp")
    op.execute("ALTER TABLE github_repository_selections ALTER COLUMN repo_updated_at TYPE timestamp")
    op.execute("ALTER TABLE github_repository_selections ALTER COLUMN created_at TYPE timestamp")
    op.execute("ALTER TABLE github_repository_selections ALTER COLUMN updated_at TYPE timestamp")

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'github_sync_history') THEN
                ALTER TABLE github_sync_history ALTER COLUMN created_at TYPE timestamp;
                ALTER TABLE github_sync_history ALTER COLUMN updated_at TYPE timestamp;
            END IF;
        END $$;
    """)

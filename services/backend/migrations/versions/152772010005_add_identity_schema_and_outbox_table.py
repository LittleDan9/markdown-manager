"""add identity schema and outbox table

Revision ID: 152772010005
Revises: 74f38b18377a
Create Date: 2025-11-23 00:59:39.077583

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '152772010005'
down_revision: Union[str, Sequence[str], None] = '74f38b18377a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Enable CITEXT extension for case-insensitive text
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    # Create identity schema
    op.execute("CREATE SCHEMA IF NOT EXISTS identity")

    # Create identity.users table
    op.execute("""
        CREATE TABLE IF NOT EXISTS identity.users (
            user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
            email CITEXT UNIQUE NOT NULL,
            display_name TEXT,
            status TEXT NOT NULL CHECK (status IN ('active','disabled')) DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Create identity.outbox table
    op.execute("""
        CREATE TABLE IF NOT EXISTS identity.outbox (
            id BIGSERIAL PRIMARY KEY,
            event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            event_type TEXT NOT NULL,
            aggregate_type TEXT NOT NULL DEFAULT 'user',
            aggregate_id UUID NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            published BOOLEAN NOT NULL DEFAULT FALSE,
            attempts INT NOT NULL DEFAULT 0,
            next_attempt_at TIMESTAMPTZ,
            published_at TIMESTAMPTZ,
            error_message TEXT
        )
    """)

    # Create indexes for performance
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_users_email ON identity.users(email)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_users_tenant_id ON identity.users(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_users_status ON identity.users(status)")

    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_outbox_published ON identity.outbox(published)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_outbox_event_type ON identity.outbox(event_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_outbox_aggregate_id ON identity.outbox(aggregate_id)")
    op.execute("""CREATE INDEX IF NOT EXISTS idx_identity_outbox_next_attempt
                  ON identity.outbox(next_attempt_at) WHERE published = FALSE""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_identity_outbox_created_at ON identity.outbox(created_at)")

    # Add a column to existing users table to link to identity.users
    op.add_column('users', sa.Column('identity_user_id', sa.UUID(), nullable=True))
    op.create_index('idx_users_identity_user_id', 'users', ['identity_user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the identity_user_id column from users table
    op.drop_index('idx_users_identity_user_id', 'users')
    op.drop_column('users', 'identity_user_id')

    # Drop identity schema and all its contents
    op.execute("DROP SCHEMA IF EXISTS identity CASCADE")

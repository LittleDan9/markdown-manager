"""create_linting_schema_and_tables

Revision ID: 4c62504c524d
Revises: 881684d8b658
Create Date: 2025-11-23 08:56:43.155975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4c62504c524d'
down_revision: Union[str, Sequence[str], None] = '881684d8b658'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create linting schema
    op.execute("CREATE SCHEMA IF NOT EXISTS linting")

    # Create identity_projection table
    op.create_table(
        'identity_projection',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('display_name', sa.Text(), nullable=True),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('tenant_id', 'user_id'),
        schema='linting'
    )

    # Create event_ledger table
    op.create_table(
        'event_ledger',
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('received_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('event_id'),
        schema='linting'
    )

    # Create user_prefs table
    op.create_table(
        'user_prefs',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rules', postgresql.JSONB(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('tenant_id', 'user_id'),
        schema='linting'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop tables
    op.drop_table('user_prefs', schema='linting')
    op.drop_table('event_ledger', schema='linting')
    op.drop_table('identity_projection', schema='linting')

    # Drop schema
    op.execute("DROP SCHEMA IF EXISTS linting CASCADE")

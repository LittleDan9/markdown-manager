"""Add site_settings table

Revision ID: a1b2c3d4e5f6
Revises: 759207316785
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9d8e7f6a5b4'
down_revision: Union[str, Sequence[str], None] = 'b5c2e398ef99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'site_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(128), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )
    op.create_index('ix_site_settings_key', 'site_settings', ['key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_site_settings_key', table_name='site_settings')
    op.drop_table('site_settings')

"""add_user_api_keys_table

Revision ID: 293b510cbb08
Revises: b3c4d5e6f7a8
Create Date: 2026-04-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '293b510cbb08'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_api_keys table for per-user LLM provider key storage."""
    op.create_table(
        'user_api_keys',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(32), nullable=False),
        sa.Column('api_key_encrypted', sa.Text(), nullable=False),
        sa.Column('label', sa.String(128), nullable=True),
        sa.Column('base_url', sa.String(512), nullable=True),
        sa.Column('preferred_model', sa.String(128), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_api_keys_id', 'user_api_keys', ['id'])
    op.create_index('ix_user_api_keys_user_id', 'user_api_keys', ['user_id'])
    op.create_index(
        'ix_user_api_keys_user_provider',
        'user_api_keys',
        ['user_id', 'provider'],
    )


def downgrade() -> None:
    """Drop user_api_keys table."""
    op.drop_index('ix_user_api_keys_user_provider', table_name='user_api_keys')
    op.drop_index('ix_user_api_keys_user_id', table_name='user_api_keys')
    op.drop_index('ix_user_api_keys_id', table_name='user_api_keys')
    op.drop_table('user_api_keys')

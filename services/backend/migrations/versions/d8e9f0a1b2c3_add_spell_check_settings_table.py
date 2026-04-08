"""add spell_check_settings table

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-04-07 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'spell_check_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('analysis_types', sa.JSON(), nullable=False),
        sa.Column('grammar_rules', sa.JSON(), nullable=False),
        sa.Column('style_settings', sa.JSON(), nullable=False),
        sa.Column('code_spell_settings', sa.JSON(), nullable=False),
        sa.Column('selected_language', sa.String(length=20), nullable=False, server_default='en-US'),
        sa.Column('selected_style_guide', sa.String(length=50), nullable=False, server_default='none'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_spell_check_settings_user'),
    )
    op.create_index(op.f('ix_spell_check_settings_id'), 'spell_check_settings', ['id'])
    op.create_index(op.f('ix_spell_check_settings_user_id'), 'spell_check_settings', ['user_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_spell_check_settings_user_id'), table_name='spell_check_settings')
    op.drop_index(op.f('ix_spell_check_settings_id'), table_name='spell_check_settings')
    op.drop_table('spell_check_settings')

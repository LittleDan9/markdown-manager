"""add_tab_preferences

Revision ID: 5933d9d6bdae
Revises: c9d8e7f6a5b4
Create Date: 2026-03-23 13:11:00.444893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5933d9d6bdae'
down_revision: Union[str, Sequence[str], None] = 'c9d8e7f6a5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('categories', sa.Column('tabs_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('tab_position', sa.String(length=10), nullable=False, server_default='above'))
    op.add_column('users', sa.Column('tab_sort_order', sa.String(length=10), nullable=False, server_default='name'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'tab_sort_order')
    op.drop_column('users', 'tab_position')
    op.drop_column('categories', 'tabs_enabled')

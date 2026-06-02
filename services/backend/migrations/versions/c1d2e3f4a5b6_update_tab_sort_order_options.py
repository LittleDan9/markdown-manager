"""update tab_sort_order column width and migrate values

Revision ID: c1d2e3f4a5b6
Revises: a7b8c9d0e1f2
Create Date: 2026-06-01

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Widen column to accommodate new sort option names
    op.alter_column('users', 'tab_sort_order',
                    type_=sa.String(20),
                    existing_type=sa.String(10),
                    existing_nullable=False)

    # Migrate existing values to new sort option names
    op.execute("UPDATE users SET tab_sort_order = 'alpha_asc' WHERE tab_sort_order = 'name'")
    op.execute("UPDATE users SET tab_sort_order = 'opened_desc' WHERE tab_sort_order = 'modified'")
    op.execute("UPDATE users SET tab_sort_order = 'opened_desc' WHERE tab_sort_order = 'created'")

    # Update server default
    op.alter_column('users', 'tab_sort_order',
                    server_default='opened_desc',
                    existing_type=sa.String(20),
                    existing_nullable=False)


def downgrade() -> None:
    # Revert values
    op.execute("UPDATE users SET tab_sort_order = 'name' WHERE tab_sort_order IN ('alpha_asc', 'alpha_desc')")
    op.execute("UPDATE users SET tab_sort_order = 'modified' WHERE tab_sort_order IN ('opened_desc', 'opened_asc')")

    # Revert column width and default
    op.alter_column('users', 'tab_sort_order',
                    type_=sa.String(10),
                    server_default='name',
                    existing_type=sa.String(20),
                    existing_nullable=False)

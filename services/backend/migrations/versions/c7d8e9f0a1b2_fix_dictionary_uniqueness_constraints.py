"""fix dictionary uniqueness constraints

Revision ID: c7d8e9f0a1b2
Revises: b5feb941a31d
Create Date: 2026-04-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b5feb941a31d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old folder constraint that was missing user_id
    op.drop_constraint('uq_folder_dictionary_word', 'custom_dictionaries', type_='unique')

    # Add user_id-scoped folder constraint to prevent cross-user collisions
    op.create_unique_constraint(
        'uq_user_folder_dictionary_word',
        'custom_dictionaries',
        ['user_id', 'folder_path', 'word'],
    )

    # Add partial unique index for user-level words (no category, no folder)
    # This prevents duplicate user-scoped words that the app checks at the application layer
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_uq_user_level_word "
        "ON custom_dictionaries (user_id, word) "
        "WHERE category_id IS NULL AND folder_path IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_uq_user_level_word")

    op.drop_constraint('uq_user_folder_dictionary_word', 'custom_dictionaries', type_='unique')

    op.create_unique_constraint(
        'uq_folder_dictionary_word',
        'custom_dictionaries',
        ['folder_path', 'word'],
    )

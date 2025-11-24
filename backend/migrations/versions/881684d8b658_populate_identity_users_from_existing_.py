"""populate identity users from existing users

Revision ID: 881684d8b658
Revises: 152772010005
Create Date: 2025-11-23 01:00:54.876696

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '881684d8b658'
down_revision: Union[str, Sequence[str], None] = '152772010005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Populate identity.users from existing users table
    op.execute("""
        INSERT INTO identity.users (user_id, email, display_name, status, created_at, updated_at)
        SELECT
            gen_random_uuid() as user_id,
            email,
            COALESCE(display_name, first_name || ' ' || last_name,
                     CASE WHEN first_name IS NOT NULL THEN first_name ELSE NULL END) as display_name,
            CASE WHEN is_active = true THEN 'active' ELSE 'disabled' END as status,
            created_at,
            updated_at
        FROM users
        WHERE email IS NOT NULL
        ON CONFLICT (email) DO NOTHING
    """)

    # Update the original users table with identity_user_id references
    op.execute("""
        UPDATE users u
        SET identity_user_id = iu.user_id
        FROM identity.users iu
        WHERE u.email = iu.email
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Clear the identity_user_id references
    op.execute("UPDATE users SET identity_user_id = NULL")

    # Clear the identity.users table
    op.execute("TRUNCATE identity.users")

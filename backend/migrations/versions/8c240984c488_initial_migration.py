"""Initial migration

Revision ID: 8c240984c488
Revises:
Create Date: 2025-07-03 10:36:50.584517

"""
# revision identifiers, used by Alembic.

# revision identifiers, used by Alembic.
revision = "8c240984c488"
down_revision = None
branch_labels = None
depends_on = None

from alembic import op


def upgrade() -> None:
    """Upgrade schema."""
    # Create users table based on app.models.user.User
    from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

    op.create_table(
        "users",
        Column("id", Integer, primary_key=True, index=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("email", String(255), unique=True, index=True, nullable=False),
        Column("hashed_password", String(255), nullable=False),
        Column("reset_token", String(255), nullable=True),
        Column("reset_token_expires", DateTime, nullable=True),
        Column("mfa_enabled", Boolean, default=False),
        Column("totp_secret", String(255), nullable=True),
        Column("backup_codes", Text, nullable=True),
        Column("first_name", String(100), nullable=True),
        Column("last_name", String(100), nullable=True),
        Column("display_name", String(100), nullable=True),
        Column("bio", Text, nullable=True),
        Column("is_active", Boolean, default=True),
        Column("is_verified", Boolean, default=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("users")

"""Initial migration with all models

Revision ID: 8821a39ebdc7
Revises:
Create Date: 2025-08-12 09:35:09.051903

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8821a39ebdc7"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial schema."""
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("reset_token", sa.String(), nullable=True),
        sa.Column("reset_token_expires", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=True),
        sa.Column("totp_secret", sa.String(), nullable=True),
        sa.Column("backup_codes", sa.JSON(), nullable=True),
        sa.Column("first_name", sa.String(), nullable=True),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=True),
        sa.Column("current_doc_id", sa.Integer(), nullable=True),
        sa.Column("sync_preview_scroll_enabled", sa.Boolean(), nullable=True),
        sa.Column("autosave_enabled", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    # Create documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)

    # Create custom_dictionaries table
    op.create_table(
        "custom_dictionaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("word", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_custom_dictionaries_id"), "custom_dictionaries", ["id"], unique=False
    )

    # Create document_recovery table
    op.create_table(
        "document_recovery",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("recovered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("collision", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_recovery_id"), "document_recovery", ["id"], unique=False
    )

    # Create icon_packs table
    op.create_table(
        "icon_packs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False, comment="Unique identifier like 'awssvg', 'logos'"),
        sa.Column("display_name", sa.String(255), nullable=False, comment="Human readable name like 'AWS Services'"),
        sa.Column("category", sa.String(100), nullable=False, comment="Grouping like 'aws', 'iconify'"),
        sa.Column("description", sa.Text(), nullable=True, comment="Description of the icon pack"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_icon_packs_id"), "icon_packs", ["id"], unique=False)
    op.create_index(op.f("ix_icon_packs_category"), "icon_packs", ["category"], unique=False)
    op.create_index(op.f("ix_icon_packs_name"), "icon_packs", ["name"], unique=True)

    # Create icon_metadata table
    op.create_table(
        "icon_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pack_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(255), nullable=False, comment="Icon identifier within pack"),
        sa.Column("full_key", sa.String(355), nullable=False, comment="Computed: pack.name + ':' + key"),
        sa.Column("search_terms", sa.Text(), nullable=False, comment="Space-separated search terms for full-text search"),
        sa.Column("icon_data", sa.JSON(), nullable=True, comment="JSON for Iconify data or SVG metadata"),
        sa.Column("file_path", sa.String(500), nullable=True, comment="File path for AWS SVG files"),
        sa.Column("access_count", sa.Integer(), nullable=False, comment="Number of times this icon has been accessed"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["pack_id"], ["icon_packs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_icon_metadata_id"), "icon_metadata", ["id"], unique=False)
    op.create_index(op.f("ix_icon_metadata_pack_id"), "icon_metadata", ["pack_id"], unique=False)
    op.create_index(op.f("ix_icon_metadata_access_count"), "icon_metadata", ["access_count"], unique=False)
    op.create_index(op.f("ix_icon_metadata_full_key"), "icon_metadata", ["full_key"], unique=False)
    op.create_index(op.f("ix_icon_metadata_search_terms"), "icon_metadata", ["search_terms"], unique=False)
    op.create_index(op.f("ix_icon_metadata_pack_key"), "icon_metadata", ["pack_id", "key"], unique=False)

    # Create unique constraints for icon tables
    op.create_unique_constraint("uq_icon_full_key", "icon_metadata", ["full_key"])
    op.create_unique_constraint("uq_icon_pack_key", "icon_metadata", ["pack_id", "key"])


def downgrade() -> None:
    """Drop all tables."""
    # Drop icon tables first (due to foreign keys)
    op.drop_constraint("uq_icon_pack_key", "icon_metadata", type_="unique")
    op.drop_constraint("uq_icon_full_key", "icon_metadata", type_="unique")
    op.drop_index(op.f("ix_icon_metadata_pack_key"), table_name="icon_metadata")
    op.drop_index(op.f("ix_icon_metadata_search_terms"), table_name="icon_metadata")
    op.drop_index(op.f("ix_icon_metadata_full_key"), table_name="icon_metadata")
    op.drop_index(op.f("ix_icon_metadata_access_count"), table_name="icon_metadata")
    op.drop_index(op.f("ix_icon_metadata_pack_id"), table_name="icon_metadata")
    op.drop_index(op.f("ix_icon_metadata_id"), table_name="icon_metadata")
    op.drop_table("icon_metadata")

    op.drop_index(op.f("ix_icon_packs_name"), table_name="icon_packs")
    op.drop_index(op.f("ix_icon_packs_category"), table_name="icon_packs")
    op.drop_index(op.f("ix_icon_packs_id"), table_name="icon_packs")
    op.drop_table("icon_packs")

    # Drop other tables
    op.drop_index(op.f("ix_document_recovery_id"), table_name="document_recovery")
    op.drop_table("document_recovery")
    op.drop_index(op.f("ix_custom_dictionaries_id"), table_name="custom_dictionaries")
    op.drop_table("custom_dictionaries")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

"""Add categories table and category-level dictionaries

Revision ID: ec3a0e148d1f
Revises: 3cedb82262e2
Create Date: 2025-08-14 00:26:48.336503

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ec3a0e148d1f"
down_revision: Union[str, Sequence[str], None] = "3cedb82262e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add categories table and migrate to category-level dictionaries."""

    # Step 1: Create the categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_user_category_name"),
    )
    op.create_index(op.f("ix_categories_id"), "categories", ["id"], unique=False)
    op.create_index(
        op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False
    )

    # Step 2: Migrate existing document categories to the categories table
    # Get a connection to execute data migration
    connection = op.get_bind()

    # Get all unique user-category combinations from documents
    result = connection.execute(
        sa.text(
            """
        SELECT DISTINCT user_id, category
        FROM documents
        WHERE category IS NOT NULL AND category != ''
        ORDER BY user_id, category
    """
        )
    )

    # Insert categories for each user
    for row in result:
        user_id, category_name = row
        connection.execute(
            sa.text(
                """
            INSERT INTO categories (user_id, name, created_at, updated_at)
            VALUES (:user_id, :name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, name) DO NOTHING
        """
            ),
            {"user_id": user_id, "name": category_name},
        )

    # Step 3: Add category_id column to documents table
    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(sa.Column("category_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_documents_category_id",
            "categories",
            ["category_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_documents_category_id", ["category_id"], unique=False)

    # Step 4: Update documents to reference the new category_id
    connection.execute(
        sa.text(
            """
        UPDATE documents
        SET category_id = (
            SELECT c.id
            FROM categories c
            WHERE c.user_id = documents.user_id
            AND c.name = documents.category
        )
        WHERE category IS NOT NULL AND category != ''
    """
        )
    )

    # Step 5: Add category support to custom_dictionaries table
    op.add_column(
        "custom_dictionaries", sa.Column("category_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_custom_dictionaries_category_id",
        "custom_dictionaries",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_custom_dictionaries_category_id"),
        "custom_dictionaries",
        ["category_id"],
        unique=False,
    )

    # Step 6: Add scope constraint - user_id is always required, category_id is optional
    op.create_check_constraint(
        "ck_custom_dictionaries_scope", "custom_dictionaries", "user_id IS NOT NULL"
    )

    # Step 7: Add unique constraint for category-level dictionary words
    op.create_unique_constraint(
        "uq_category_dictionary_word", "custom_dictionaries", ["category_id", "word"]
    )

    # Step 8: Add partial unique constraint for user-level dictionary words (where category_id IS NULL)
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
        CREATE UNIQUE INDEX uq_user_dictionary_word
        ON custom_dictionaries (user_id, word)
        WHERE category_id IS NULL
    """
        )
    )

    # Note: We keep the old category column in documents for now to ensure backward compatibility
    # It can be removed in a future migration after confirming the migration worked correctly


def downgrade() -> None:
    """Downgrade schema - remove categories and revert to string-based categories."""

    # Step 1: Remove constraints and indexes from custom_dictionaries
    connection = op.get_bind()
    connection.execute(sa.text("DROP INDEX IF EXISTS uq_user_dictionary_word"))
    op.drop_constraint(
        "uq_category_dictionary_word", "custom_dictionaries", type_="unique"
    )
    op.drop_constraint(
        "ck_custom_dictionaries_scope", "custom_dictionaries", type_="check"
    )
    op.drop_index(
        op.f("ix_custom_dictionaries_category_id"), table_name="custom_dictionaries"
    )
    op.drop_constraint(
        "fk_custom_dictionaries_category_id", "custom_dictionaries", type_="foreignkey"
    )
    op.drop_column("custom_dictionaries", "category_id")

    # Step 2: Remove category_id from documents
    op.drop_index(op.f("ix_documents_category_id"), table_name="documents")
    op.drop_constraint("fk_documents_category_id", "documents", type_="foreignkey")
    op.drop_column("documents", "category_id")

    # Step 3: Drop categories table
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_index(op.f("ix_categories_id"), table_name="categories")
    op.drop_table("categories")

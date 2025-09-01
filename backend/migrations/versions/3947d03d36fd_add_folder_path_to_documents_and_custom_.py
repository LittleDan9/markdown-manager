"""Add folder_path to documents and custom_dictionaries

Revision ID: 3947d03d36fd
Revises: 99d190ed73e6
Create Date: 2025-08-31 23:49:44.414181

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = '3947d03d36fd'
down_revision: Union[str, Sequence[str], None] = '99d190ed73e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade_documents() -> None:
    """Add folder_path support to documents table."""
    
    # Step 1: Add folder_path column (nullable initially)
    op.add_column('documents',
                  sa.Column('folder_path', sa.String(1000), nullable=True, default='/',
                            comment="Hierarchical folder path (e.g., '/Work/Projects')"))

    # Step 2: Populate folder_path from category names
    # This SQL joins documents with categories to get category names
    op.execute(text("""
        UPDATE documents
        SET folder_path = '/' || categories.name
        FROM categories
        WHERE documents.category_id = categories.id
    """))

    # Step 3: Set default folder_path for any documents without categories
    op.execute(text("""
        UPDATE documents
        SET folder_path = '/General'
        WHERE folder_path IS NULL
    """))

    # Step 4: Make folder_path NOT NULL now that all rows have values
    op.alter_column('documents', 'folder_path', nullable=False)

    # Step 5: Add index on folder_path for performance
    op.create_index('ix_documents_folder_path', 'documents', ['folder_path'])

    # Step 6: Make category_id nullable (for future phases)
    op.alter_column('documents', 'category_id',
                    existing_type=sa.INTEGER(),
                    nullable=True)

    # Step 7: Add new unique constraint
    op.create_unique_constraint(
        'uq_user_folder_name',
        'documents',
        ['user_id', 'folder_path', 'name']
    )

    # Note: Keep old constraint for now during transition


def upgrade_custom_dictionary() -> None:
    """Add folder_path support to custom_dictionaries table."""

    # Step 1: Add folder_path column (nullable initially)
    op.add_column('custom_dictionaries',
                  sa.Column('folder_path', sa.String(500), nullable=True,
                            comment="Hierarchical folder path for dictionary scope (e.g., '/Work/Projects')"))

    # Step 2: Populate folder_path from category names for existing entries
    op.execute(text("""
        UPDATE custom_dictionaries
        SET folder_path = '/' || categories.name
        FROM categories
        WHERE custom_dictionaries.category_id = categories.id
    """))

    # Step 3: Add index on folder_path for performance
    op.create_index('ix_custom_dictionaries_folder_path', 'custom_dictionaries', ['folder_path'])

    # Step 4: Add new unique constraint for folder-based dictionary words
    op.create_unique_constraint(
        'uq_folder_dictionary_word',
        'custom_dictionaries',
        ['folder_path', 'word']
    )

    # Note: Keep old constraint for now during the transition period.


def upgrade() -> None:
    """Upgrade schema."""
    
    # Upgrade documents table
    upgrade_documents()
    
    # Upgrade custom dictionaries table
    upgrade_custom_dictionary()
    
    # Handle the icon_metadata change (from autogenerate)
    op.alter_column('icon_metadata', 'icon_data',
                    existing_type=postgresql.JSONB(astext_type=sa.Text()),
                    type_=sa.JSON(),
                    comment='JSON for Iconify data or SVG metadata',
                    existing_comment='JSONB for Iconify data or SVG metadata',
                    existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    
    # Reverse icon_metadata change
    op.alter_column('icon_metadata', 'icon_data',
                    existing_type=sa.JSON(),
                    type_=postgresql.JSONB(astext_type=sa.Text()),
                    comment='JSONB for Iconify data or SVG metadata',
                    existing_comment='JSON for Iconify data or SVG metadata',
                    existing_nullable=True)
    
    # Remove custom dictionaries changes
    op.drop_constraint('uq_folder_dictionary_word', 'custom_dictionaries', type_='unique')
    op.drop_index('ix_custom_dictionaries_folder_path', 'custom_dictionaries')
    op.drop_column('custom_dictionaries', 'folder_path')
    
    # Remove documents changes
    op.drop_constraint('uq_user_folder_name', 'documents', type_='unique')
    op.drop_index('ix_documents_folder_path', 'documents')
    op.alter_column('documents', 'category_id',
                    existing_type=sa.INTEGER(),
                    nullable=False)
    op.drop_column('documents', 'folder_path')

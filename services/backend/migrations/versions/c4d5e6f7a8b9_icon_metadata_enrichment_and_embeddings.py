"""Add icon metadata enrichment fields and icon_embeddings table

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-04-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Add metadata enrichment columns to icon_metadata ---
    op.add_column('icon_metadata', sa.Column('tags', sa.Text(), nullable=True,
                  comment="Comma-separated tags e.g. 'compute, server, cloud'"))
    op.add_column('icon_metadata', sa.Column('aliases', sa.Text(), nullable=True,
                  comment="Alternative names e.g. 'EC2, Elastic Compute Cloud'"))
    op.add_column('icon_metadata', sa.Column('description', sa.Text(), nullable=True,
                  comment="Human-readable description of what the icon represents"))

    # --- 2. Ensure pgvector extension ---
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- 3. Create icon_embeddings table ---
    op.create_table(
        'icon_embeddings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('icon_id', sa.Integer(), sa.ForeignKey('icon_metadata.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content_hash', sa.String(64), nullable=False,
                  comment="SHA256 of concatenated text fields"),
        sa.Column('embedded_text', sa.Text(), nullable=False,
                  comment="The text that was embedded"),
        sa.Column('embedded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('icon_id', name='uq_icon_embeddings_icon_id'),
    )
    op.create_index('ix_icon_embeddings_icon_id', 'icon_embeddings', ['icon_id'])

    # Add vector columns via raw SQL (SQLAlchemy can't create HALFVEC/BIT natively)
    op.execute("ALTER TABLE icon_embeddings ADD COLUMN embedding halfvec(384) NOT NULL")
    op.execute("ALTER TABLE icon_embeddings ADD COLUMN embedding_binary bit(384)")

    # --- 4. Create HNSW indexes for two-stage retrieval ---
    op.execute(
        "CREATE INDEX ix_icon_embeddings_hnsw ON icon_embeddings "
        "USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_icon_embeddings_binary ON icon_embeddings "
        "USING hnsw (embedding_binary bit_hamming_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.drop_table('icon_embeddings')
    op.drop_column('icon_metadata', 'description')
    op.drop_column('icon_metadata', 'aliases')
    op.drop_column('icon_metadata', 'tags')

"""Upgrade embeddings to 768-dim and add hybrid full-text search

- Migrate document_embeddings and icon_embeddings from halfvec(384)/bit(384)
  to halfvec(768)/bit(768) for nomic-embed-text-v1.5 model upgrade
- Add content_text + search_vector (tsvector) columns to documents table
  for hybrid keyword+semantic search
- Recreate HNSW indexes with new dimensions
- Truncate embedding tables (vectors must be regenerated with new model)

Revision ID: a0b1c2d3e4f5
Revises: 3cedb82262e2, 8821a39ebdc7, a1b2c3d4e5f7, a1c2e3f4a5b6, a7b8c9d0e1f2, b2c3d4e5f6a7, c1d2e3f4a5b6, ca131637e68b, e1f2a3b4c5d6, e5f6a7b8c9d0, ec3a0e148d1f, f6a7b8c9d0e1, f7a8b9c0d1e2
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, Sequence[str]] = (
    '3cedb82262e2', '8821a39ebdc7', 'a1b2c3d4e5f7', 'a1c2e3f4a5b6',
    'a7b8c9d0e1f2', 'b2c3d4e5f6a7', 'c1d2e3f4a5b6', 'ca131637e68b',
    'e1f2a3b4c5d6', 'e5f6a7b8c9d0', 'ec3a0e148d1f', 'f6a7b8c9d0e1',
    'f7a8b9c0d1e2',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- 1. Truncate embedding tables (old 384-dim vectors are incompatible)
    op.execute("TRUNCATE TABLE document_embeddings")
    op.execute("TRUNCATE TABLE icon_embeddings")

    # -- 2. Drop old HNSW indexes (dimension-specific, can't be altered)
    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_binary")
    op.execute("DROP INDEX IF EXISTS ix_icon_embeddings_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_icon_embeddings_binary")

    # -- 3. Alter document_embeddings columns to 768-dim
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding TYPE halfvec(768) USING NULL"
    )
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding_binary TYPE bit(768) USING NULL"
    )

    # -- 4. Alter icon_embeddings columns to 768-dim
    op.execute(
        "ALTER TABLE icon_embeddings "
        "ALTER COLUMN embedding TYPE halfvec(768) USING NULL"
    )
    op.execute(
        "ALTER TABLE icon_embeddings "
        "ALTER COLUMN embedding_binary TYPE bit(768) USING NULL"
    )

    # -- 5. Recreate HNSW indexes with new dimensions
    op.execute(
        "CREATE INDEX ix_document_embeddings_hnsw "
        "ON document_embeddings USING hnsw (embedding halfvec_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_document_embeddings_binary "
        "ON document_embeddings USING hnsw (embedding_binary bit_hamming_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_icon_embeddings_hnsw "
        "ON icon_embeddings USING hnsw (embedding halfvec_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_icon_embeddings_binary "
        "ON icon_embeddings USING hnsw (embedding_binary bit_hamming_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # -- 6. Add full-text search columns to documents table
    op.add_column("documents", sa.Column("content_text", sa.Text(), nullable=True))
    op.execute(
        "ALTER TABLE documents ADD COLUMN search_vector tsvector "
        "GENERATED ALWAYS AS ("
        "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(content_text, ''))"
        ") STORED"
    )
    op.execute(
        "CREATE INDEX ix_documents_search_vector "
        "ON documents USING GIN (search_vector)"
    )

    # -- 7. Add search_mode preference to users table
    op.add_column("users", sa.Column("search_mode", sa.String(20), nullable=False, server_default="quick"))


def downgrade() -> None:
    # Remove search_mode
    op.drop_column("users", "search_mode")

    # Remove full-text search
    op.execute("DROP INDEX IF EXISTS ix_documents_search_vector")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS search_vector")
    op.drop_column("documents", "content_text")

    # Truncate and revert to 384-dim
    op.execute("TRUNCATE TABLE document_embeddings")
    op.execute("TRUNCATE TABLE icon_embeddings")

    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_binary")
    op.execute("DROP INDEX IF EXISTS ix_icon_embeddings_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_icon_embeddings_binary")

    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding TYPE halfvec(384) USING NULL"
    )
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding_binary TYPE bit(384) USING NULL"
    )
    op.execute(
        "ALTER TABLE icon_embeddings "
        "ALTER COLUMN embedding TYPE halfvec(384) USING NULL"
    )
    op.execute(
        "ALTER TABLE icon_embeddings "
        "ALTER COLUMN embedding_binary TYPE bit(384) USING NULL"
    )

    op.execute(
        "CREATE INDEX ix_document_embeddings_hnsw "
        "ON document_embeddings USING hnsw (embedding halfvec_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_document_embeddings_binary "
        "ON document_embeddings USING hnsw (embedding_binary bit_hamming_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_icon_embeddings_hnsw "
        "ON icon_embeddings USING hnsw (embedding halfvec_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX ix_icon_embeddings_binary "
        "ON icon_embeddings USING hnsw (embedding_binary bit_hamming_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

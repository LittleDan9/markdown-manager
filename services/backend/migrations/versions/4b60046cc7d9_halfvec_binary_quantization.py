"""halfvec + binary quantization for embeddings

TurboQuant-inspired: migrate VECTOR(384) → halfvec(384) for 2x storage
reduction, add BIT(384) column for QJL-inspired binary pre-filtering.

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-03-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b60046cc7d9'
down_revision: Union[str, Sequence[str], None] = 'd4d26c59b46c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate embedding column to halfvec and add binary quantization column."""
    # Step 1: Drop the old HNSW index (it references the old vector type)
    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_hnsw")

    # Step 2: Convert VECTOR(384) → halfvec(384) for 2x storage reduction
    # halfvec uses float16 instead of float32 per dimension
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding TYPE halfvec(384) USING embedding::halfvec(384)"
    )

    # Step 3: Add binary sign-bit column (QJL-inspired) for fast Hamming pre-filtering
    op.add_column(
        'document_embeddings',
        sa.Column('embedding_binary', sa.LargeBinary(), nullable=True)
    )
    # Use raw SQL for the BIT type since Alembic doesn't natively support pgvector BIT
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding_binary TYPE bit(384) USING NULL"
    )

    # Step 4: Populate binary column from existing embeddings
    # sign-bit quantization: each dimension → 1 if >= 0, 0 if < 0
    op.execute("""
        UPDATE document_embeddings
        SET embedding_binary = (
            SELECT string_agg(
                CASE WHEN val >= 0 THEN '1' ELSE '0' END, ''
            )::bit(384)
            FROM unnest(embedding::real[]) WITH ORDINALITY AS t(val, ord)
        )
    """)

    # Step 5: Create new HNSW index on halfvec column with cosine ops
    op.execute(
        "CREATE INDEX ix_document_embeddings_hnsw ON document_embeddings "
        "USING hnsw (embedding halfvec_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # Step 6: Create Hamming distance index on binary column for fast pre-filtering
    op.execute(
        "CREATE INDEX ix_document_embeddings_binary ON document_embeddings "
        "USING hnsw (embedding_binary bit_hamming_ops) WITH (m = 16, ef_construction = 64)"
    )

    # Step 7: Drop old unique constraint on document_id (allow multi-chunk)
    # The original alembic migration created a UNIQUE constraint on document_id
    op.execute("ALTER TABLE document_embeddings DROP CONSTRAINT IF EXISTS document_embeddings_document_id_key")
    # Add new unique constraint on (document_id, chunk_index)
    op.create_unique_constraint(
        "uq_document_embeddings_doc_chunk",
        "document_embeddings",
        ["document_id", "chunk_index"],
    )


def downgrade() -> None:
    """Revert to VECTOR(384) and drop binary column."""
    # Remove multi-chunk unique constraint and restore single-doc unique
    op.drop_constraint("uq_document_embeddings_doc_chunk", "document_embeddings", type_="unique")
    # Delete non-zero chunks before restoring unique constraint
    op.execute("DELETE FROM document_embeddings WHERE chunk_index > 0")
    op.execute(
        "ALTER TABLE document_embeddings "
        "ADD CONSTRAINT document_embeddings_document_id_key UNIQUE (document_id)"
    )

    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_binary")
    op.execute("DROP INDEX IF EXISTS ix_document_embeddings_hnsw")

    # Convert back to VECTOR(384)
    op.execute(
        "ALTER TABLE document_embeddings "
        "ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)"
    )

    op.drop_column('document_embeddings', 'embedding_binary')

    # Recreate original HNSW index
    op.execute(
        "CREATE INDEX ix_document_embeddings_hnsw ON document_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

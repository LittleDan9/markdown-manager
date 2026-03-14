"""Sentence-transformers embedding service — singleton model, pre-loaded on startup."""
import logging
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

_model: SentenceTransformer | None = None


def load_model() -> SentenceTransformer:
    """Load the embedding model (called once at startup)."""
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
        logger.info("Embedding model loaded — dim=%d", EMBEDDING_DIM)
    return _model


def get_model() -> SentenceTransformer:
    if _model is None:
        raise RuntimeError("Model not loaded. Call load_model() during startup.")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of 384-dim float vectors."""
    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return embeddings.tolist()

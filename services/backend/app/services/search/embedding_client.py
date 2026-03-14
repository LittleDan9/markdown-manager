"""HTTP client for the embedding microservice."""
import logging

import httpx

logger = logging.getLogger(__name__)

# Default assumes Docker internal network; overridden by EMBEDDING_SERVICE_URL env var
DEFAULT_EMBEDDING_URL = "http://embedding:8005"


class EmbeddingClient:
    """Thin async HTTP client that calls the embedding microservice."""

    def __init__(self, base_url: str = DEFAULT_EMBEDDING_URL, timeout: float = 30.0):
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts. Returns list of 384-dim float vectors."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/embed",
                json={"texts": texts},
            )
            response.raise_for_status()
            return response.json()["embeddings"]

    async def embed_query(self, query: str) -> list[float]:
        """Embed a single query string. Returns a 384-dim float vector."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/embed-query",
                json={"query": query},
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def health_check(self) -> bool:
        """Return True if the embedding service is reachable and healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._base_url}/health")
                return response.status_code == 200
        except Exception:
            return False

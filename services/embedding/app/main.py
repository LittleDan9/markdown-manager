"""FastAPI embedding microservice — exposes sentence-transformers over HTTP."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .embedder import EMBEDDING_DIM, MODEL_NAME, embed_texts, is_using_onnx, load_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load model on startup to eliminate cold-start latency on first query
    load_model()
    yield


app = FastAPI(title="Embedding Service", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dim: int


class EmbedQueryRequest(BaseModel):
    query: str


class EmbedQueryResponse(BaseModel):
    embedding: list[float]
    model: str
    dim: int


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dim": EMBEDDING_DIM,
        "backend": "onnx-int8" if is_using_onnx() else "pytorch",
    }


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    if not request.texts:
        raise HTTPException(status_code=400, detail="texts must not be empty")
    try:
        embeddings = embed_texts(request.texts)
        return EmbedResponse(embeddings=embeddings, model=MODEL_NAME, dim=EMBEDDING_DIM)
    except Exception as exc:
        logger.exception("Embedding failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/embed-query", response_model=EmbedQueryResponse)
async def embed_query(request: EmbedQueryRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")
    try:
        embeddings = embed_texts([request.query])
        return EmbedQueryResponse(
            embedding=embeddings[0], model=MODEL_NAME, dim=EMBEDDING_DIM
        )
    except Exception as exc:
        logger.exception("Query embedding failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

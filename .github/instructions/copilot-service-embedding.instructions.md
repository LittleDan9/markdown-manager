---
description: "Use when working on the embedding microservice: sentence-transformers model, vector embedding endpoints, or embedding service deployment."
applyTo: "services/embedding/**"
---
# Embedding Service

## Overview
Minimal FastAPI microservice providing vector embeddings via sentence-transformers for RAG-style semantic search.

**Tech Stack**: Python 3.11, FastAPI, sentence-transformers, torch (CPU), Poetry.

## Architecture

### Entry Point (`app/main.py`)
- Lifespan-based model preloading (avoids first-request cold start)
- Pydantic request/response models for batch and query embeddings

### Embedder (`app/embedder.py`)
- Singleton `SentenceTransformer` model instance
- Normalizes vectors for cosine similarity
- Returns list-of-float embeddings

### Endpoints
```
GET  /health        → Health check with model metadata
POST /embed         → Batch embedding (multiple texts → multiple vectors)
POST /embed-query   → Single query embedding (optimized for search queries)
```

## Backend Search Integration (`services/backend/app/services/search/`)
The embedding service powers the backend search stack:
- `embedding_client.py` → HTTP client calling embedding service endpoints
- `semantic.py` → Semantic search using pgvector + content-hash skip logic + filesystem document reads
- `content_processor.py` → Document content preprocessing for embedding
- `qa.py` → QA pipeline combining embeddings + LLM for chat responses

## Development
```bash
docker compose up embedding  # Start embedding service
# Service runs on port 8002 internally
# Called by backend search services, not directly by frontend
```

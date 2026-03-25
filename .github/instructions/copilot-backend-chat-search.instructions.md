---
description: "Use when working on AI chat endpoints, RAG question-answering, semantic search, vector embeddings backend, Ollama streaming, content indexing, or document embedding lifecycle."
applyTo: "services/backend/app/routers/chat*,services/backend/app/services/search/**"
---
# Backend AI Chat & Semantic Search

## Overview
RAG-powered chat and semantic search system using pgvector, sentence-transformers embeddings, and Ollama LLM streaming.

## Chat Router (`routers/chat.py`)
Mounted at `/chat` prefix:

```
POST /chat/ask     → SSE-streamed Q&A (builds QA service, streams Ollama response)
GET  /chat/health  → Chat subsystem health (embedding service + Ollama connectivity)
```

### SSE Streaming Pattern
The `/ask` endpoint uses `StreamingResponse` with `text/event-stream` content type:
- Streams individual tokens as `data: {"token": "..."}` lines
- Sends `data: {"metrics": {...}}` with timing/context info
- Ends with `data: {"done": true}`
- Error handling sends `data: {"error": "..."}` and closes stream

### Dependencies
- Builds `QAService` per-request with `SemanticSearchService` + `EmbeddingClient`
- Requires authenticated user (`Depends(get_current_user)`)
- Supports `scope` parameter: "all" (search all docs) or "current" (single document context)

## Search Services (`services/search/`)

### QA Service (`qa.py`)
RAG orchestrator that builds context and streams LLM output:
- `answer_stream(question, user_id, scope, document_id?)` → AsyncGenerator of tokens
- `_build_context()` → Retrieves relevant documents via semantic search
- `_build_catalogue()` → Lists all user documents for "all docs" scope
- `_context_for_document()` → Reads filesystem content for single-doc scope
- `_build_prompt()` → Constructs system + user prompt with retrieved context
- `_stream_ollama()` → Streams from Ollama API with httpx

### Semantic Search Service (`semantic.py`)
Vector search using pgvector + content-hash skip logic:
- `index_document(document_id)` → Embeds and stores document vector (skips if content hash unchanged)
- `search(query, user_id, limit)` → Cosine similarity search against stored embeddings
- `bulk_reindex(user_id?)` → Re-index all documents
- `delete_embedding(document_id)` → Remove document from search index
- Uses filesystem-backed document reads (not DB content field)

### Embedding Client (`embedding_client.py`)
Async HTTP client calling the embedding microservice:
- `embed_texts(texts)` → Batch text → vector embedding
- `embed_query(query)` → Single query → vector embedding
- `health_check()` → Embedding service connectivity

### Content Processor (`content_processor.py`)
Preprocesses markdown for embedding quality:
- `prepare_document_content(content)` → Strips Mermaid, normalizes whitespace
- `extract_summary(content)` → Extracts document summary for search results
- Mermaid diagram extraction/parsing helpers

## Data Layer
- **Model**: `document_embedding.py` (DocumentEmbedding with pgvector column, content_hash for skip logic)
- **Storage**: Embeddings stored in PostgreSQL with pgvector extension

## Architecture Flow
```
Frontend (searchApi.askQuestion) → SSE POST /api/chat/ask
  → Chat Router → QAService
    → SemanticSearchService.search() → pgvector similarity
    → Content retrieval from filesystem
    → _build_prompt() with context
    → _stream_ollama() → Ollama API → SSE tokens back to frontend
```

## Connection to Embedding Service
The backend search services call the embedding microservice (port 8002) via `EmbeddingClient`. See `copilot-service-embedding.instructions.md` for the microservice itself.

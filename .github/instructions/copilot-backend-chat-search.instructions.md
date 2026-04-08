---
description: "Use when working on AI chat endpoints, RAG question-answering, semantic search, vector embeddings backend, LLM provider abstraction, Ollama/OpenAI/xAI streaming, content indexing, document embedding lifecycle, or chat history/conversations."
applyTo: "services/backend/app/routers/chat*,services/backend/app/routers/chat_history*,services/backend/app/routers/api_keys*,services/backend/app/services/search/**,services/backend/app/models/chat*,services/backend/app/crud/chat*,services/backend/app/schemas/chat*"
---
# Backend AI Chat & Semantic Search

## Overview
RAG-powered chat and semantic search system using pgvector, sentence-transformers embeddings, and a pluggable multi-provider LLM layer (Ollama local, OpenAI, xAI Grok).

## Chat Router (`routers/chat.py`)
Mounted at `/chat` prefix. Includes the `chat_history` sub-router for conversation persistence.

```
POST /chat/ask     → SSE-streamed Q&A (resolves LLM provider, builds QA service, streams response)
GET  /chat/health  → Chat subsystem health (embedding service + LLM provider connectivity)
```

## Chat History Router (`routers/chat_history.py`)
Mounted as sub-router under `/chat/conversations` prefix — persistent conversation CRUD:

```
POST   /chat/conversations/                          → Create new conversation
GET    /chat/conversations/                          → List user's conversations (paginated, summaries with message_count)
GET    /chat/conversations/{conversation_id}          → Get conversation with all messages
PUT    /chat/conversations/{conversation_id}          → Update conversation (rename title)
DELETE /chat/conversations/{conversation_id}          → Delete conversation + messages (cascade)
POST   /chat/conversations/{conversation_id}/messages → Add a message to conversation
POST   /chat/conversations/{conversation_id}/generate-title → LLM-generate a short title from first messages
```

### Chat History Models (`models/chat.py`)
- **`ChatConversation(BaseModel)`** — `user_id` (FK users, CASCADE), `title` (nullable, LLM-generated), `provider`, `scope` ("all"/"current"), `document_id` (FK documents, SET NULL). Relationship: `messages` (selectin loaded, ordered by created_at).
- **`ChatMessage(BaseModel)`** — `conversation_id` (FK chat_conversations, CASCADE), `role` ("user"/"assistant"), `content` (Text), `metadata_json` (Text, nullable — stores timing/metrics JSON).

### Chat History CRUD (`crud/chat.py`)
- `create_conversation(db, user_id, provider, scope, document_id)` → new conversation
- `get_conversations(db, user_id, limit, offset)` → list of summaries with message_count and first_message_preview, ordered by updated_at DESC
- `get_conversation(db, user_id, conversation_id)` → full detail with messages (user-scoped)
- `update_conversation(db, user_id, conversation_id, title)` → rename
- `delete_conversation(db, user_id, conversation_id)` → cascade delete
- `add_message(db, conversation_id, role, content, metadata_json)` → add message, touch conversation updated_at
- `delete_all_conversations(db, user_id)` → bulk delete

All queries filter by `user_id` for row-level security.

### Chat History Schemas (`schemas/chat.py`)
- `ChatMessageSchema` — id, role, content, metadata_json, created_at
- `ChatConversationSummary` — id, title, provider, scope, document_id, created_at, updated_at, message_count, first_message_preview (for list view)
- `ChatConversationDetail` — summary fields + messages list
- `CreateConversationRequest`, `UpdateConversationRequest`, `AddMessageRequest`, `GenerateTitleRequest`, `GenerateTitleResponse`

### Title Generation
The `generate-title` endpoint reads the first few messages, calls the user's selected LLM provider with a system prompt requesting a 3-8 word title, saves and returns it. Uses `_resolve_provider()` helper (shared with `/ask` endpoint) for provider resolution. Falls back to Ollama if the requested provider is unavailable.

### SSE Streaming Pattern
The `/ask` endpoint uses `StreamingResponse` with `text/event-stream` content type:
- Streams individual tokens as `data: "token"` lines (JSON-encoded strings)
- Sends `data: {"type":"metrics","data":{...}}` with timing/context info including `provider` and `model`
- Ends with `data: "[DONE]"`
- Error handling sends `data: "[ERROR] ..."` and closes stream

### AskRequest Fields
- `question` (str) — user query
- `document_id` (int|null) — null = All Docs, int = Current Doc mode
- `category_id` (int|null) — category filter for All Docs mode
- `deep_think` (bool) — full document context (single-doc only)
- `history` (list[ChatMessage]) — prior conversation turns
- `provider` (str|null) — `"ollama"`, `"openai"`, `"xai"`; null = default Ollama
- `selection_context` (str|null) — editor-highlighted text included as prompt context

### Provider Resolution
1. If `provider` is `"openai"` or `"xai"`: look up user's active encrypted key via `crud.user_api_key.get_active_key()`, decrypt, build provider via factory. HTTP 400 if no key configured.
2. If `provider` is `"ollama"` (or null): read admin LLM overrides from `SiteSetting` keys `llm.model`/`llm.url`, build `OllamaProvider`.

### Dependencies
- Builds `QAService` per-request with `SemanticSearchService` + resolved `LLMProvider`
- Requires authenticated user (`Depends(get_current_user)`)

## API Key Management (`routers/api_keys.py`)
Mounted at `/api-keys` prefix — per-user CRUD for third-party LLM provider keys:

```
GET    /api-keys           → List user's keys (never returns raw key)
POST   /api-keys           → Add new encrypted key
PUT    /api-keys/{id}      → Update key config
DELETE /api-keys/{id}      → Delete key
POST   /api-keys/{id}/test → Test key via provider health check
```

All endpoints scoped to authenticated user. See `models/user_api_key.py` for encryption details.

## LLM Provider Abstraction (`services/search/providers/`)

### Base Class (`base.py`)
`LLMProvider` ABC with:
- `provider_name` / `model_name` properties
- `stream(prompt, system_prompt)` → `AsyncIterator[str]` — async generator streaming tokens
- `health_check()` → `bool`

### Implementations
- **`OllamaProvider`** (`ollama.py`) — Streams from Ollama `/api/generate` endpoint. Prepends system prompt to user prompt.
- **`OpenAICompatProvider`** (`openai_compat.py`) — Streams from OpenAI-compatible `/chat/completions` endpoint with SSE parsing. Works for both OpenAI and xAI Grok (differ by base URL). Uses `messages` array format with system/user roles.

### Factory (`factory.py`)
`get_provider(provider_type, api_key, model, base_url)` → resolves well-known defaults per provider type.

## Search Services (`services/search/`)

### QA Service (`qa.py`)
RAG orchestrator that builds context and streams LLM output:
- `QAService(search_service, provider)` — accepts an `LLMProvider` instance
- `answer_stream(db, user_id, question, ..., selection_context?)` → AsyncGenerator of tokens/metrics
- `_build_context()` → Retrieves relevant documents via semantic search
- `_build_catalogue()` → Lists all user documents for "all docs" scope
- `_context_for_document()` → Reads filesystem content for single-doc scope
- `_build_prompt()` → Constructs prompt with context, history, and optional selection context
- Delegates token streaming to `self._provider.stream(prompt)`
- Metrics dict includes `provider` and `model` fields

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
- **Model**: `user_api_key.py` (UserApiKey with Fernet-encrypted API keys, HKDF-derived encryption key)
- **Model**: `chat.py` (ChatConversation + ChatMessage — persistent chat history with cascade delete)
- **Storage**: Embeddings stored in PostgreSQL with pgvector extension
- **Migration**: `b5feb941a31d` — creates `chat_conversations` and `chat_messages` tables with indexes

## Security: API Key Encryption
API keys are encrypted at rest using Fernet symmetric encryption. The encryption key is derived from `settings.secret_key` via **HKDF-SHA256** with a purpose-specific info tag (`markdown-manager:user-api-key-encryption:v1`), ensuring cryptographic separation from the JWT signing key. Raw keys are **never** returned to the frontend — only encrypted values are stored, and decryption happens only at LLM request time.

## Architecture Flow
```
Frontend (searchApi.askQuestion) → SSE POST /api/chat/ask
  → Chat Router
    → Provider resolution (Ollama / OpenAI / xAI via user API key)
    → QAService(provider)
      → SemanticSearchService.search() → pgvector similarity
      → Content retrieval from filesystem
      → _build_prompt() with context + optional selection_context
      → provider.stream(prompt) → LLM API → SSE tokens back to frontend
```

## Connection to Embedding Service
The backend search services call the embedding microservice (port 8002) via `EmbeddingClient`. See `copilot-service-embedding.instructions.md` for the microservice itself.

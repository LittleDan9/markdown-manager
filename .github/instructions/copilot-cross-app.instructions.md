---
description: "Use when working on cross-app service-to-service API, cross-app authentication, document access from external apps (team-manager), AI provider sync/diff/import/export, AI usage aggregation, TM client, or the CROSS_APP_SECRET token system."
applyTo: "services/backend/app/routers/cross_app*,services/backend/app/routers/ai_provider_sync*,services/backend/app/routers/ai_usage*,services/backend/app/services/tm_client*,services/backend/app/services/event_consumer_backend*,services/backend/app/services/ai_usage_publisher*,services/backend/app/services/usage_recorder*,services/backend/app/models/remote_ai_provider*,services/backend/app/models/ai_usage_daily*,services/backend/app/models/remote_ai_usage_daily*,services/backend/app/models/chat_token_usage*,services/ui/src/api/aiProviderSyncApi*,services/ui/src/api/aiUsageApi*,services/ui/src/components/user/modals/RemoteProvidersPanel*,services/ui/src/components/user/modals/AIUsagePanel*"
---
# Cross-App Document API

## Overview
Service-to-service API that allows team-manager (tm) to read markdown-manager (mm) documents on behalf of authenticated users. Mounted at `/api/cross-app/`.

## Authentication
**Not browser-facing.** Requests come from tm-backend over the Docker `shared-services` network.

Two headers required on every request:
- `X-Cross-App-Token` — shared secret matching `CROSS_APP_SECRET` env var (same value in both apps)
- `X-User-Email` — email of the user whose documents to access

Auth flow:
1. `verify_cross_app_token()` — rejects if secret is empty (503) or mismatched (403)
2. `get_cross_app_user()` — looks up mm User by email, rejects if not found (404) or inactive (403)
3. All queries scoped to `user.id` — no cross-user access possible

## Endpoints

```
GET  /api/cross-app/documents                 → List user's documents (metadata only, no content)
GET  /api/cross-app/documents/semantic-search  → Semantic search with content excerpts (uses embedding service)
GET  /api/cross-app/documents/{document_id}    → Full document content (owner check: document.user_id == user.id)
```

## Configuration
- `CROSS_APP_SECRET` in `deployment/production.env` — must match the same var in team-manager
- Setting defined in `app/configs/settings.py` as `cross_app_secret: str`
- Router registered in `app/app_factory.py` with prefix `/cross-app`, tags `["cross-app"]`

## Security Constraints
- GitHub-synced documents are excluded from list results (`repository_type != "github"`)
- The `/documents/{id}` endpoint explicitly checks `document.user_id != user.id` → 403
- The endpoint is only reachable over the internal Docker network, not exposed via Traefik
- Never log or expose the shared secret value

## Calling Service (team-manager)
See team-manager's `backend/app/services/mm_client.py` for the client implementation.
The client sends `X-Cross-App-Token` and `X-User-Email` headers, uses in-memory TTL caching, and degrades gracefully when mm is unavailable.

---

# Cross-App: AI Provider Sync

## Overview
Allows users to view AI providers configured in team-manager, see diff (new vs existing), and import/export provider configs (including encrypted API keys via secure HTTP transfer).

## Architecture

```
mm-frontend (RemoteProvidersPanel.jsx)
  → mm-backend /api/ai-provider-sync/*
    → tm_client.py (list/export/import AI providers)
      → tm-backend /api/cross-app/ai-providers (shared-services network)

Redis Streams (ai.provider.v1):
  mm-backend publishes → tm event-consumer stores in remote_ai_providers
  tm-backend publishes → mm event-consumer stores in remote_ai_providers
```

## Backend Components

### TM Client (`services/backend/app/services/tm_client.py`)
- Singleton `tm_client` instance
- Methods: `list_providers()`, `export_provider(key_id)`, `import_provider(data)`
- Sends `X-Cross-App-Token` and `X-User-Email` headers
- Reads `settings.tm_backend_url` (default: `http://tm-backend:8010`)

### Cross-App AI Provider Endpoints (in `services/backend/app/routers/cross_app.py`)
Added after document endpoints:
- `GET /api/cross-app/ai-providers` — list user's API keys (no key values)
- `POST /api/cross-app/ai-providers/export/{key_id}` — decrypt and return key
- `POST /api/cross-app/ai-providers/import` — create API key from incoming data

### Sync Router (`services/backend/app/routers/ai_provider_sync.py`)
Mounted at `/api/ai-provider-sync`. User-facing:
- `GET /remote-providers` — fetch remote providers from TM via HTTP
- `POST /import` — import a remote provider (fetches key via export endpoint)
- `POST /export` — export a local key to TM
- `POST /publish` — trigger immediate Redis state publish

### Event Consumer (`services/backend/app/services/event_consumer_backend.py`)
- Subscribes to `ai.provider.v1` stream, consumer group `mm-consumer`
- On `AIProviderPublished` event: upserts `RemoteAIProvider` rows

### Models
- `services/backend/app/models/remote_ai_provider.py` — cached remote provider state

## Frontend Components
- `services/ui/src/api/aiProviderSyncApi.js` — AiProviderSyncApi class
- `services/ui/src/components/user/modals/RemoteProvidersPanel.jsx` — React-Bootstrap diff view

---

# Cross-App: AI Usage Aggregation

## Overview
Per-request AI usage is recorded into `chat_token_usage` and rolled up into `ai_usage_daily`. Every 5 minutes, daily stats are published to Redis Streams. The other app consumes them into `remote_ai_usage_daily` so dashboards show unified cross-app usage.

## Architecture

```
Chat streaming → record_usage() → chat_token_usage + ai_usage_daily (upsert)

Every 5 min:
  ai_usage_publisher.py → XADD ai.usage.v1 { user_email, date, provider, model, counts }

Other app's event_consumer:
  XREADGROUP ai.usage.v1 → upsert remote_ai_usage_daily

Dashboard:
  /api/ai-usage/stats → aggregates ai_usage_daily + remote_ai_usage_daily
```

## Backend Components

### Usage Recorder (`services/backend/app/services/usage_recorder.py`)
- `record_usage()` — inserts `ChatTokenUsage` AND upserts `AIUsageDaily` in one session
- Called from chat.py's `token_stream()` generator on metrics or error

### Error Classification (in `services/backend/app/routers/chat.py`)
- `_classify_error()` → `rate_limit` | `auth` | `timeout` | `server`
- Recorded in `ChatTokenUsage.error_type` and increments `AIUsageDaily.error_count`

### Publisher (`services/backend/app/services/ai_usage_publisher.py`)
- `usage_publish_loop()` — background task started in app lifespan, publishes every 300s
- Queries today's `AIUsageDaily` grouped by user email

### Consumer (in `services/backend/app/services/event_consumer_backend.py`)
- Handles `AIUsagePublished` events from `ai.usage.v1` stream
- Resolves user by email, upserts `RemoteAIUsageDaily` rows

### Router (`services/backend/app/routers/ai_usage.py`)
Mounted at `/api/ai-usage`:
- `GET /stats?days=30` — aggregated stats from local + remote tables
- `GET /daily?days=14` — daily breakdown for charts

### Models
- `services/backend/app/models/chat_token_usage.py` — per-request detail
- `services/backend/app/models/ai_usage_daily.py` — local daily rollup
- `services/backend/app/models/remote_ai_usage_daily.py` — remote app's daily stats

## Frontend Components
- `services/ui/src/api/aiUsageApi.js` — AiUsageApi class
- `services/ui/src/components/user/modals/AIUsagePanel.jsx` — React-Bootstrap dashboard

## Configuration
- `TM_BACKEND_URL` — tm backend URL (default: `http://tm-backend:8010`)
- `CROSS_APP_SECRET` — shared secret (must match tm's value)
- Both configured in docker-compose.yml (dev) and production.env (prod)

## Security
- API keys are NEVER in Redis events (only `has_key: bool`)
- Keys transferred only via HTTP cross-app export endpoint (encrypted at rest, decrypted for transfer)
- All queries scoped to `user_id == current_user.id`
- MM uses `decrypt_api_key(encrypted, settings.secret_key)` (takes explicit secret parameter)

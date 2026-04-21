---
description: "Use when working on cross-app service-to-service API, cross-app authentication, document access from external apps (team-manager), or the CROSS_APP_SECRET token system."
applyTo: "services/backend/app/routers/cross_app*"
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

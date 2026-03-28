---
description: "Use when working on document sharing (public share links), anonymous shared document viewer, shared-view layout, share token generation, SharedViewLayout, ShareButton, ShareModal share-link tab, or the /shared/{token} public route."
applyTo: "services/backend/app/routers/documents/sharing.py,services/backend/app/routers/public.py,services/ui/src/hooks/ui/useSharedView*,services/ui/src/components/layout/SharedViewLayout*,services/ui/src/components/shared/ShareButton*,services/ui/src/components/shared/modals/ShareModal*,services/ui/src/components/SharedRenderer*"
---
# Document Sharing & Shared View Instructions

## Two Distinct Sharing Systems

This project has **two independent sharing mechanisms** — don't confuse them:

| System | Purpose | Auth Required | Backend |
|--------|---------|---------------|---------|
| **Public Share Links** (this file) | Anonymous read-only access via URL | No | `sharing.py`, `public.py` |
| **Collaboration** (see `copilot-collaboration.instructions.md`) | Real-time co-editing by invited users | Yes (JWT) | `collaboration.py`, `ws.py` |

The `ShareModal` contains UI for **both** — a share-link tab and a collaborators tab. The public share link flow is covered here.

## Public Share Link Flow

### Backend

**Token lifecycle:**
1. Owner calls `POST /api/documents/{id}/share` → generates `share_token` (64-char random hex), sets `is_shared=True`
2. Token + flag stored on the `documents` table (`share_token`, `is_shared` columns)
3. Anonymous user hits `GET /api/shared/{share_token}` → returns `SharedDocument` (limited fields, no auth)
4. Owner calls `DELETE /api/documents/{id}/share` → clears token, sets `is_shared=False`

**Key files:**
- `routers/documents/sharing.py` — `_require_owner()` guard ensures only the document owner can enable/disable sharing. Returns 403 for collaborators.
- `routers/public.py` — Anonymous endpoint. Loads document via `get_by_share_token()`, reads content from filesystem using `create_document_response()`, includes `author_name` from owner relationship.
- `schemas/document.py` — `ShareResponse` (token + is_shared) and `SharedDocument` (id, name, content, category, folder_path, updated_at, author_name).

**Permission rules:**
- Only the document **owner** (`document.user_id == current_user.id`) can enable/disable sharing
- Collaborators cannot manage share links — `_require_owner()` returns 403
- The `ShareButton` component hides entirely for collab documents (`currentDocument.user_id !== user.id`)

### Frontend

**Share URL format:** `{window.location.origin}/shared/{share_token}`

The URL is always constructed client-side from the token — the backend never sends a full URL.

**Component flow:**
```
ShareButton → opens ShareModal
  → ShareModal "Share Link" tab:
      Enable sharing → POST /api/documents/{id}/share → display copy-able URL
      Disable sharing → DELETE /api/documents/{id}/share → clear URL
```

## Anonymous Shared View

When a user visits `/shared/{token}`, the app enters a special read-only mode.

### Route Detection (`useSharedViewState`)

```
URL: /shared/{token}
  → regex match /^\/shared\/([^/]+)$/
  → DocumentStorageService.clearAllData() (prevents stale auth data leaking)
  → DocumentService.getSharedDocument(token) → sets sharedDocument state
  → isSharedView = true
```

**State shape:**
```javascript
{
  isSharedView: boolean,      // true when on /shared/* route
  sharedDocument: object,     // { id, name, content, category, updated_at, author_name }
  sharedLoading: boolean,
  sharedError: string|null,
  shareToken: string|null,
  exitSharedView: () => void  // navigates to / and clears state
}
```

### Layout Switch (`App.jsx`)

When `isSharedView === true`, `App.jsx` renders `SharedViewLayout` instead of `AppLayout`:
- No editor pane — renderer only
- No file browser, no category tabs
- Toolbar shows document name, author, category, last updated (read-only)
- "Exit" button calls `exitSharedView()` → navigates to `/`

### Content Loading (`useSharedViewEffects`)

Simple effect: when `isSharedView && sharedDocument`, pushes `sharedDocument.content` into the global `setContent()` so the renderer displays it.

## Collab-Aware Restrictions

The `ShareButton` hides for non-owner users:
```javascript
const isCollabDocument = currentDocument && user && currentDocument.user_id !== user.id;
if (!isAuthenticated || isCollabDocument) return null;
```

Similarly, `Document.jsx` (toolbar) disables category dropdown and title rename for collab documents.

## File Inventory

### Backend
| File | Purpose |
|------|---------|
| `routers/documents/sharing.py` | Owner-only enable/disable share endpoints |
| `routers/public.py` | Anonymous `GET /shared/{token}` endpoint |
| `crud/document.py` | `enable_sharing()`, `disable_sharing()`, `get_by_share_token()` |
| `schemas/document.py` | `ShareResponse`, `SharedDocument` schemas |

### Frontend
| File | Purpose |
|------|---------|
| `components/shared/ShareButton.jsx` | Toolbar share button (owner-only) |
| `components/shared/modals/ShareModal.jsx` | Share link + collaborator management modal |
| `hooks/ui/useSharedViewState.js` | Route detection + shared doc fetch |
| `hooks/ui/useSharedViewEffects.js` | Loads shared content into renderer |
| `components/layout/SharedViewLayout.jsx` | Read-only shared view layout |
| `components/App.jsx` | Layout switching based on `isSharedView` |
| `api/documentsApi.js` | `enableSharing()`, `disableSharing()`, `getSharedDocument()` |
| `services/core/DocumentService.js` | Service-layer sharing wrappers |

## Patterns

### Adding Fields to Shared View

1. Add field to `SharedDocument` schema in `schemas/document.py`
2. Populate it in `routers/public.py` `get_shared_document()` from the document/owner model
3. Access it in frontend via `sharedDocument.fieldName` in the shared view components

### Testing Share Links

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"pass"}' | jq -r .access_token)

# Enable sharing
SHARE=$(curl -s -X POST http://localhost/api/documents/1/share \
  -H "Authorization: Bearer $TOKEN" | jq -r .share_token)

# Access anonymously
curl -s http://localhost/api/shared/$SHARE | jq .name

# Disable sharing
curl -s -X DELETE http://localhost/api/documents/1/share \
  -H "Authorization: Bearer $TOKEN"
```

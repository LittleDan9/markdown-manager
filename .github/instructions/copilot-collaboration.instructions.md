---
description: "Use when working on real-time collaborative editing, Yjs CRDT integration, document sharing/collaborators, collab WebSocket, comment anchoring, or sharing permissions."
applyTo: "services/backend/app/services/collab*,services/backend/app/models/document_collab*,services/backend/app/models/document_collaborator*,services/backend/app/crud/document_collaborator*,services/backend/app/routers/documents/collaboration*,services/backend/app/routers/ws*,services/ui/src/hooks/editor/useCollaboration*,services/ui/src/hooks/editor/useCommentAnchors*,services/ui/src/api/collaborationApi*,services/ui/src/components/shared/modals/SharedWithMeModal*,services/ui/src/components/shared/modals/ShareModal*,services/ui/src/components/editor/CommentsPanel*,services/ui/src/components/toolbar/SharedWithMeDropdown*"
---
# Collaboration System Instructions — Markdown Manager

## Overview

Real-time collaborative editing is built on **Yjs CRDT** — pycrdt on the backend, yjs on the frontend — connected via a binary WebSocket protocol. Collaboration is opt-in: it only activates when a document has at least one collaborator.

Full documentation: `docs/development/collaborative-editing.md`

## pycrdt API (Critical)

pycrdt v0.12.x has a non-obvious API that differs from the JS yjs library. Always verify against these correct method signatures:

```python
from pycrdt import Doc, Text

doc = Doc()
text = doc.get("content", type=Text)

# State vector (compact summary of what this doc knows)
state_vector = doc.get_state()       # Returns bytes

# Full binary update (everything the other side is missing)
update = doc.get_update(their_sv)    # Returns bytes

# Apply an incoming update
doc.apply_update(update_bytes)       # Takes bytes

# Text manipulation — MUST extract to local variable first
text = doc.get("content", type=Text)
text += "hello"                     # Appends via __iadd__
text.insert(0, "prefix")           # Insert at position
text.clear()                       # Remove all content
str(text)                          # Read current text
```

### Common Pitfalls

- **No `get_state_vector()`** — use `doc.get_state()` instead
- **No `encode_state_as_update()`** — use `doc.get_update(sv)` instead
- **Property setter trap**: `session.ytext += "text"` silently fails because `ytext` is a computed property. Always extract to a local: `text = session.ytext; text += "text"`
- **SQLAlchemy lazy-load in async context**: The collab service runs outside normal request scope. Use `UserStorage` directly (not `unified_document_service`) to avoid accessing unloaded relationships like `category_ref`

## Binary WebSocket Protocol

Messages are raw binary frames with a 1-byte type prefix:

```python
MSG_SYNC      = 0x00  # Yjs document sync (state vector or incremental update)
MSG_AWARENESS = 0x01  # Cursor position, selection, user presence
```

**Connection handshake:**
1. Client connects: `ws://host/api/ws/collab/{document_id}?token=JWT`
2. Server authenticates, checks permission (owner or editor)
3. Server sends `bytes([MSG_SYNC]) + full_doc_update` as initial state
4. Bidirectional message loop: client ↔ server relay ↔ other clients

## CollabManager Architecture

`services/backend/app/services/collab.py` — Singleton managing in-memory Y.Doc sessions.

### Session Lifecycle

```text
First client joins → load persisted state from DB (or bootstrap from filesystem)
                   → hold Y.Doc in memory
                   → relay updates between clients

Periodic persist  → every 30s, dirty sessions written to document_collab_state

Last client leaves → persist to DB
                   → write Y.Text content back to filesystem via UserStorage
                   → schedule eviction after 60s idle
```

### Key Design Decisions

- **Single-tab policy**: Second connection from the same user closes the first (WebSocket code `4001`)
- **Filesystem is source of truth for solo edits**: Collab bootstraps from file content, not DB state, when session starts fresh
- **DB state is checkpoint only**: `document_collab_state` holds periodic snapshots for faster reconnection; the filesystem write-back on disconnect is what makes edits permanent

### CollabSession Structure

```python
@dataclass
class CollabSession:
    document_id: int
    ydoc: Doc                         # pycrdt Y.Doc (in-memory CRDT)
    ytext: Text                       # doc.get("content", type=Text)
    clients: dict[int, WebSocket]     # user_id → active connection
    dirty: bool                       # True if updates received since last persist
    last_activity: float              # time.time() of last message
```

## Permission Model

Three-tier access:

| Role     | Source                         | WebSocket | Edit | Comment |
|----------|--------------------------------|-----------|------|---------|
| Owner    | `document.user_id`             | Yes       | Yes  | Yes     |
| Editor   | `document_collaborators` table | Yes       | Yes  | Yes     |
| Viewer   | `document_collaborators` table | No        | No   | Yes     |

- `document_collaborator.py` CRUD: `get_user_role()` checks ownership first, then collaborators table
- Collaboration is opt-in — solo editing has zero Yjs overhead

## Frontend Architecture

### useCollaboration Hook

`services/ui/src/hooks/editor/useCollaboration.js` — Core CRDT lifecycle:

- Dynamic imports `yjs` and `y-protocols/awareness` (code-split)
- Creates `Y.Doc`, `Y.Text('content')`, `Awareness`, `UndoManager`
- Binary WebSocket: `doc.on('update')` → send `MSG_SYNC`; `awareness.on('update')` → send `MSG_AWARENESS`
- Incoming: `MSG_SYNC` → `Y.applyUpdate`; `MSG_AWARENESS` → `applyAwarenessUpdate`
- Auto-reconnect on non-intentional close (3s delay)
- Returns: `{ collabActive, connected, ydoc, ytext, awareness, undoManager, collaborators, onRemoteChange, applyLocalChange, setLocalCursor }`

### useCommentAnchors Hook

`services/ui/src/hooks/editor/useCommentAnchors.js` — CRDT-stable comment positions:

- `createAnchor(charIndex)` → `Y.RelativePosition` + surrounding text
- `resolveAnchor(base64)` → current character index
- `createAnchorFromLine(lineNumber, content)` → line-to-char conversion wrapper
- Falls back to plain `line_number` in solo mode
- Anchors transported as base64 over REST API, stored as `LargeBinary` in DB

### EditorSection Integration

`services/ui/src/components/sections/EditorSection.jsx` orchestrates:

1. Checks `has_collaborators` via REST on document change
2. Activates `useCollaboration(documentId, hasCollaborators)`
3. Wires `useCommentAnchors` for anchor creation
4. Tracks cursor line for `CommentsPanel`
5. Passes collab state down to `Editor` and `CommentsPanel`

### CommentsPanel Dual Mode

`services/ui/src/components/editor/CommentsPanel.jsx`:

- **Collab mode** (`collabActive=true`): Shows cursor line indicator, creates `Y.RelativePosition` anchor on submit
- **Solo mode**: Traditional manual line number input
- Pin badge on anchored comments, anchor text snippet display

## Database Schema

### Tables

- `document_collaborators`: `(id, document_id, user_id, role, invited_by, created_at)` — unique on `(document_id, user_id)`
- `document_collab_state`: `(document_id PK, yjs_state LargeBinary, yjs_state_vector LargeBinary, updated_at)`
- `comments` additions: `anchor_text Text`, `anchor_ypos LargeBinary`

### Migrations

- `e4f5a6b7c8d9` — Creates collaboration tables
- `f5a6b7c8d9e0` — Adds comment anchor columns

Always extend the migration chain from `f5a6b7c8d9e0` (current HEAD).

## REST API

| Method   | Path                                         | Description                  |
|----------|----------------------------------------------|------------------------------|
| `GET`    | `/api/documents/shared-with-me`              | Documents shared with user   |
| `GET`    | `/api/documents/{id}/collaborators`          | List collaborators + ownership info |
| `POST`   | `/api/documents/{id}/collaborators`          | Invite by email + role       |
| `PATCH`  | `/api/documents/{id}/collaborators/{uid}`    | Update role                  |
| `DELETE` | `/api/documents/{id}/collaborators/{uid}`    | Remove collaborator          |

## File Inventory

### Backend

| File | Purpose |
|------|---------|
| `app/services/collab.py` | CollabManager singleton, session lifecycle |
| `app/routers/documents/collaboration.py` | REST endpoints for collaborator management |
| `app/routers/ws.py` | WebSocket endpoint (`/ws/collab/{document_id}`) |
| `app/models/document_collaborator.py` | DocumentCollaborator ORM model |
| `app/models/document_collab_state.py` | DocumentCollabState ORM model |
| `app/crud/document_collaborator.py` | Permission queries and CRUD |
| `app/routers/comments.py` | Comment anchor fields (base64 encode/decode) |
| `app/models/comment.py` | anchor_text, anchor_ypos columns |

### Frontend

| File | Purpose |
|------|---------|
| `hooks/editor/useCollaboration.js` | Core Yjs + WebSocket hook |
| `hooks/editor/useCommentAnchors.js` | Y.RelativePosition anchor utilities |
| `api/collaborationApi.js` | REST client for collaborator endpoints |
| `components/sections/EditorSection.jsx` | Collab orchestration layer |
| `components/Editor.jsx` | Collab-aware content change handler |
| `components/editor/CommentsPanel.jsx` | Dual-mode comment UI |
| `components/shared/modals/ShareModal.jsx` | Collaborator invite/management |
| `components/shared/modals/SharedWithMeModal.jsx` | Browse shared documents |
| `components/toolbar/SharedWithMeDropdown.jsx` | Toolbar dropdown with unseen badge |
| `styles/toolbar/_shared-dropdown.scss` | Shared dropdown styling |

## Patterns and Conventions

### Adding New Collab Message Types

1. Define a new constant (e.g., `MSG_CURSOR = 0x02`) in both `collab.py` and `useCollaboration.js`
2. Add handling in `handle_message` (backend) and the WebSocket `onmessage` handler (frontend)
3. Relay logic goes in `_broadcast` — filter by message type if needed

### Adding New Collaborator Permissions

1. Add the role string to the `role` column's allowed values
2. Update `get_user_role()` in `document_collaborator.py` CRUD
3. Update permission checks in `collaboration.py` and `ws.py`
4. Update the role dropdown in `ShareModal.jsx`

### Testing Collab Manually

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"pass"}' | jq -r .access_token)

# Invite a collaborator
curl -X POST http://localhost/api/documents/1/collaborators \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"collaborator@example.com","role":"editor"}'

# Test WebSocket with websocat (binary mode)
websocat -b "ws://localhost/api/ws/collab/1?token=$TOKEN"
```

### Testing pycrdt Inside Docker

```bash
docker compose exec backend python3 -c "
from pycrdt import Doc, Text
doc = Doc()
text = doc.get('content', type=Text)
text += 'Hello collaboration'
print('State vector:', len(doc.get_state()), 'bytes')
print('Content:', str(text))
"
```

## Collab-Aware UI Restrictions

When a user opens a document they don't own (i.e., a collaborative document), several UI elements must be restricted. The ownership check pattern is:

```javascript
const isCollabDocument = currentDocument && user && currentDocument.user_id !== user.id;
```

### Restricted UI for Collaborators

| Component | Restriction | Implementation |
|-----------|-------------|----------------|
| `ShareButton.jsx` | Hidden entirely | Returns `null` when `isCollabDocument` |
| `Document.jsx` (toolbar) | Category shows as plain text | No `<Dropdown>`, just `<span>` with category name |
| `Document.jsx` (toolbar) | Title is non-clickable | No click-to-rename handler |
| `Toolbar.jsx` | Owner name shown in collab indicator | `collabOwnerName` from collaborators API |

### SharedWithMeDropdown

Toolbar dropdown (`SharedWithMeDropdown.jsx`) showing documents shared with the current user:

- Fetches from `GET /api/documents/shared-with-me` on dropdown open
- **Unseen badge**: Tracks opened documents via `localStorage` key `sharedWithMe_seen`
- Badge count = documents not yet in the seen set; uses `bg="info"` (not red/primary)
- New/unseen items get `.shared-dropdown-item--new` class with `bi-file-earmark-plus` icon
- Opening a document calls `markSeen(docId)` and delegates to `onOpen({ id, name, ownerName })`
- Prunes seen IDs on each load to avoid localStorage bloat from removed shares

### Document API Owner Fields

The document response includes `owner_name` and `owner_email` (populated when the Document's `owner` relationship is eagerly loaded via `selectinload`). These are shown in the Document Info modal for collaborative documents.

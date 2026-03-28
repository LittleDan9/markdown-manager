# Collaborative Editing

Real-time collaborative editing for Markdown Manager using **Yjs CRDT** with pycrdt on the backend and yjs on the frontend. Multiple users can edit the same document simultaneously with automatic conflict resolution, cursor awareness, and CRDT-stable comment anchoring.

## Architecture Overview

```text
Browser A (Monaco + Y.Doc)          Browser B (Monaco + Y.Doc)
        │                                    │
        │ ws://host/api/ws/collab/:id        │
        ▼                                    ▼
┌──────────────────────────────────────────────────┐
│            FastAPI WebSocket Hub                  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │          CollabManager (Singleton)          │  │
│  │                                            │  │
│  │  sessions: { doc_id → CollabSession }      │  │
│  │    └─ ydoc: pycrdt.Doc (in-memory CRDT)    │  │
│  │    └─ clients: { user_id → WebSocket }     │  │
│  │                                            │  │
│  │  Periodic persist loop (30s)               │  │
│  │  Eviction after 60s idle                   │  │
│  └────────────────────────────────────────────┘  │
│                      │                           │
│                      ▼                           │
│  ┌─────────────────────────────────────┐         │
│  │   document_collab_state (PG table)  │         │
│  │   yjs_state (LargeBinary)           │         │
│  │   yjs_state_vector (LargeBinary)    │         │
│  └─────────────────────────────────────┘         │
│                      │                           │
│                      ▼                           │
│  ┌─────────────────────────────────────┐         │
│  │   UserStorage (filesystem)          │         │
│  │   Content write-back on disconnect  │         │
│  └─────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

## Binary WebSocket Protocol

Every message over the collab WebSocket is a binary frame prefixed with a 1-byte type tag:

| Byte | Type | Description |
|------|------|-------------|
| `0x00` | `MSG_SYNC` | Yjs document update (state vector / incremental update) |
| `0x01` | `MSG_AWARENESS` | Cursor positions, selections, user presence |

**Connection flow:**

1. Client connects to `ws://host/api/ws/collab/{document_id}?token=JWT`
2. Server authenticates JWT, checks permission (owner or editor role)
3. Server accepts WebSocket, joins the `CollabSession`
4. Server sends `[0x00] + full_doc_update` (initial state)
5. Client applies the update to its local `Y.Doc`
6. Bidirectional message loop: client ↔ server relay ↔ other clients

## Permission Model

Three-tier access control for collaborative documents:

| Role | Source | Capabilities |
|------|--------|-------------|
| **Owner** | Implicit (`document.user_id`) | Full control, manage collaborators |
| **Editor** | `document_collaborators` table | Edit document, add comments |
| **Viewer** | `document_collaborators` table | Read-only access, add comments |

- Collaboration is **opt-in** — only activated when a document has collaborators
- Solo editing remains unchanged (no Yjs overhead)
- Public share links (`share_token`) remain read-only and separate from collab

## Database Schema

### `document_collaborators`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Auto-increment |
| `document_id` | Integer (FK → documents) | Target document |
| `user_id` | Integer (FK → users) | Invited user |
| `role` | String(20) | `editor` or `viewer` |
| `invited_by` | Integer (FK → users) | Who sent the invite |
| `created_at` | DateTime | Invite timestamp |

Unique constraint on `(document_id, user_id)`.

### `document_collab_state`

| Column | Type | Description |
|--------|------|-------------|
| `document_id` | Integer (PK, FK → documents) | One-to-one with document |
| `yjs_state` | LargeBinary | Full serialized Y.Doc (from `get_update()`) |
| `yjs_state_vector` | LargeBinary | State vector (from `get_state()`) |
| `updated_at` | DateTime | Last persistence timestamp |

### Comment anchor columns (on `comments` table)

| Column | Type | Description |
|--------|------|-------------|
| `anchor_text` | Text (nullable) | Surrounding text snippet for fallback matching |
| `anchor_ypos` | LargeBinary (nullable) | Serialized `Y.RelativePosition` bytes |

Existing `line_number` column retained for backward compatibility with solo-mode comments.

## REST API Endpoints

All collaboration endpoints are nested under the documents router:

### Collaborator Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/documents/shared-with-me` | List documents shared with current user |
| `GET` | `/api/documents/{id}/collaborators` | List collaborators (includes `is_owner`, `has_collaborators`) |
| `POST` | `/api/documents/{id}/collaborators` | Invite by email + role (`editor`/`viewer`) |
| `PATCH` | `/api/documents/{id}/collaborators/{user_id}` | Update collaborator role |
| `DELETE` | `/api/documents/{id}/collaborators/{user_id}` | Remove collaborator |

### Comments (with anchor support)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/documents/{id}/comments` | Create comment with optional `anchor_text` + `anchor_ypos` (base64) |
| `GET` | `/api/documents/{id}/comments` | List comments (includes anchor fields in response) |

## Backend Components

### `services/backend/app/services/collab.py` — CollabManager

Singleton managing all active collab sessions. Key behaviors:

- **Session lifecycle**: First client → load persisted state or bootstrap from file content. Last client → persist to DB + write content back to filesystem.
- **Single-tab policy**: If the same user connects from a second tab, the first connection is closed with code `4001`.
- **Periodic persistence**: Background loop persists dirty sessions every 30 seconds.
- **Eviction**: Empty sessions are evicted after 60 seconds of inactivity.
- **pycrdt API**: Uses `Doc.get_state()` for state vectors, `Doc.get_update(sv)` for full binary state, and `Doc.apply_update(bytes)` for applying incremental updates.

### `services/backend/app/routers/ws.py` — WebSocket Endpoint

`/ws/collab/{document_id}` — JWT auth via query param, binary protocol, extracted helpers for authentication and message loop to keep cyclomatic complexity manageable.

### `services/backend/app/routers/documents/collaboration.py` — REST Router

Collaborator invite/list/update/remove endpoints. Sends a "Collaboration Invite" notification to the invitee.

### `services/backend/app/crud/document_collaborator.py` — CRUD Layer

Permission queries: `get_user_role()` checks ownership first, then the collaborators table. `get_shared_with_me()` joins documents + users for rich response data.

### Models

- `app/models/document_collaborator.py` — `DocumentCollaborator` with relationships to Document, User, and inviter
- `app/models/document_collab_state.py` — `DocumentCollabState` one-to-one with Document

### Migrations

- `e4f5a6b7c8d9` — Creates `document_collaborators` and `document_collab_state` tables
- `f5a6b7c8d9e0` — Adds `anchor_text` and `anchor_ypos` columns to `comments` table

## Frontend Components

### `hooks/editor/useCollaboration.js` — Core CRDT Hook

Manages the full Yjs lifecycle:

- Dynamic imports of `yjs` and `y-protocols/awareness` (code-split)
- Creates `Y.Doc`, `Y.Text('content')`, `Awareness`, and `UndoManager`
- Opens WebSocket to `/api/ws/collab/{documentId}` with binary protocol
- Outgoing: `doc.on('update')` → send `MSG_SYNC`; `awareness.on('update')` → send `MSG_AWARENESS`
- Incoming: `MSG_SYNC` → `Y.applyUpdate`; `MSG_AWARENESS` → `applyAwarenessUpdate`
- Auto-reconnect on non-intentional close (3-second delay)
- `applyLocalChange(newContent)` — full-text replace in `Y.Text` (delete all + insert)
- `onRemoteChange(callback)` — register for peer edits

### `hooks/editor/useCommentAnchors.js` — Comment Anchoring

Utilities for creating and resolving Yjs-based comment anchors:

- `createAnchor(charIndex)` — creates `Y.RelativePosition` at a character offset, captures surrounding text
- `resolveAnchor(base64)` — resolves a stored anchor to current character index
- `createAnchorFromLine(lineNumber, content)` — convenience wrapper converting line → char index → anchor
- `indexToLine()` / `lineToIndex()` — bidirectional conversion utilities
- Falls back to plain `line_number` in solo mode

### `api/collaborationApi.js` — REST Client

Methods: `getCollaborators`, `inviteCollaborator`, `updateCollaboratorRole`, `removeCollaborator`, `getSharedWithMe`.

### `components/sections/EditorSection.jsx`

Orchestrates collab state:

1. Checks `has_collaborators` via REST API on document change
2. Passes result to `useCollaboration(documentId, hasCollaborators)`
3. Wires `useCommentAnchors` for anchor creation
4. Tracks cursor line for comment anchoring
5. Passes collab state to `Editor` and `CommentsPanel`

### `components/Editor.jsx`

Accepts `collab` prop. Wraps `triggerContentUpdate` with collab-aware `handleContentChange` that calls `collab.applyLocalChange()`. Registers remote change handler via `collab.onRemoteChange()`. Forwards cursor position via `onCursorChange`.

### `components/editor/CommentsPanel.jsx`

Dual-mode comment creation:

- **Collab mode** (`collabActive=true`): Shows "Line N" indicator from cursor position. On submit, creates a `Y.RelativePosition` anchor via `onCreateAnchor`.
- **Solo mode**: Traditional manual "Line #" number input.
- Displays pin badge on anchored comments and shows anchor text snippet.

### `components/shared/modals/ShareModal.jsx`

Enhanced with collaborator management section:

- Invite by email with role picker (Editor/Viewer)
- List current collaborators with role dropdown
- Owner-only controls for role changes and removal

### `components/shared/modals/SharedWithMeModal.jsx`

Browse documents shared with the current user. Shows document name, owner, role badge, and last updated date.

### `components/toolbar/Toolbar.jsx`

Added "Shared with me" button (bi-people icon) that opens `SharedWithMeModal`.

## Configuration

### pycrdt (Backend)

Added to `services/backend/pyproject.toml`:

```toml
pycrdt = "^0.12.0"
```

### Yjs (Frontend)

Added to `services/ui/package.json`:

```json
"yjs": "^13.6.0",
"y-protocols": "^1.0.6"
```

### Nginx

WebSocket upgrade for `/api/ws/` routes is already configured in `nginx/nginx-dev.conf` and `nginx/nginx-prod.conf`.

### App Factory

`collab_manager.start()` and `collab_manager.stop()` are registered in the lifespan handler in `app/app_factory.py`.

## Data Flow: Editing Session

```text
1. User A opens document → EditorSection checks collaborators → has_collaborators=true
2. useCollaboration activates → creates Y.Doc, connects WebSocket
3. Server: creates CollabSession, bootstraps Y.Doc from file content
4. Server sends initial state → Client applies → Editor shows content

5. User A types → Monaco onChange → handleContentChange
   → collab.applyLocalChange(text) → Y.Doc update
   → doc.on('update') → WebSocket sends [0x00 + update]
   → Server applies update + relays to User B
   → User B: Y.applyUpdate → onRemoteChange → editor updates

6. User A disconnects → Server: last client leaves
   → Persist Y.Doc to document_collab_state
   → Write Y.Text content back to filesystem
   → Schedule session eviction (60s)
```

## Data Flow: Comment Anchoring

```text
1. User places cursor at line 5 in collab mode
2. CommentsPanel shows "Line 5" indicator
3. User submits comment → onCreateAnchor(5)
   → createAnchorFromLine(5, content)
   → lineToIndex(5, content) → charIndex
   → Y.createRelativePositionFromTypeIndex(ytext, charIndex)
   → Encode to base64 + capture surrounding text
4. API: POST /documents/{id}/comments
   { content, line_number: 5, anchor_text: "...", anchor_ypos: "base64..." }
5. Server stores anchor_ypos as LargeBinary

6. Later: text above line 5 is edited by collaborators
   → Y.RelativePosition resolves to new position automatically
   → Comment stays anchored to the original text
```

## Known Limitations

- **No y-monaco binding**: Remote cursors are not yet rendered as colored decorations in the editor. The `y-monaco` package could be added for this.
- **Naive text diffing**: `applyLocalChange` uses full-text replace (delete all + insert). A proper diff algorithm (e.g., `fast-diff`) would produce smaller updates.
- **Single-tab policy**: Only one WebSocket connection per user per document. Opening the same document in two tabs disconnects the first.
- **No viewer WebSocket**: Viewers currently don't connect to the collab WebSocket (no read-only sync mode).
- **UndoManager not wired**: The `Y.UndoManager` is created but not connected to Monaco's undo/redo.

## Future Improvements

1. **y-monaco integration** — Colored remote cursors and selection decorations
2. **Efficient diffing** — Use `fast-diff` or similar for minimal Y.Text operations
3. **Viewer sync** — Read-only WebSocket mode for viewers to see live edits
4. **Conflict indicators** — Visual feedback when concurrent edits occur nearby
5. **Offline queue** — Queue local edits when disconnected and sync on reconnect
6. **Comment anchor resolution display** — Auto-update displayed line numbers as anchors resolve to new positions
7. **Presence indicators** — Show active collaborators in the toolbar with colored avatars

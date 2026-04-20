# Sharing & Collaboration

Markdown Manager supports public share links for read-only access and real-time collaborative editing with other users.

## Public Share Links

Share a read-only version of any document via a unique URL.

1. Open the document you want to share
2. Click the **Share** button in the toolbar
3. In the Share modal, click **Generate Share Link**
4. A unique URL is created (e.g., `https://your-domain/shared/abc123`)
5. Click **Copy** to copy the URL to your clipboard
6. Share the URL with anyone — no login required to view

The shared view shows the document title, author, category, last updated date, and a "Read-only" badge. The link always shows the current version of the document.

To revoke a share link, open the Share modal and click **Disable Sharing**.

## Real-Time Collaborative Editing

Invite other users to edit documents with you in real time.

### Inviting Collaborators

1. Open the Share modal for a document
2. Enter a collaborator's email address
3. Choose a role:
   - **Editor** — can view and edit the document
   - **Viewer** — can only view the document
4. Click **Invite**

### Collaboration Features

When collaborators are present on a document:

- The editor switches to **real-time collaborative mode** (powered by Yjs CRDT over WebSocket)
- **Presence indicators** — avatar initials of other users currently viewing the document appear in the toolbar (up to 3 visible, with a "+N" overflow indicator)
- **"Collab" indicator** — when editing a document shared by another user, the toolbar shows the document owner's name
- Changes from all editors appear instantly — no save/refresh needed
- Automatic reconnection with exponential backoff if the connection drops
- Full undo/redo support that respects each user's own edit history

### Comments

- Click the **Comments** button in the toolbar to open the Comments panel
- Comments are anchored to specific positions in the document
- Anchors are stored as relative positions (Yjs), so they survive concurrent edits by other collaborators
- A badge on the Comments button shows the total comment count

### Managing Collaborators

- The document owner can change collaborator roles or remove collaborators from the Share modal
- The **Shared With Me** dropdown in the toolbar shows all documents other users have shared with you — click to open one directly

## Permissions Summary

| Role | View | Edit | Share | Delete |
|---|---|---|---|---|
| **Owner** | ✓ | ✓ | ✓ | ✓ |
| **Editor** | ✓ | ✓ | — | — |
| **Viewer** | ✓ | — | — | — |
| **Public (share link)** | ✓ | — | — | — |

# File Management

Markdown Manager organizes your documents by categories and supports import, export, version control, and a unified file browser.

## Creating Documents

- **File → New Document** creates a new untitled document in the Drafts category
- Start writing immediately — the document is auto-saved if Autosave is enabled
- On your first manual save, you'll be prompted to name the document and choose a category (or keep it as a Draft)

## Opening Documents

- **File → Open Document** opens the unified file browser modal
- The file browser shows a tree of your local documents organized by category, plus any synced GitHub repositories under `/GitHub/owner/repo/`
- Single-click to preview a document, double-click to open it in the editor
- Use breadcrumb navigation to move between folders

### Quick Access

- **File → Recent Files** — shows your most recently accessed documents
- **File → Unsaved Documents** — lists documents with unsaved local changes
- **File → Open Category** — jump directly to a specific category's document list

## Saving

- Press **Ctrl+S** or use **File → Save**
- **File → Save As** — creates a copy with a new name and optional category change
- If Autosave is enabled (toggle in user menu), changes are saved automatically at regular intervals

### Promoting Drafts

When you save a Draft document for the first time, a dialog appears offering to "promote" it — give it a proper name and assign it to a category other than Drafts.

## Deleting Documents

- **File → Delete Document** permanently removes the current document (requires confirmation)
- You can also delete documents from the file browser using the inline delete button

## Categories

Documents are organized into categories. Default categories include Drafts and General. You can create custom categories to organize your work by topic, project, or any structure you prefer.

## Import and Export

| Action | How |
|---|---|
| **Import Markdown** | File → Import Markdown — select a `.md` file from disk. Choose to import as a new document or append to the current one. |
| **Export Markdown** | File → Export Markdown — downloads the current document as a `.md` file |
| **Export PDF** | File → Export PDF — generates a PDF of the rendered preview, including diagrams, code highlighting, and your current theme (light/dark) |

## Version Control (Git)

Documents linked to a Git repository (local or via GitHub) have additional options in the File menu:

- **Commit Changes** — enter a commit message and commit your edits
- **Save & Commit** — save and commit in one step
- **Create Branch** — create and switch to a new branch
- **Browse Repository** — navigate the repository file tree in the file browser
- **View History** — open a modal showing the commit log

A **Git status badge** appears on the File button when there are uncommitted changes.

## Image Manager

Access via the user menu → **Image Manager**. This shows all your uploaded images with:

- Search by filename
- Sort by date, name, or file size
- Storage statistics (total count and size)
- Delete images (with confirmation)

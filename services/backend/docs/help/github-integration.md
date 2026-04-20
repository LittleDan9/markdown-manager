# GitHub Integration

Connect your GitHub account to sync repositories, push documents, and manage pull requests directly from Markdown Manager.

## Connecting Your GitHub Account

1. Go to the user menu → **GitHub**, or use **File → Save to GitHub**
2. Click **Connect GitHub Account**
3. A GitHub OAuth popup opens — authorize the application
4. After authorization, your repositories are automatically synced in the background

You can connect multiple GitHub accounts and manage them from the GitHub modal.

## Repository Management

Once connected, the GitHub modal shows all your repositories:

- **Search** repositories by name
- **Filter** by organization, language, or visibility (public/private)
- **Add to workspace** — select a repository to clone it to local storage
- **Remove from workspace** — unlink a repository
- **Enable/Disable sync** — per-repository toggle for automatic synchronization
- **Bulk add** — select multiple repositories at once
- View repository statistics: total count, synced count, and storage used

## Working with GitHub Documents

### File Browser Integration

Synced GitHub repositories appear in the file browser under `/GitHub/owner/repo/`. You can browse folders and open `.md` files directly into the editor.

### Saving to GitHub

1. Open a document
2. Use **File → Save to GitHub**
3. Choose the target repository, branch, and file path
4. Enter a commit message
5. Click **Save** — the document is pushed to GitHub

### Committing and Syncing

- **Commit Changes** — commit local edits to the linked repository with a commit message
- **Save & Commit** — save the document and commit in one step
- **Pull from GitHub** — pull the latest remote changes; automatic three-way merge with local edits

### Conflict Resolution

When a pull results in merge conflicts, you'll be prompted to resolve them. The conflict resolution interface shows the conflicting content and lets you choose which version to keep.

### Creating Pull Requests

From the editor, you can create a pull request on GitHub:

1. Use the Pull Request option from the File/Git menu
2. Specify the title, description, and head/base branches
3. Submit — the PR is created on GitHub

### Viewing Git History

Open **File → View History** to see the commit log for the current document, including commit messages, authors, and dates.

## Cache and Sync

- Repositories sync in the background after connecting
- Sync status updates are polled in real time
- Cache statistics are available in the GitHub Management modal under the performance section

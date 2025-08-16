# Storage System Enhancement Ideas

Here are some additional storage features you might consider for the modular storage system:

## Document Versioning/History

Store previous versions of documents for undo/restore functionality.
Useful for recovering from accidental changes or deletions.
Document Backup/Restore:

Export all documents/categories as a JSON file for backup.
Import/restore from a backup file.
Conflict Detection/Resolution:

Detect if a document has changed on the backend since last sync.
Prompt user to resolve conflicts (merge, overwrite, etc.).
Offline Change Queue:

Queue changes made while offline and sync them when reconnected.
Useful for robust offline-first experiences.
Document Sharing/Collaboration:

Store and manage shared documents or collaboration invitations.
Track which documents are shared and with whom.
Category Management Enhancements:

Allow category color/icon customization and persist those settings.
Store category metadata (description, order, etc.).
Document Favorites/Pinning:

Mark documents as favorites or pin them for quick access.
Store favorite/pinned status in localStorage.
Document Tagging:

Support tags in addition to categories for flexible organization.
Store and manage tags per document.
Audit Log:

Track and store a log of all document/category operations for troubleshooting or analytics.
Storage Usage Stats:

Track and report storage usage (number of documents, total size, etc.).

---

## Autosave

* Not trigging at a consistent interval
* Seems that on complete, editor insertion point is moved to line 0, char 0.
* On autosave, some data is being lost as I think the save might be updating the editor content, which also might be the cause for the item above.

## Preview Pane

* Style Markdown Tables better - Still need to fix 100% background color.

---

## GitHub Integration Options

Great idea! GitHub integration would add significant value to the markdown manager. Here are the possibilities I can envision:

Core GitHub Integration Features
Authentication & User Management
GitHub OAuth login - Streamlined signup/login process
Profile sync - Pull GitHub profile info (avatar, name, bio)
Repository permissions - Respect private/public repo access
Repository Operations
Repository browser - List user's repos, browse folder structures
Import from repo - Load markdown files directly from GitHub repos
Export to repo - Save documents as files to existing or new repos
Branch management - Work with different branches, create feature branches
Advanced Workflow Features
Git integration - Commit messages, commit history, file versioning
Pull request creation - Direct PR creation from edited documents
Collaboration - Share documents via repo invites, track contributors
Sync status - Show when local changes differ from repo versions
Content Management
README editing - Special handling for README.md files with live preview
Documentation workflows - Edit docs/ folders, maintain documentation sites
Issue integration - Link documents to GitHub issues, create issues from notes
Wiki management - Edit GitHub wiki pages directly
Publishing & Sharing
GitHub Pages integration - Deploy markdown as static sites
Gist integration - Save/load from GitHub Gists for quick sharing
Release notes - Create and manage release documentation
Project documentation - Maintain project docs with automatic syncing
Developer-Focused Features
Code snippet management - Extract/embed code from repos into documents
API documentation - Generate docs from code comments/schemas
Changelog automation - Generate changelogs from commit history
Badge integration - Embed repo status badges, CI/CD status
Advanced Possibilities
Multi-repo projects - Work across multiple related repositories
Template system - Create document templates from successful repo patterns
Automated backups - Auto-commit document changes with configurable intervals
Conflict resolution - Handle merge conflicts when multiple editors work on same docs
This would transform the tool from a simple markdown editor into a comprehensive documentation and content management platform for developers. The GitHub ecosystem integration would make it particularly valuable for open source projects and development teams.

Would you like me to explore implementing any specific feature first, like GitHub OAuth authentication or repository browsing?

## Auth Token

* Decrease from 7 days
* implement referesh token. Learn about how this works.
---
description: "Use when working on admin panel, user management, storage management, AI/embeddings admin, MFA/security setup, user settings/profile, system health monitoring, or user preferences."
applyTo: "services/ui/src/components/admin/**,services/ui/src/components/security/**,services/ui/src/components/user/**,services/ui/src/components/settings/**,services/ui/src/components/storage/**,services/ui/src/components/system/**,services/ui/src/api/admin/**,services/ui/src/api/userApi*,services/ui/src/api/systemHealthApi*,services/ui/src/providers/UserSettingsProvider*"
---
# Admin, Security & User Settings UI

## Admin Panel (`AdminModal`)
Extra-large modal with tabbed interface:
- **User Management** (`UserManagementTab`) → User CRUD, role management
- **Storage Management** (`AdminStorageTab`) → Storage usage, cleanup, orphan detection
- **AI & Embeddings** (`AdminAITab`) → Embedding service status, index management
- **Orphans** (`OrphansTab`) → Orphaned file detection and cleanup

### Admin API Clients (`api/admin/`)
- `usersApi` → User listing, creation, role changes, disable/enable
- `systemApi` → System health, disk usage, service status
- `iconsApi` → Icon pack admin operations
- `githubApi` → GitHub integration admin (account overview, sync status)

## Security / MFA (`components/security/modals/`)

### MFA Setup Flow (4-step wizard)
1. **QR Code**: `userApi.setupMFA()` → displays QR code + manual secret
2. **Verify Code**: Submit 6-digit TOTP → `userApi.verifyMFASetup(code)`
3. **Password Confirm**: Submit password → `userApi.enableMFA(password)`, fetches backup codes
4. **Backup Codes**: Display one-time codes, user acknowledges

Components: `MFAModal` (wizard orchestrator with Accordion steps), `MFATab` (entry point), `SecurityTab` (MFA status overview), `BackupCodesSection`, `DisableMFASection`, `VerifyMFAModal` (login-time verification).

UI mechanics: ProgressBar at step × 25%, static backdrop modal, step navigation via Back/Next.

## User Settings (`components/user/modals/`)
- `UserSettingsModal` → Tabbed settings container
- `ProfileInfoTab` → Name, email, password change
- `DisplayTab` → Theme, editor width, UI preferences

## UserSettingsProvider
Context providing UI settings with localStorage hydration:
- Editor split width persistence
- Display preferences
- Auth-aware settings loading

## System Health (`components/system/`)
System health monitoring modal showing service status, database connectivity, and resource usage via `systemHealthApi`.

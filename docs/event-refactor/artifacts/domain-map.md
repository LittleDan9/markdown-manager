# Domain Map — Bounded Contexts and Data Ownership

This document maps the current monolithic system into proposed domain boundaries based on business capabilities and data ownership patterns.

## Bounded Contexts Identified

### 1. **Identity Domain**
**Current State**: Embedded in Backend FastAPI service
**Target Owner**: Identity Service (new extraction from Backend)
**Responsibility**: User authentication, profile management, preferences

**Database Tables**:
- `users` (owns completely)
  - Authentication: email, hashed_password, reset tokens, MFA fields
  - Profile: first_name, last_name, display_name, bio
  - Preferences: sync_preview_scroll_enabled, autosave_enabled, editor_width_percentage
  - Status: is_active, is_verified, is_admin
  - Current document tracking: current_doc_id

**API Endpoints** (Backend FastAPI routes):
- `/auth/*` - Authentication, registration, password reset, MFA
- `/users/*` - User profile management
- `/admin/*` - Admin user management

**External Dependencies**:
- None (self-contained domain)

---

### 2. **Linting Domain**
**Current State**: Separate Node.js service + Backend proxy routes
**Target Owner**: Linting Service (markdown-lint-service)
**Responsibility**: Markdown linting rules, preferences, processing

**Database Tables**:
- `markdown_lint_rules` (owns completely)
  - User-level rules: user_id, rules JSON, description
  - Category-level rules: user_id, category_id, rules JSON
  - Folder-level rules: user_id, folder_path, rules JSON

**API Endpoints**:
- **Backend Proxy Routes**: `/api/markdown-lint/*` (proxies to service)
- **Direct Service Routes**: `markdown-lint-service:8002/*`
  - `/lint` - Process markdown text
  - `/rules/definitions` - Get rule definitions
  - `/rules/recommended-defaults` - Get recommended defaults
  - `/health` - Service health

**External Dependencies**:
- **Identity Domain**: Needs user information for rule scoping
- **Documents Domain**: Uses folder paths for rule scoping

---

### 3. **Spell-Check Domain**
**Current State**: Separate Node.js service + Backend proxy routes
**Target Owner**: Spell-Check Service (spell-check-service)
**Responsibility**: Spell checking, custom dictionaries, language detection

**Database Tables**:
- `custom_dictionaries` (owns completely)
  - User-level: user_id, word, notes
  - Category-level: user_id, category_id, word, notes
  - Folder-level: user_id, folder_path, word, notes

**API Endpoints**:
- **Backend Proxy Routes**: `/api/spell-check/*` (proxies to service)
- **Direct Service Routes**: `spell-check-service:8003/*`
  - `/check` - Spell check text
  - `/health` - Service health
  - `/info` - Service capabilities
  - `/languages` - Available languages

**External Dependencies**:
- **Identity Domain**: Needs user information for custom dictionary scoping
- **Documents Domain**: Uses folder/category paths for dictionary scoping

---

### 4. **Export Domain**
**Current State**: Separate Python service + Backend proxy routes
**Target Owner**: Export Service (export-service)
**Responsibility**: Document export (PDF, Draw.io), diagram conversion

**Database Tables**:
- None currently (stateless service)

**API Endpoints**:
- **Backend Proxy Routes**: `/api/export/*` (proxies to service)
- **Direct Service Routes**: `export-service:8001/*`
  - `/convert/*` - Various conversion endpoints
  - `/health` - Service health

**External Dependencies**:
- **Backend**: Fetches icon data via Icon Service APIs
- **Documents Domain**: Needs document content for export

---

### 5. **Documents Domain**
**Current State**: Embedded in Backend FastAPI service
**Target Owner**: Backend Service (remains in Backend for now)
**Responsibility**: Document storage, categories, file management, GitHub integration

**Database Tables**:
- `documents` (owns completely)
  - Core: id, name, file_path, folder_path, repository_type
  - Timestamps: created_at, updated_at, last_opened_at
  - Ownership: user_id, category_id
  - Sharing: share_token, is_shared
  - Metadata: image_metadata (JSON)
  - GitHub integration: github_repository_id, github_file_path, github_branch, etc.

- `categories` (owns completely)
  - Basic: id, name, description, user_id
  - Timestamps: created_at, updated_at

- `github_*` tables (GitHub integration)
  - `github_accounts`, `github_repositories`, `github_sync_history`
  - `git_operation_logs`

**API Endpoints**:
- `/documents/*` - Document CRUD operations
- `/categories/*` - Category management
- `/github/*` - GitHub integration
- `/images/*` - Image management
- `/pdf/*` - PDF processing

**External Dependencies**:
- **Identity Domain**: Requires user_id for ownership
- **Export Domain**: Provides document content for export

---

### 6. **Icon/Asset Domain**
**Current State**: Embedded in Backend FastAPI service
**Target Owner**: Backend Service (remains in Backend for now)
**Responsibility**: Icon management, asset serving, third-party browsing

**Database Tables**:
- `icon_*` tables (icon management)
- Potential statistics/usage tables

**API Endpoints**:
- `/icons/*` - Icon service endpoints
- `/admin/icons/*` - Icon administration
- `/iconify/*` - Iconify browser
- `/third-party/*` - Third-party asset browsing

**External Dependencies**:
- **Documents Domain**: Icons used in documents
- **Export Domain**: Icons used in exports

---

## Domain Relationships Summary

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Identity  │────▶│  Documents   │────▶│     Export      │
│   Domain    │     │   Domain     │     │    Domain       │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                     │                     │
       ▼                     ▼                     │
┌─────────────┐     ┌──────────────┐              │
│   Linting   │     │ Icon/Asset   │◀─────────────┘
│   Domain    │     │   Domain     │
└─────────────┘     └──────────────┘
       │
       ▼
┌─────────────┐
│Spell-Check  │
│   Domain    │
└─────────────┘
```

## Data Ownership Matrix

| Table | Current Owner | Target Owner | Rationale |
|-------|--------------|--------------|-----------|
| `users` | Backend | **Identity Domain** | Core authentication/profile data |
| `documents` | Backend | **Documents Domain** | Document lifecycle management |
| `categories` | Backend | **Documents Domain** | Document organization |
| `custom_dictionaries` | Backend | **Spell-Check Domain** | Spell-check specific data |
| `markdown_lint_rules` | Backend | **Linting Domain** | Linting specific data |
| `github_*` | Backend | **Documents Domain** | Document source integration |
| `icon_*` | Backend | **Icon/Asset Domain** | Asset management |

## Cross-Domain Data Access Patterns

### Current (Monolithic)
- All services access Backend database directly
- Backend mediates all service interactions
- Services call Backend APIs for user/document context

### Target (Domain-Driven)
- Each domain owns its data exclusively
- Cross-domain access via events or APIs
- Read models/projections for local queries
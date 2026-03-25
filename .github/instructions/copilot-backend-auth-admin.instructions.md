---
description: "Use when working on authentication (JWT, MFA, OAuth, password reset, registration), admin panel backend, user management, site settings, or role-based access control."
applyTo: "services/backend/app/routers/auth/**,services/backend/app/routers/admin/**,services/backend/app/core/auth*,services/backend/app/crud/user*,services/backend/app/models/user*,services/backend/app/schemas/user*,services/backend/app/models/site_setting*"
---
# Backend Auth & Admin

## Authentication Architecture

### Core Auth (`core/auth.py`)
Centralized JWT + password utilities:
- JWT token creation/verification with configurable expiry
- Password hashing with bcrypt
- `get_current_user` dependency for route protection
- Token refresh patterns

### Auth Router (`routers/auth/`)
Subrouters composed in `router.py`:
```
/auth/login          → JWT token generation (email + password)
/auth/register       → User registration with validation
/auth/profile        → User profile CRUD (authenticated)
/auth/mfa            → TOTP MFA setup, verification, enable/disable
/auth/password-reset → Password reset flow (token-based)
```

### MFA Flow (Backend)
1. `POST /auth/mfa/setup` → Generates TOTP secret + QR code data URL
2. `POST /auth/mfa/verify` → Validates 6-digit TOTP code against secret
3. `POST /auth/mfa/enable` → Requires password confirmation, activates MFA
4. `GET /auth/mfa/backup-codes` → Returns one-time backup codes
5. `POST /auth/mfa/disable` → Requires password, deactivates MFA

### OAuth (GitHub)
GitHub OAuth integration handled in `routers/github/auth.py`:
- State parameter for CSRF validation
- Token exchange and account linking
- See `copilot-backend-github.instructions.md` for details

## Admin Router (`routers/admin/`)
Composed in `router.py` with prefix `/admin`:
```
/admin/users   → User listing, creation, role changes, enable/disable
/admin/icons   → Icon pack admin operations
/admin/github  → GitHub integration overview, sync status
/admin/system  → System health, disk usage, service status
```

All admin endpoints require authenticated admin-role user.

## Data Layer
- **Models**: `user.py` (User with email, hashed_password, mfa_secret, is_admin, mfa_enabled), `site_setting.py` (key-value application settings)
- **Schemas**: `user.py` (registration, login, profile update, MFA schemas)
- **CRUD**: `user.py` (user creation, lookup, update, role management)

## Security Patterns
- Passwords hashed with bcrypt (never stored plain)
- MFA secrets encrypted at rest
- JWT tokens include user_id and role claims
- Admin routes check `is_admin` flag via dependency injection
- Password reset uses time-limited tokens
- GitHub OAuth uses state parameter for CSRF protection

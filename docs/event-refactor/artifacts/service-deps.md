# Service Dependencies — Current Integration Patterns

This document maps the current service-to-service communication patterns and identifies where the Backend acts as a mediator/proxy.

## Current Architecture Overview

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend  │    │      Nginx       │    │    Backend      │
│   (React)   │◀──▶│  (Reverse Proxy) │◀──▶│   (FastAPI)     │
│   Port 3000 │    │    Port 80       │    │   Port 8000     │
└─────────────┘    └──────────────────┘    └─────────────────┘
                            │                        │
                            │                        │
        ┌───────────────────┼────────────────────────┼────────────────────┐
        │                   │                        │                    │
        ▼                   ▼                        ▼                    ▼
┌─────────────┐    ┌─────────────┐         ┌─────────────┐    ┌─────────────┐
│Export Service│    │Lint Service │         │Spell Service│    │  Postgres   │
│  (Python)   │    │   (Node)    │         │   (Node)    │    │ (Database)  │
│  Port 8001  │    │  Port 8002  │         │  Port 8003  │    │  Port 5432  │
└─────────────┘    └─────────────┘         └─────────────┘    └─────────────┘
```

## Service Communication Patterns

### 1. Frontend → Backend (Direct API Calls)

**Route Pattern**: `Frontend` → `Nginx` → `Backend:8000`
**URL Pattern**: `http://localhost/api/*` → `http://backend:8000/*`

**API Categories**:
- Authentication: `/api/auth/*`
- User Management: `/api/users/*`
- Document Management: `/api/documents/*`
- Categories: `/api/categories/*`
- Admin: `/api/admin/*`
- Icons/Assets: `/api/icons/*`, `/api/iconify/*`, `/api/third-party/*`
- GitHub Integration: `/api/github/*`
- Images: `/api/images/*`
- PDF Processing: `/api/pdf/*`

**Dependency Pattern**: Direct service consumption

---

### 2. Frontend → Export Service (Nginx Proxy)

**Route Pattern**: `Frontend` → `Nginx` → `Export Service:8001`
**URL Pattern**: `http://localhost/api/export/*` → `http://export-service:8001/*`

**Nginx Configuration**:
```nginx
location /api/export/ {
    rewrite ^/api/export/(.*)$ /$1 break;
    proxy_pass http://export-service:8001;
    # ... proxy headers
}
```

**API Endpoints**:
- Document conversion: `/api/export/convert/*`
- Health check: `/api/export/health`

**Dependency Pattern**: Direct nginx proxying (bypasses Backend)

---

### 3. Frontend → Linting Service (Backend Proxy)

**Route Pattern**: `Frontend` → `Nginx` → `Backend` → `Linting Service:8002`
**URL Pattern**: `http://localhost/api/markdown-lint/*` → `Backend` → `http://markdown-lint-service:8002/*`

**Backend Proxy Implementation**:
```python
# /backend/app/routers/markdown_lint.py
@router.post("/process")
async def process_markdown(request: LintRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.markdown_lint_service_url}/lint",
            json=request.dict()
        )
```

**API Endpoints**:
- Text processing: `/api/markdown-lint/process`
- Rule definitions: `/api/markdown-lint/rules/definitions`
- User defaults: `/api/markdown-lint/user/defaults`
- Category rules: `/api/markdown-lint/categories/{id}/rules`
- Folder rules: `/api/markdown-lint/folders/{path}/rules`

**Backend Mediation**:
- ✅ Authentication/authorization
- ✅ User context injection
- ✅ Database operations (rule storage)
- ✅ Request/response transformation

---

### 4. Frontend → Spell-Check Service (Backend Proxy)

**Route Pattern**: `Frontend` → `Nginx` → `Backend` → `Spell-Check Service:8003`
**URL Pattern**: `http://localhost/api/spell-check/*` → `Backend` → `http://spell-check-service:8003/*`

**Backend Proxy Implementation**:
```python
# /backend/app/routers/spell_check.py
@router.post("/")
async def check_text_spelling(request: SpellCheckApiRequest):
    # Get custom words from database
    combined_custom_words = await get_combined_custom_words(
        user=current_user, db=db, additional_words=request.customWords
    )

    # Call spell service
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{service_url}/check", json=payload)
```

**API Endpoints**:
- Text checking: `/api/spell-check/`
- Health check: `/api/spell-check/health`
- Service info: `/api/spell-check/info`
- Languages: `/api/spell-check/languages`

**Backend Mediation**:
- ✅ Authentication/authorization
- ✅ Custom dictionary lookup from database
- ✅ User context injection
- ✅ Request/response enrichment

---

### 5. Export Service → Backend (Direct API Calls)

**Route Pattern**: `Export Service:8001` → `Backend:8000`
**URL Pattern**: `http://backend:8000/icons/*` (icon service APIs)

**Usage Pattern**:
```python
# Export service calls Backend for icon data during diagram conversion
ICON_SERVICE_URL = os.getenv("ICON_SERVICE_URL", "http://backend:8000")
icon_response = await client.get(f"{ICON_SERVICE_URL}/icons/search")
```

**Dependency Pattern**: Export service depends on Backend's icon APIs

---

### 6. Backend → Database (Direct Connection)

**Route Pattern**: `Backend:8000` → `Postgres:5432`
**Connection**: SQLAlchemy ORM with async connections

**Database Access**:
- All domain tables accessed by Backend
- Custom dictionaries managed by Backend
- Linting rules managed by Backend
- User authentication/profile data

---

## Backend as Context Broker Patterns

### 1. Authentication Context
**Pattern**: Backend validates user tokens and injects user context into downstream service calls

**Services Affected**:
- Linting Service (user-specific rules)
- Spell-Check Service (user-specific dictionaries)

**Implementation**:
```python
current_user: User = Depends(get_current_user)
# User context passed to downstream services via custom headers or request enrichment
```

### 2. Database Context
**Pattern**: Backend performs database lookups and enriches requests to downstream services

**Examples**:
- Spell-Check: Backend fetches custom dictionary words from DB before calling service
- Linting: Backend manages rule storage and retrieval from DB

### 3. Response Transformation
**Pattern**: Backend transforms downstream service responses to match API contracts

**Examples**:
- Converting service-specific error formats to standard API responses
- Adding metadata (user context, timing, etc.) to service responses

## Service Independence Matrix

| Service | Direct Frontend Access | Backend Mediation | Database Access | Independence Level |
|---------|------------------------|-------------------|-----------------|-------------------|
| **Export Service** | ✅ (via Nginx) | ❌ | ❌ | **High** - Only depends on Backend for icons |
| **Linting Service** | ❌ | ✅ (Full proxy) | ❌ | **Low** - Fully mediated by Backend |
| **Spell-Check Service** | ❌ | ✅ (Full proxy) | ❌ | **Low** - Fully mediated by Backend |
| **Backend** | ✅ (via Nginx) | N/A | ✅ | **N/A** - Core service |

## Coupling Analysis

### Tight Coupling (Problem Areas)
1. **Linting Service ↔ Backend**: Cannot function without Backend for user rules
2. **Spell-Check Service ↔ Backend**: Cannot function without Backend for custom dictionaries
3. **Export Service → Backend**: Depends on Backend's icon APIs

### Loose Coupling (Good)
1. **Frontend → Services**: Clean API boundaries via Nginx
2. **Export Service**: Mostly independent, single dependency on icons

## Current Limitations

### 1. Single Points of Failure
- Backend failure breaks Linting and Spell-Check services
- Services cannot scale independently due to Backend dependencies

### 2. Database Bottleneck
- All data access funneled through Backend
- No local caching or read models in services

### 3. Cross-Service Dependencies
- Export Service needs Backend icon APIs
- Services cannot optimize their own data access patterns
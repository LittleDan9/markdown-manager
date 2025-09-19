# AI Agent Backend Guidelines

applyTo: "backend/**/*"

---

## Markdown Manager Backend: FastAPI + SQLAlchemy + Docker Architecture

This backend implements a document management system with GitHub integration, icon services, and PDF generation. Key architectural principles:

### 🏗️ Application Factory Pattern

**Core Structure**: Uses factory pattern (`app/app_factory.py`) with lifespan management:

```python
# Always use create_app() factory, never instantiate directly
app = create_app()  # In main.py
```

**Startup Sequence**: Database initialization → middleware setup → router registration → static mounting. The `lifespan` context manager handles database table creation and configuration validation.

### 🗂️ Service Boundaries & Architecture

**Multi-Service Architecture**:

- `backend` (main API) → port 8000, handles auth, documents, GitHub integration
- `pdf-service` → port 8001, dedicated PDF generation with headless browser
- `db` (PostgreSQL) → port 5432, async SQLAlchemy with connection pooling
- `nginx` → port 80, reverse proxy with API routing to `/api/*`

**Cross-Service Communication**: Use `PDFServiceClient` for PDF operations, `IconService` for icon management. Services communicate via HTTP with health check endpoints (`/health`).

### 🔄 Request Processing Flow

**Middleware Stack** (order matters):

1. `ErrorHandlingMiddleware` → structured error responses with request IDs
2. `RequestContextMiddleware` → context injection for logging/tracing
3. `MonitoringMiddleware` → performance metrics and slow request detection
4. `LoggingMiddleware` → request/response logging with context
5. `CORSMiddleware` → browser request handling

**Router Organization**: Nested structure with prefix patterns:

```python
# Core routes (no prefix)
app.include_router(default.router)  # /, /health
app.include_router(public.router)   # public endpoints

# Feature routes (with prefix)
app.include_router(auth.router, prefix="/auth")     # /auth/login, /auth/mfa/*
app.include_router(documents.router, prefix="/documents")
app.include_router(github.router, prefix="/github")
```

### 🗄️ Database Patterns

**Async SQLAlchemy**: Always use async sessions via dependency injection:

```python
async def endpoint(db: AsyncSession = Depends(get_db)):
    # Never create sessions manually
    async with db as session:  # Session management is handled
```

**Model Architecture**:

- `BaseModel` → common fields (id, created_at, updated_at)
- Domain models extend `BaseModel` → User, Document, Category, GitHubAccount
- Repository pattern in `crud/` modules for data access layer

**Migration Strategy**: **CRITICAL - Run migrations from local machine, NOT container**:

```bash
# ALWAYS run from backend/ directory on development machine
cd backend/
poetry run alembic revision --autogenerate -m "description"
poetry run alembic upgrade head
# Never run migrations from inside Docker containers
```

### 🔐 Authentication & Authorization

**Multi-Factor System**: JWT + optional TOTP MFA in `auth/` sub-routers:

- `/auth/login` → JWT token generation
- `/auth/mfa/*` → TOTP setup/verification
- `/auth/profile` → user management
- `/auth/github/*` → OAuth integration

**Security Patterns**: Password hashing with bcrypt, GitHub OAuth with state validation, MFA secrets encrypted at rest.

### 🧪 Testing Architecture

**Test Organization**:

- `tests/fixtures/` → database, application, and data fixtures
- `tests/unit/` → isolated component tests
- `tests/integration/` → service interaction tests
- `tests/e2e/` → full workflow tests

**Database Testing**: In-memory SQLite with automatic fixture cleanup:

```python
# conftest.py pattern
@pytest.fixture
async def test_db():
    async with AsyncSessionLocal() as session:
        yield session  # Auto-cleanup after test
```

**Test Commands**:

```bash
# In backend directory
poetry run pytest                    # all tests
poetry run pytest tests/unit/        # unit tests only
poetry run pytest -m "not e2e"      # exclude end-to-end
./scripts/test-coverage.sh          # with coverage report
```

### 🔧 Development Workflow

**Environment Setup**: Always use Docker Compose for consistency:

```bash
docker compose up --build -d backend    # start backend + dependencies
docker compose logs backend --follow    # monitor logs
```

**API Testing Patterns**: **CRITICAL - Always use nginx proxy with valid browser User-Agent**:

```bash
# Prefer nginx proxy (port 80) for API testing
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" http://localhost:80/api/health

# Only use direct port 8000 to debug nginx configuration issues
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" http://localhost:8000/health

# Authentication example via nginx
curl -X POST http://localhost:80/api/auth/login \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**Database Access**: **Direct PostgreSQL access from development machine**:

```bash
# ALWAYS pipe to cat to avoid pager issues
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager | cat

# Query examples
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager -c "SELECT id, title FROM documents LIMIT 5;" | cat

# Never use docker exec for routine database queries
```

**Hot Reload**: FastAPI auto-reload enabled in development via volume mounts (`backend/app:/markdown_manager/app`). No container restart needed for code changes.

**Configuration**: Environment-based settings pattern:

- `backend/.env` → development overrides
- `app/configs/` → centralized configuration with Pydantic
- `EnvironmentConfig` → environment-specific database pools, CORS, logging

### � Document Management APIs - Core System Foundation

**Document Management is the cornerstone** - Deep understanding required for all development:

**Core Document Structure**:

```python
# Document model represents the primary entity
class Document(BaseModel):
    title: str           # User-facing document name
    content: str         # Markdown content
    folder_path: str     # Hierarchical organization "/folder/subfolder"
    user_id: int         # Owner relationship
    category_id: int     # Classification system
    is_public: bool      # Visibility control
```

**Essential API Patterns**:

```bash
# Document CRUD - Foundation operations
GET    /documents/                    # List user documents with filtering
POST   /documents/                    # Create new document
GET    /documents/{id}                # Retrieve single document
PUT    /documents/{id}                # Update document content/metadata
DELETE /documents/{id}                # Delete document
POST   /documents/{id}/clone          # Duplicate document

# Folder Management - Hierarchical organization
GET    /documents/folders/            # List folder structure
POST   /documents/folders/            # Create folder hierarchy
GET    /documents/folders/{path}      # Documents in specific folder
PUT    /documents/{id}/move           # Move document between folders

# Advanced Features
GET    /documents/{id}/history        # Version history
POST   /documents/{id}/export         # Export to various formats
GET    /documents/search?q={query}    # Full-text search
```

**Document Relationships - Critical Dependencies**:

- **Categories** → Classification system (`/categories/`)
- **GitHub Integration** → Sync with repositories (`/github/sync`)
- **PDF Generation** → Export functionality (`/pdf/generate`)
- **Icon Management** → Document metadata enrichment (`/icons/`)

**Testing Document APIs**:

```bash
# Create test document via nginx
curl -X POST http://localhost:80/api/documents/ \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "content": "# Test\nSample content",
    "folder_path": "/test-folder",
    "category_id": 1
  }'

# Query document structure
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager \
  -c "SELECT id, title, folder_path, user_id FROM documents ORDER BY created_at DESC LIMIT 10;" | cat
```

### �📋 API Design Conventions

**Endpoint Patterns**:

- RESTful resource routes → `GET /documents/{id}`, `POST /documents/{id}/clone`
- No trailing slashes required
- Health checks at service level → `/health` (comprehensive), `/monitoring/health` (detailed)

**Error Handling**: Structured responses via middleware:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Request validation failed",
    "request_id": "uuid",
    "details": [{"field": "email", "message": "Invalid format"}]
  }
}
```

**Schema Organization**: Pydantic v2 models in `schemas/` with inheritance patterns for CRUD operations.

### 🚀 Deployment & Production

**Build Process**: Multi-stage Docker build with Poetry dependency caching. Production uses systemd service management.

**Database Operations**:

```bash
make backup-db                          # JSON backup to backups/
make restore-db BACKUP_FILE=file.json   # restore from backup
```

**Monitoring**: Built-in performance monitoring with slow request detection, health checks across all services, structured logging with request correlation.

---

**AI Agents**: Follow these patterns for consistency. Use dependency injection, async patterns, and the established error handling. Always test via Docker Compose environment before production deployment. **Master the document management APIs first** - they are the foundation of the entire system.

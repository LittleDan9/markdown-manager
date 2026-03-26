---
description: "Use when working on the development environment: Docker Compose, local setup, dev tools, debugging, or project configuration."
applyTo: "docker-compose.yml,.env*,package.json,Makefile"
---
# AI Agent Development Environment Guidelines

## Markdown Manager Development Environment: Docker + Local Hybrid

This system uses a **hybrid development approach** combining Docker containers with local development tools for optimal developer experience.

### 🐳 Docker Compose - Core Development Environment

**CRITICAL**: Use Docker Compose for all services, never run services directly:

```bash
# Primary development commands
docker compose up --build -d backend    # Start backend + dependencies
docker compose up frontend              # Start frontend with HMR
docker compose logs backend --follow    # Monitor backend logs
docker compose logs frontend            # Check for HMR heap issues
docker compose restart frontend         # Restart if AI agents cause memory overflow
```

**Service Architecture**:
- `backend` → port 8000 (FastAPI with hot reload via volume mounts)
- `frontend` → **http://localhost/** (nginx proxy, NOT :3000)
- `db` (PostgreSQL) → port 5432 (accessible from host machine)
- `export` → port 8001 (PDF/diagram/Draw.io export with Playwright)
- `nginx` → port 80 (reverse proxy with `/api/*` routing)
- `redis` → port 6379 (event streams, caching)
- `embedding` → port 8002 (sentence-transformers vector embeddings)
- `spell-check` → port 3001 (Node.js, nspell/cspell/NLP analyzers)
- `linting` → port 3002 (Node.js, markdownlint wrapper)
- `event-publisher` → outbox relay (DB → Redis Streams)
- `event-consumer` → stream consumer (Redis Streams → DB projections)

**Shared Packages**:
- `packages/events-core/` → JSON Schema contracts + generated TS/Python types for domain events

**Hot Module Replacement (HMR)**:
- **Frontend**: Automatic via Docker volume mounts, HMR enabled by default
- **Backend**: FastAPI auto-reload via volume mounts (`backend/app:/markdown_manager/app`)
- **No container restarts needed** for code changes during development

### 🔧 Local Development Tools

**Backend Poetry (Local Machine Only)**:
```bash
# ALWAYS run from backend/ directory on development machine
cd backend/
poetry install                          # Install dependencies
poetry run alembic revision --autogenerate -m "description"
poetry run alembic upgrade head         # NEVER run migrations in containers
poetry run pytest                       # Run tests
poetry run pytest tests/unit/          # Unit tests only
```

**Database Access (Direct from Host)**:
```bash
# PostgreSQL connection details
Host: localhost
Port: 5432
Database: markdown_manager
User: postgres
Password: postgres

# Direct psql access - ALWAYS pipe to cat to avoid pager issues
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager | cat

# Query examples
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager -c "SELECT id, title FROM documents LIMIT 5;" | cat

# NEVER use docker exec for routine database queries
```

### 🌐 Frontend Development Patterns

**Development Server**:
```bash
# Frontend runs on nginx proxy (NOT development server port)
http://localhost/          # ✅ CORRECT - nginx routing
http://localhost:3000/     # ❌ WRONG - development server not exposed
```

**File Watching & HMR**:
- Webpack dev server runs inside container with HMR enabled
- Volume mounts provide real-time file watching
- Changes trigger automatic rebuilds
- Browser auto-refreshes on successful compilation

**Memory Management**:
- HMR can cause memory overflow with AI agents making rapid changes
- **Solution**: `docker compose restart frontend` to clear memory
- Monitor with `docker compose logs frontend`

### 🔍 API Testing & Development

**API Testing via nginx Proxy**:
```bash
# CRITICAL: Always use nginx proxy with valid browser User-Agent
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" http://localhost:80/api/health

# Only use direct port 8000 to debug nginx configuration issues
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" http://localhost:8000/health
```

**Authentication Testing**:
```bash
# Login to get JWT token (use dan@littledan.com for testing)
curl -X POST http://localhost:80/api/auth/login \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" \
  -H "Content-Type: application/json" \
  -d '{"email": "dan@littledan.com", "password": "YOUR_PASSWORD"}'

# Use token for authenticated requests
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:80/api/documents/
```

**CRITICAL - Token Management for AI Agents**:
- **Test account email**: `dan@littledan.com` (always use this for testing)
- **When you need a token**: Ask the user for an updated JWT token
- **Token expired/invalid**: Request a fresh token from the user
- **Never hardcode tokens**: Always ask for current valid token when testing authenticated endpoints

### 🗄️ Database Development Workflow

**Migration Workflow** (CRITICAL PATTERN):
```bash
# 1. Make model changes in backend/app/models/
# 2. Generate migration on LOCAL machine (NOT in container)
cd backend/
poetry run alembic revision --autogenerate -m "add new field"

# 3. Review generated migration file
# 4. Apply migration locally
poetry run alembic upgrade head

# 5. Commit migration files to git
git add migrations/versions/
git commit -m "Add migration: description"
```

**Database Operations**:
```bash
# Backup and restore (from project root)
make backup-db                          # JSON backup to backups/
make restore-db BACKUP_FILE=file.json   # restore from backup

# Check database state
PGPASSWORD=postgres psql -h localhost -U postgres -d markdown_manager -c "SELECT name FROM alembic_version;" | cat
```

### 📁 File System Development

**Storage Directory Structure**:
```bash
/storage/{user_id}/local/{category}/     # Local category git repositories
/storage/{user_id}/github/{account_id}/  # Cloned GitHub repositories
```

**Filesystem Debugging**:
```bash
# Scan for orphaned files
cd backend/
python scripts/scan_filesystem.py

# Check git status in category repos
cd /path/to/storage/{user_id}/local/{category}/
git status
```

### 🔧 Common Development Tasks

**Starting Development Environment**:
```bash
# 1. Start all services
docker compose up --build -d

# 2. Verify services are running
docker compose ps

# 3. Check logs for any issues
docker compose logs backend --follow &
docker compose logs frontend --follow &

# 4. Access application
open http://localhost/
```

**Making Backend Changes**:
```bash
# 1. Edit files in backend/app/
# 2. Changes auto-reload (no restart needed)
# 3. For model changes, run migration locally:
cd backend/
poetry run alembic revision --autogenerate -m "description"
poetry run alembic upgrade head
```

**Making Frontend Changes**:
```bash
# 1. Edit files in frontend/src/
# 2. HMR automatically rebuilds and refreshes browser
# 3. If memory issues occur:
docker compose restart frontend
```

### 🚨 Common Issues & Solutions

**Frontend Issues**:
1. **HMR memory overflow** → `docker compose restart frontend`
2. **Wrong URL** → Use `http://localhost/` not `:3000`
3. **Styles not updating** → Check SCSS compilation in logs

**Backend Issues**:
1. **Migration errors** → Run migrations locally with Poetry, not in containers
2. **Database connection** → Use direct psql, not docker exec
3. **Import errors** → Check volume mounts are correct

**Database Issues**:
1. **Connection refused** → Ensure PostgreSQL container is running
2. **Migration conflicts** → Check alembic history and resolve manually
3. **Orphaned files** → Use cleanup scripts in `backend/scripts/`

### 🎯 Development Best Practices

**File Organization**:
- Backend changes: Edit directly in `backend/app/`
- Frontend changes: Edit directly in `frontend/src/`
- Database schemas: Use Alembic migrations locally
- Never edit files inside containers

**Testing Strategy**:
- Backend tests: `cd backend/ && poetry run pytest`
- API testing: Use nginx proxy with proper User-Agent headers
- Database testing: Use direct psql connection
- Frontend testing: Use browser dev tools with HMR

**Git Workflow**:
- Commit migration files with descriptive messages
- Test locally before pushing
- Use feature branches for complex changes
- Include both frontend and backend changes in same PR when related

---

### Related Instructions
- `copilot-deployment.instructions.md` — Production deployment, Ansible, dual-layer nginx, SSH access, backup/restore, environment management

---

**AI Agents**: Master the hybrid Docker + local development pattern. Use containers for services, local tools for development tasks. Always use nginx proxy for API testing, run migrations locally with Poetry, and leverage HMR for rapid frontend development. The dual filesystem architecture requires understanding both Docker volume mounts and local file operations.
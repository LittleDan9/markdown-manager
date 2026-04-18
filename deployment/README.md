# Markdown Manager — Deployment

Production deployment using Ansible + Docker Compose with **blue/green zero-downtime deploys** via Traefik.

## Architecture

```
Development Machine → Ansible → SSH → Production Server (10.0.1.51)
                                ↓
             ┌─── Shared Infrastructure (platform-manager) ───┐
             │  Traefik  (port 8080, traffic switch)           │
             │  PostgreSQL  (pgvector, multi-database)         │
             │  Redis  (streams, cache)                        │
             │  Ollama  (LLM inference)                        │
             │  Embedding  (sentence-transformers, GHCR)       │
             │  ClamAV  (virus scanning)                       │
             └─────────────────────────────────────────────────┘
              Network: shared-services  │  Project: platform
             ┌─────────────────┼──────────────────┐
     ┌── mm-blue ──┐                    ┌── mm-green ──┐
     │  nginx       │  ← Traefik →      │  nginx        │
     │  backend     │  routes to         │  backend      │
     │  export      │  healthy stack     │  export       │
     │  linting     │                    │  linting      │
     │  spell-check │                    │  spell-check  │
     │  event-*     │                    │  event-*      │
     └──────────────┘                    └───────────────┘
             ↑                                    ↑
       Active (serving)              Standby (previous deploy)
```

### Dual-Layer Nginx

```
Internet (HTTPS:443)
  → Host nginx (TLS, security headers, rate limiting, bot blocking)
    → 127.0.0.1:8080
      → Traefik (blue/green health-aware routing)
        → Container nginx (path routing, SPA serving)
          → backend / export / linting / spell-check
```

Host nginx config is managed by the `nginx_host` Ansible role. Container nginx config is in `nginx/nginx-prod.conf`. Traefik is configured in the platform-manager repo (`deployment/traefik.yml`).

## Quick Start

### Prerequisites

- SSH access to production: `ssh -i ~/.ssh/id_danbian dlittle@10.0.1.51`
- `deployment/production.env` configured (see `deployment/production.env.template`)
- Shared infrastructure running via [platform-manager](https://github.com/LittleDan9/platform-manager)

### Deploy Commands

```bash
make deploy                # Full deploy (bootstrap + app + nginx)
make deploy-update         # App update only (blue/green swap — routine deploys)
make deploy-bootstrap      # First-time server setup (Docker, UFW, directories)
make deploy-nginx          # Update host nginx configuration only
make deploy-infra          # Deploy shared infrastructure (platform-manager)
make deploy-rollback       # Revert to previous blue/green slot
```

### Monitoring

```bash
make deploy-status         # Show active slot + container health (both stacks)
make deploy-logs           # Tail active slot container logs
make deploy-dry-run        # Ansible check mode (preview changes)
```

### Database

```bash
make deploy-db-migrate     # Run Alembic migrations in active backend
make deploy-db-backup      # pg_dump → local backups/ directory
```

## How Blue/Green Deployment Works

1. **`make deploy-update`** runs Ansible which rsyncs source and calls `scripts/deploy-blue-green.sh`
2. Script reads `.deploy-slot` (e.g., "blue") and computes next slot ("green")
3. Builds images for the new slot
4. Starts new stack: `docker compose -p mm-green -f docker-compose.app.yml up -d`
5. Waits for backend health check to pass
6. Traefik automatically discovers the new stack's nginx via Docker labels and routes traffic
7. Stops old stack with 30s grace period: `docker compose -p mm-blue down --timeout 30`
8. Backend sends `{"type": "maintenance"}` to WebSocket clients during shutdown (collab + presence)
9. Frontend shows transient toast; auto-reconnect connects to new stack via Traefik
10. Cleans up old UI volume and dangling images

**Result**: Zero 502 errors during deploy. Users with active WebSocket connections see a brief "Server updating" toast and auto-reconnect within seconds.

### Rollback

```bash
make deploy-rollback
```

Re-starts the previous slot's containers (images are still cached) and Traefik switches back.

### Migration Compatibility

Since both old and new backends briefly serve traffic simultaneously, **Alembic migrations must be backward-compatible**:
- Add nullable columns, new tables → OK
- Rename/drop columns or tables → requires two-phase expand/contract across deploys

Migrations run automatically inside the backend `entrypoint.sh` (with exponential backoff retries) before uvicorn starts.

## File Structure

```
docker-compose.app.yml         # Application: backend, nginx, export, linting, etc.
deployment/
├── deploy.yml                 # Main Ansible playbook (3 roles)
├── config.yml                 # Shared variables (app_dir, compose files)
├── inventory.yml              # Target host (10.0.1.51)
├── production.env             # Production secrets (gitignored)
├── production.env.template    # Variable reference
├── ansible.cfg                # Ansible settings
└── roles/
    ├── bootstrap/             # Docker install, UFW, directory creation
    ├── app_deploy/            # rsync → infra check → blue/green deploy
    └── nginx_host/            # Host nginx: TLS, security, rate limiting
scripts/
├── deploy-blue-green.sh       # Blue/green orchestration
└── colors.sh                  # Terminal color definitions
```

### Deprecated files (kept for reference)

```
docker-compose.infra.yml       # DEPRECATED — infra moved to platform-manager
docker-compose.prod.yml        # DEPRECATED — replaced by docker-compose.app.yml
deployment/traefik.yml         # DEPRECATED — moved to platform-manager
scripts/deploy-infra.sh        # DEPRECATED — replaced by platform-manager
```

## Shared Infrastructure (platform-manager)

Infrastructure runs in a separate repo under the Docker project name `platform`. See [platform-manager](https://github.com/LittleDan9/platform-manager).

| Service | Image | Purpose |
|---------|-------|---------|
| traefik | traefik:v3.4 | Blue/green traffic routing (port 8080) |
| db | pgvector/pgvector:pg18 | PostgreSQL with vector extensions (multi-database) |
| redis | redis:7-alpine | Event streams + cache |
| ollama | ollama/ollama:latest | LLM inference |
| embedding | ghcr.io/littledan9/embedding-service | Sentence-transformers inference |
| clamav | clamav/clamav:stable | Virus scanning |

Shared network: `shared-services` (bridge, external). Shared volumes: `shared-postgres-data`, `shared-redis-data`, `shared-ollama-data`, `shared-clamav-data`, `shared-document-storage`.

DB credentials in this app’s `production.env` (`MM_DB_USER`/`MM_DB_PASSWORD`/`MM_DB_NAME`) are provisioned once by `platform-manager`’s `make provision-db DB=markdown_manager` and owned by this app.

## Application Stack (mm-blue / mm-green)

Alternates between project names. Each gets its own UI static volume.

| Service | Build Context | Purpose |
|---------|---------------|---------|
| nginx | nginx:alpine | Container-level routing + static serving |
| frontend-build | services/ui | One-shot React build → UI volume |
| backend | services/backend | FastAPI main API |
| export | services/export | PDF/SVG/PNG via Playwright |
| linting | services/linting | markdownlint HTTP service |
| spell-check | services/spell-check | cspell/retext HTTP service |
| event-publisher | services/event-publisher | Outbox relay (Postgres → Redis) |
| linting-consumer | services/event-consumer | Linting event processing |
| spell-check-consumer | services/event-consumer | Spell-check event processing |

## Troubleshooting

```bash
# SSH to production
ssh -i ~/.ssh/id_danbian dlittle@10.0.1.51
cd /opt/markdown-manager

# Check active slot
cat .deploy-slot

# Shared infrastructure status
docker compose -p platform ps

# Active app status
SLOT=$(cat .deploy-slot)
docker compose -p mm-$SLOT -f docker-compose.app.yml ps

# Backend logs
docker compose -p mm-$SLOT -f docker-compose.app.yml logs backend --tail=100

# Traefik dashboard (internal)
curl http://localhost:8888/api/http/services | jq .

# Manual health check
curl http://localhost:8080/api/health

# Force rebuild
./scripts/deploy-blue-green.sh --force-rebuild
```

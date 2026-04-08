---
description: "Use when working on production deployment, Ansible playbooks, nginx configuration (host or container), Docker Compose production topology, environment files, SSH access, backup/restore, Makefile deploy targets, blue/green deployment, Traefik configuration, or production troubleshooting."
applyTo: "deployment/**,docker-compose.prod.yml,docker-compose.infra.yml,docker-compose.app.yml,nginx/**,Makefile,scripts/backup-db.sh,scripts/restore-db.sh,scripts/build.sh,scripts/clean.sh,scripts/docker-cleanup.sh,scripts/deploy-blue-green.sh,scripts/deploy-infra.sh,scripts/setup-ansible.sh,scripts/setup-production-env.sh,scripts/setup.sh,roadmap/deployment-modernization/**,roadmap/remote-server/**"
---

# Production Deployment & Operations

## Deployment Architecture Overview

Production deployment uses **Ansible-driven Docker Compose** on a single remote host with **blue/green zero-downtime deploys** via Traefik. The pipeline: local machine runs Ansible → rsyncs source to remote → ensures infrastructure stack → runs blue/green swap → health check.

### Key Infrastructure Facts

- **Remote host**: `10.0.1.51` (configurable in `deployment/inventory.yml`)
- **SSH user**: `dlittle`, key `~/.ssh/id_danbian`
- **App directory**: `/opt/markdown-manager` on remote
- **Infrastructure compose**: `docker-compose.infra.yml` (project `mm-infra`)
- **Application compose**: `docker-compose.app.yml` (project `mm-blue` or `mm-green`)
- **Legacy compose**: `docker-compose.prod.yml` (monolithic fallback, deprecated)
- **Environment file**: `deployment/production.env` (local, copied to remote)
- **Active slot file**: `.deploy-slot` on remote (contains "blue" or "green")

## Ansible Playbook Structure

### Active Playbooks & Configs

| File | Purpose |
|------|---------|
| `deployment/deploy.yml` | Main deployment playbook (3 roles) |
| `deployment/config.yml` | Shared variables (app_dir, compose file, domain) |
| `deployment/inventory.yml` | Host connection details |
| `deployment/status.yml` | Health/status checking playbook |
| `deployment/ansible.cfg` | Ansible config (roles path, SSH settings) |
| `deployment/group_vars/production.yml` | Production group variables |

### Three Active Roles

1. **`bootstrap`** — Host preparation: Docker install, UFW firewall, directory creation
2. **`app_deploy`** — Core deployment: rsync source → ensure infra running → blue/green deploy via `deploy-blue-green.sh` → health check
3. **`nginx_host`** — Host-level nginx: TLS termination, security headers, reverse proxy to Traefik on port 8080

### Deployment Flow (app_deploy role)

```
rsync project to /opt/markdown-manager (with excludes)
→ copy production.env to remote
→ ensure infrastructure stack running (deploy-infra.sh)
→ wait for database health
→ run blue/green deployment (deploy-blue-green.sh):
  → determine new slot (blue→green or green→blue)
  → build images for new slot
  → clean new slot's UI volume
  → start new slot: docker compose -p mm-{slot} up -d
  → wait for backend health (/health endpoint)
  → Traefik auto-discovers new stack via Docker labels
  → stop old slot with 30s grace period (maintenance broadcast to WS clients)
  → cleanup: docker system prune + image prune
→ health check via localhost:8080/api/health
```

**Migrations** run automatically inside the backend `entrypoint.sh` (with exponential backoff retries) before uvicorn starts. They must be **backward-compatible** (additive only) since both old and new backends briefly coexist during blue/green transition.

**Graceful shutdown**: On `docker compose down --timeout 30`, the backend lifespan handler sends `{"type": "maintenance", "retry_seconds": 5}` to all WebSocket clients (presence + collab), then stops background services. Frontend auto-reconnects to the new stack via Traefik.

**Important**: The `mm-ui-static` volume is per-project (e.g., `mm-blue_ui-static`). Each app stack has its own volume, cleaned before each deploy. The `frontend-build` container's CMD also cleans before copying as defense-in-depth.

### Legacy Files (DO NOT USE for current deployments)

- `deployment/deploy-legacy.yml` — Old per-service systemd deployment
- `deployment/config-legacy.yml` — Old variable definitions
- `nginx/sites-available/littledan.com.conf` — Stale, replaced by Ansible template
- Legacy roles under `deployment/roles/` (docker_service, registry, ui_deployment, etc.) — Not referenced by current `deploy.yml`

## Three-Layer Proxy Architecture

Production uses **three proxy layers** in series (all local hops, microsecond overhead):

```
Internet (HTTPS:443)
  → Host nginx (TLS termination, security, rate limiting)
    → 127.0.0.1:8080
      → Traefik (blue/green health-aware routing)
        → Container nginx (path routing, upstream resolution, SPA serving)
          → backend / export / linting / spell-check containers
```

### Host Nginx (Ansible-managed)

- **Template**: `deployment/roles/nginx_host/templates/littledan.com.conf.j2`
- TLS termination via certbot
- Security headers: CSP, HSTS, X-Frame-Options
- Bot blocking and query string filtering
- Connection and request rate limiting
- Sensitive file/path blocking

### Traefik (Infrastructure stack)

- **Config**: `deployment/traefik.yml`
- Listens on port 80 inside infra stack (mapped to host 8080)
- Docker provider discovers container nginx via labels (`traefik.enable=true`)
- Health-checks container nginx every 5s
- Automatically routes to whichever blue/green stack is healthy
- Dashboard available on port 8888 (internal only)

### Container Nginx (in App stack)

- **Config**: `nginx/nginx-prod.conf`
- Path-based routing (`/api/*` → backend, `/export/*` → export, etc.)
- Docker DNS resolver (`127.0.0.11`) for upstream service names
- Per-endpoint timeout and buffering tuning
- Static UI asset serving with SPA fallback
- Dev equivalent: `nginx/nginx-dev.conf` (single-layer, localhost only)

### Key Difference from Dev

- **Dev**: Single nginx in compose, services expose host ports directly
- **Prod**: Only Traefik publishes a port externally (`8080:80`), all other services are internal-only on the `mm-network` bridge

## Docker Compose Production Topology

### Compose File Split

| File | Project Name | Purpose |
|------|-------------|---------|
| `docker-compose.infra.yml` | `mm-infra` | Infrastructure: db, redis, ollama, clamav, traefik |
| `docker-compose.app.yml` | `mm-blue` / `mm-green` | Application: backend, nginx, export, linting, etc. |
| `docker-compose.prod.yml` | — | Legacy monolithic (deprecated, kept as fallback) |

### Network

- Shared bridge network: `mm-network` (external, created by `deploy-infra.sh`)
- Only Traefik publishes a port externally (`8080:80`)
- Services reference each other by compose service name across project boundaries

### Named Volumes

| Volume | Scope | Purpose |
|--------|-------|---------|
| `mm-postgres-data` | infra | PostgreSQL data persistence |
| `mm-redis-data` | infra | Redis AOF + RDB persistence |
| `mm-document-storage` | shared (external) | Markdown document files |
| `mm-ollama-data` | infra | Ollama LLM model storage |
| `mm-clamav-data` | infra | ClamAV signature data |
| `mm-{blue\|green}_ui-static` | per-app-project | Built frontend assets |

### Service Dependencies (health-check chain)

**Infrastructure** (always running):
```
db (healthy) + redis (healthy) + traefik (healthy) + ollama + clamav
```

**Application** (blue or green):
```
export + linting + spell-check + embedding (all healthy)
  → backend (healthy, also waits for db TCP in entrypoint.sh)
    → nginx (also waits for frontend-build completed)
      → event-publisher
        → event consumers
```

`frontend-build` is a one-shot build container that populates `mm-ui-static` then exits.

## Environment Variable Management

### Source of Truth

- **Template**: `deployment/production.env.template` — all expected variables with descriptions
- **Actual**: `deployment/production.env` — real values (gitignored, never committed)
- **Dev baseline**: `.env.example` in project root

### Compose Interpolation Patterns

```yaml
# Default value (safe fallback)
${POSTGRES_USER:-markdown_manager}

# Required value (fails if missing)
${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
```

- Backend loads `env_file: deployment/production.env` plus computed internal URLs
- Other services use compose-level `environment:` blocks with interpolation

### Sensitive Variables

Never commit: database passwords, JWT secrets, OAuth client secrets, encryption keys. These live only in `deployment/production.env` on the local machine and are rsynced to remote.

## Makefile Deploy Targets

Key targets in the root `Makefile`:

| Target | Action |
|--------|--------|
| `make deploy` | Full deployment (sync-locks → Ansible deploy playbook) |
| `make deploy-update` | App update only — blue/green swap (routine deploys) |
| `make deploy-nginx` | Update host nginx config only (runs `--tags nginx` with diff) |
| `make deploy-infra` | Update infrastructure stack only (db, redis, traefik) |
| `make deploy-rollback` | Revert to previous blue/green slot |
| `make deploy-status` | Show active slot + container health for both stacks |
| `make deploy-logs` | Tail active slot container logs |
| `make deploy-db-backup` | Remote pg_dump → local `backups/` directory |
| `make sync-locks` | Sync npm/poetry lock files before deploy |
| `make setup-ansible` | Install Ansible and dependencies |

## Backup & Restore

### Database Backup

```bash
# Preferred: Makefile target (remote pg_dump → local SQL file)
make deploy-db-backup

# Alternative: JSON table export over forwarded DB connection
scripts/backup-db.sh
```

Backups saved to `backups/` directory with timestamps.

### Database Restore

```bash
# DESTRUCTIVE: drops schema, rebuilds via alembic, restores tables in dependency order
scripts/restore-db.sh
```

Restore script handles table dependency ordering and sequence repair.

## Production Troubleshooting

### SSH Access

```bash
# Direct SSH to production
ssh -i ~/.ssh/id_danbian dlittle@10.0.1.51

# On remote, app is at:
cd /opt/markdown-manager
```

### Common Operations on Remote

```bash
# Check running containers
docker compose -f docker-compose.prod.yml ps

# View service logs
docker compose -f docker-compose.prod.yml logs backend --tail=100 -f
docker compose -f docker-compose.prod.yml logs nginx --tail=50

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Run migrations manually
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Check nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Check host nginx
sudo nginx -t && sudo systemctl reload nginx
```

### Health Check Endpoints

- Container-level: `http://localhost:8080/api/health` (through container nginx)
- Backend direct: `http://localhost:8000/api/health` (if port forwarded)

### Status Playbook

```bash
# Run from local machine
make deploy-status
# Or directly:
ansible-playbook -i deployment/inventory.yml deployment/status.yml
```

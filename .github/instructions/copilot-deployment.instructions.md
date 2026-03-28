---
description: "Use when working on production deployment, Ansible playbooks, nginx configuration (host or container), Docker Compose production topology, environment files, SSH access, backup/restore, Makefile deploy targets, or production troubleshooting."
applyTo: "deployment/**,docker-compose.prod.yml,nginx/**,Makefile,scripts/backup-db.sh,scripts/restore-db.sh,scripts/build.sh,scripts/clean.sh,scripts/docker-cleanup.sh,scripts/setup-ansible.sh,scripts/setup-production-env.sh,scripts/setup.sh,roadmap/deployment-modernization/**,roadmap/remote-server/**"
---

# Production Deployment & Operations

## Deployment Architecture Overview

Production deployment uses **Ansible-driven Docker Compose** on a single remote host. The pipeline: local machine runs Ansible → rsyncs source to remote → builds/starts containers → runs migrations → configures host nginx.

### Key Infrastructure Facts

- **Remote host**: `10.0.1.51` (configurable in `deployment/inventory.yml`)
- **SSH user**: `dlittle`, key `~/.ssh/id_danbian`
- **App directory**: `/opt/markdown-manager` on remote
- **Production compose file**: `docker-compose.prod.yml`
- **Environment file**: `deployment/production.env` (local, copied to remote)

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
2. **`app_deploy`** — Core deployment: rsync source → compose build/up → DB migrations → health check
3. **`nginx_host`** — Host-level nginx: TLS termination, security headers, reverse proxy to container nginx

### Deployment Flow (app_deploy role)

```
rsync project to /opt/markdown-manager (with excludes)
→ copy production.env to remote
→ docker compose -f docker-compose.prod.yml build
→ clean stale files from mm-ui-static volume
→ docker compose -f docker-compose.prod.yml up -d
→ restart nginx container (pick up new UI assets + DNS refresh)
→ alembic upgrade head (inside backend container)
→ health check via localhost:8080/api/health
→ docker system prune
```

**Important**: The `mm-ui-static` volume is cleaned before each deploy to prevent stale content-hashed bundles from accumulating. The `frontend-build` container's CMD also cleans before copying as defense-in-depth.

### Legacy Files (DO NOT USE for current deployments)

- `deployment/deploy-legacy.yml` — Old per-service systemd deployment
- `deployment/config-legacy.yml` — Old variable definitions
- `nginx/sites-available/littledan.com.conf` — Stale, replaced by Ansible template
- Legacy roles under `deployment/roles/` (docker_service, registry, ui_deployment, etc.) — Not referenced by current `deploy.yml`

## Dual-Layer Nginx Architecture

Production uses **two nginx instances** in series:

```
Internet (HTTPS:443)
  → Host nginx (TLS termination, security, rate limiting)
    → 127.0.0.1:8080
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

### Container Nginx (in Docker Compose)

- **Config**: `nginx/nginx-prod.conf`
- Path-based routing (`/api/*` → backend, `/export/*` → export, etc.)
- Docker DNS resolver (`127.0.0.11`) for upstream service names
- Per-endpoint timeout and buffering tuning
- Static UI asset serving with SPA fallback
- Dev equivalent: `nginx/nginx-dev.conf` (single-layer, localhost only)

### Key Difference from Dev

- **Dev**: Single nginx in compose, services expose host ports directly
- **Prod**: Only nginx exposes port `8080:80`, all other services are internal-only on the `markdown-manager` bridge network

## Docker Compose Production Topology

### Network

- Single named bridge network: `markdown-manager`
- Only `nginx` publishes a port externally (`8080:80`)
- Services reference each other by compose service name (e.g., `backend`, `db`, `redis`)

### Named Volumes

| Volume | Purpose |
|--------|---------|
| `mm-postgres-data` | PostgreSQL data persistence |
| `mm-redis-data` | Redis AOF + RDB persistence |
| `mm-document-storage` | Markdown document files |
| `mm-ui-static` | Built frontend assets (shared nginx → frontend-build) |
| `mm-ollama-data` | Ollama LLM model storage |

### Service Dependencies (health-check chain)

```
db (healthy) + redis (healthy) + export + linting + spell-check + embedding
  → backend (healthy)
    → nginx, event-publisher
      → event-consumer
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
| `make deploy-update` | Quick update deployment |
| `make deploy-nginx` | Update host nginx config only (runs `--tags nginx` with diff) |
| `make deploy-status` | Check remote service health |
| `make deploy-logs` | Tail remote container logs |
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

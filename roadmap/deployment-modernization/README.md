# Deployment Modernization Plan

## Overview

Replace the current complex deployment model (per-service systemd units, local Docker registry with SSH tunnel, source-hash tracking, 8 Ansible roles) with a **production Docker Compose file** that defines the entire stack and a **simplified Ansible playbook** that bootstraps Docker on fresh Debian and runs `docker compose up`.

Host nginx stays (it serves other domains) but proxy-passes to the containerized app stack.

## Current State (Problems)

- **9 Ansible roles** with significant shell logic embedded in tasks
- **Per-service systemd units** generated from templates — each service is its own systemd service
- **Local Docker registry** with SSH tunnel for image transfer (fragile, complex)
- **Source-hash tracking** to detect changes — custom build/push/pull per service
- **Mixed concerns**: Ansible manages systemd, Docker, nginx, Redis, cleanup, legacy artifacts
- **Consumer deploy broken**: `consumer_config` keys missing from `config.yml`, consumer tasks silently skip
- **Tag/name mismatches**: Makefile `deploy-lint` uses tag `lint` but playbook uses `linting`
- **Legacy artifacts**: old monolith service references, backup scripts pointing to deprecated paths
- **PostgreSQL runs as host service** — separate lifecycle from app, harder to reproduce
- **UI deployed via rsync** of static build — different mechanism from all other services

## Proposed Architecture

```
Host nginx (existing, serves multiple domains)
  └── proxy_pass :8080 → Container nginx (in compose)
        ├── /api/         → backend:8000
        ├── /api/export/  → export:8001
        ├── /api/lint/    → linting:8002
        ├── /api/spell/   → spell-check:8003
        └── /             → UI static files (built in compose)

Docker Compose prod stack (all-in-one):
  ├── nginx (app-level reverse proxy, port 8080)
  ├── backend (FastAPI)
  ├── db (PostgreSQL 16, persistent volume)
  ├── redis (streams + cache)
  ├── export (Playwright PDF/SVG)
  ├── linting (markdownlint)
  ├── spell-check (cspell/retext)
  ├── event-publisher (outbox relay)
  ├── linting-consumer
  └── spell-check-consumer
```

## Phases

### Phase 1: Production Docker Compose

- [x] `docker-compose.prod.yml` — all services with production settings
- [x] `nginx/nginx-prod.conf` — container-level reverse proxy + static UI serving
- [x] `services/ui/Dockerfile` — multi-stage build (Node build → nginx serve)
- [x] `deployment/production.env.template` — env var template
- [x] `.gitignore` updated for `deployment/production.env`

### Phase 2: Simplified Ansible (9 roles → 3)

- [x] `deployment/roles/bootstrap/` — Docker CE, UFW, app dirs (replaces infrastructure, registry, sudoers_fix)
- [x] `deployment/roles/app_deploy/` — rsync + compose build/up + migrations (replaces docker_service, redis, ui_deployment, cleanup)
- [x] `deployment/roles/nginx_host/` — host nginx proxy config (replaces nginx_config)
- [x] `deployment/deploy.yml` rewritten
- [x] `deployment/config.yml` simplified
- [x] `deployment/inventory.yml` parameterized

### Phase 3: Simplified Makefile

- [x] Reduced to ~8 deployment targets from ~15
- [x] `HOST=` variable support for configurable target

### Phase 4: Database Migration Path

- [x] `scripts/migrate-db-to-container.sh` — pg_dump from host, restore in container
- [x] Backup/restore scripts for containerized DB

### Phase 5: Cleanup & Documentation

- [ ] Remove deprecated scripts and old Ansible roles
- [ ] Update `docs/deployment/README.md`
- [ ] Optional: GitHub Actions CI

## Key Decisions

| Decision | Rationale |
|---|---|
| Docker Compose over K3s | Right tool for single-node, 6-10 services. K3s adds complexity without proportional benefit. |
| Build on server, not locally | Both are x86_64, avoids registry entirely. Add buildx/CI if cross-arch becomes real. |
| Host nginx stays | Serves multiple domains. Container nginx handles app routing on :8080. |
| PostgreSQL containerized | Simplifies deployment, but requires one-time data migration. |
| `.env` for secrets | Simpler than Ansible Vault. Rsynced with restricted permissions, not in git. |

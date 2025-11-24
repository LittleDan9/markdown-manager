# Phase 8 — Production (systemd) Hand-off (Agent Scope)

## Goal
Run containers under systemd with persistence.

## Units (examples)
- `redis.service` → runs `docker run redis:7 --appendonly yes` with `/var/lib/redis-data` volume.
- `identity-relay.service` → runs relay container with env for outbox + bus.
- `linting-worker.service` / `spell-worker.service` → consumer containers.
- `nginx.service`, `backend.service`, `spell.service`, `linting.service`.

## Logging
- Journald capture; optional `docker logs` passthrough to files under `/var/log/<svc>/`.
- Rotate AOF and ensure disk alerts.

## Persistence
- Mounts:
  - `/var/lib/redis-data` → Redis
  - `/var/lib/postgres-data` → Postgres (if local)
  - App-specific caches if any

## Exit Criteria
- All units start on boot, restart on failure, and have health verifications.

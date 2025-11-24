# Phase 1 — Architecture Inventory (Agent Scope)

## Goal
Produce a precise map of domains, dependencies, and data ownership to guide subsequent extraction. No code changes; documentation and code annotations only.

## Inputs
- Current codebase (FastAPI backend, Node services).
- Existing Postgres schema(s).
- Nginx config + docker-compose.

## Deliverables
1. `docs/refactor/artifacts/domain-map.md`
   - Bounded contexts: **identity**, **linting**, **spell-check**, **export**, **projects/files** (if any).
   - Tables per context; which service owns each table.
   - Endpoints per service and their consumers.
2. `docs/refactor/artifacts/service-deps.md`
   - Which services call which endpoints.
   - Current “backend” proxying patterns.
3. `docs/refactor/artifacts/backend-slimming-opportunities.md`
   - Calls that should become event-driven or local reads.
   - Specific “backend-as-context-broker” responsibilities to split out.

## Method
- Scan FastAPI routes: group by domain (`/api/users`, `/api/prefs`, `/api/lint`, `/api/spell`, `/api/export`).
- Scan SQLAlchemy models: propose target schema per service.
- Identify “DB-dependent” vs “DB-independent” microservices routed by Nginx.

## Exit Criteria
- Each table has a **single owner**.
- Cross-service dependencies identified and tagged as:
  - **Evented** (Redis) or **API** (direct HTTP) or **Filesystem** (shared docs).

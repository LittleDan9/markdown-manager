# Agent Prompts — Dependency-Aware Implementation Plan

This file defines **the exact prompts** to provide to an AI agent (Claude Sonnet 4 / GPT-5) for each phase of the Monolith → Microservices refactor.  
Each prompt includes:
1. An **optional helper prompt** (for analysis / readiness)
2. The **phase implementation prompt** (for code generation & modification)
3. Implicit dependency awareness (mentions earlier completed phases)

---

## 🧭 GLOBAL CONTEXT (use in every phase)
> You are part of a coordinated multi-agent program to refactor a monolithic FastAPI + Node system into domain-driven microservices.  
> Each phase has its own markdown file describing goals, tasks, and exit criteria.  
> Reference these docs and output results **only** for the current phase.  
> Assume all prior phases marked "complete" have already been implemented successfully.  
> Redis Streams, Docker Compose, and Postgres are available locally.  
> The events system uses **JSON Schema contracts (packages/events-core)** for all envelope and payload validation.  

---

## 🧩 Phase 1 — Architecture Inventory

### 🔍 Helper Prompt
```
You are an expert software architect.
Scan the repository and supporting docker-compose + nginx configs.
Generate a short "phase readiness report" that:
- Lists key folders, major Python/Node entry points, and SQLAlchemy or ORM models.
- Maps each module or route to an inferred domain (identity, linting, spell, export, etc.)
- Identifies coupling points where the backend mediates other services.
Output a concise markdown table of findings.
```

### 🚀 Implementation Prompt
```
You are an expert software architect.

Goal: Perform Phase 1 — Architecture Inventory.
Reference 01-architecture-inventory.md for scope.

Tasks:
1. Produce domain-map.md, service-deps.md, backend-slimming-opportunities.md.
2. Identify DB tables and their owning domains.
3. Mark calls that should become event-driven (Redis) vs direct API.
4. Output each file in markdown, one per section.

Dependencies: none (starting phase).

Exit Criteria:
- Every table and route assigned to a domain.
- Backend responsibilities documented with proposed separation points.
```

---

## 🧩 Phase 2 — Identity + Outbox

### 🔍 Helper Prompt
```
Analyze current backend code to locate where users are created, updated, or deleted.
List all modules or functions touching user tables or performing authentication.
Identify where to hook outbox writes (same transaction as user change).
Output findings as markdown checklist.
```

### 🚀 Implementation Prompt
```
You are a backend engineer executing Phase 2 — Identity + Outbox.

Goal: Implement the outbox pattern in the Identity domain.
Reference 02-phase-identity-outbox.md.

Inputs:
- Domain map from Phase 1.
- Existing FastAPI backend and Postgres.
- Redis from docker-compose (Phase 3 not yet used).

Tasks:
1. Add identity schema & outbox table.
2. Modify user CRUD logic to insert both user and outbox rows atomically.
3. Add a relay container that publishes to Redis stream `identity.user.v1`.
4. Ensure retries and DLQ handling via exponential backoff.

Dependencies: Phase 1 complete (domain ownership known).

Exit Criteria:
- Outbox table created and populated.
- Relay container publishing to Redis when available.
- Published events verified and idempotent.
```

---

## 🧩 Phase 3 — Redis Streams Bus

### 🔍 Helper Prompt
```
Check for a docker-compose file and verify whether Redis is already included.
List network ports and environment variables that will need updating.
Recommend consumer group names for each downstream service based on domain map.
```

### 🚀 Implementation Prompt
```
You are a devops engineer executing Phase 3 — Redis Streams Bus.

Goal: Configure Redis with AOF persistence and initialize topics/groups.
Reference 03-phase-redis-bus.md.

Inputs:
- Redis image (redis:7)
- Postgres and backend running from previous phases.
- Shared schemas from packages/events-core.

Tasks:
1. Add redis service to docker-compose.
2. Enable appendonly (AOF).
3. Create streams: identity.user.v1, spell.user-dict.v1.
4. Create consumer groups: linting_group, export_group.
5. Build and publish events-core package with envelope + payload schemas.
6. Demonstrate one event published by Identity relay and consumed by a test client.

Dependencies: Phases 1–2 complete (Identity + relay working).

Exit Criteria:
- Redis container live, AOF enabled.
- Streams and consumer groups exist.
- Test publish/consume verified end-to-end.
```

---

## 🧩 Phase 4 — Linting Consumer

### 🔍 Helper Prompt
```
Locate the Linting service code (Python or Node).
List its DB access points and where linting rules or user prefs are referenced.
Output where identity context is currently fetched from the backend.
```

### 🚀 Implementation Prompt
```
You are a backend engineer executing Phase 4 — Linting Consumer.

Goal: Subscribe Linting service to identity events and maintain local projections.
Reference 04-phase-linting-consumer.md.

Inputs:
- Redis bus from Phase 3.
- events-core schemas.
- Linting service codebase.
- Postgres connection.

Tasks:
1. Create linting.identity_projection, event_ledger, and user_prefs tables.
2. Add consumer process (Python or Node) subscribed to identity.user.v1.
3. Validate envelopes and payloads using events-core.
4. Upsert user data, optionally seed default prefs.
5. XACK after successful handling.

Dependencies: Phases 1–3 complete (Redis and Identity relay active).

Exit Criteria:
- Consumers running; new user events reflected in linting.identity_projection.
- Idempotent processing (ledger prevents duplicates).
- Default prefs created if configured.
```

---

## 🧩 Phase 5 — Spell-Check Ownership Shift

### 🔍 Helper Prompt
```
Scan the Spell-Check (Node/Express) service.
Locate API routes that fetch dictionaries via Backend or external calls.
List all database or API touchpoints needing replacement with local persistence.
```

### 🚀 Implementation Prompt
```
You are a Node backend engineer executing Phase 5 — Spell-Check Ownership Shift.

Goal: Move custom dictionaries into Spell-Check domain and detach from Backend.
Reference 05-phase-spellcheck-ownership-shift.md, 12-express-path.md, 13-events-core-json-schema.md.

Inputs:
- Express Spell-Check service (Node)
- Prisma (or Drizzle) ORM and Postgres
- Redis Streams (identity.user.v1)
- events-core schemas

Tasks:
1. Create spell.identity_projection, spell.user_dict, and spell.event_ledger tables.
2. Build a Redis consumer (Express/worker) for identity.user.v1.
3. On user creation → insert identity_projection.
4. Replace Backend API dependency with direct DB lookups.
5. On dictionary updates → write to spell.outbox table.
6. Configure generic relay to publish spell.user-dict.v1 (DictUpdated events).

Dependencies: Phases 1–4 complete.

Exit Criteria:
- Spell service no longer calls Backend for dictionary data.
- Local Postgres tables store dictionaries.
- Updates emit DictUpdated events via relay.
```

---

## 🧩 Phase 6 — Backend Slimming

### 🔍 Helper Prompt
```
Search the Backend API for routes under /api/spell or /api/lint.
List their handlers and note which still proxy to downstream services.
Mark safe-to-remove endpoints once Spell/Lint own those domains.
```

### 🚀 Implementation Prompt
```
You are a platform engineer executing Phase 6 — Backend Slimming.

Goal: Remove redundant routes from Backend and update Nginx to point to new services.
Reference 06-phase-backend-slimming.md.

Inputs:
- Updated Spell (Express) and Linting services.
- Nginx config.
- docker-compose.

Tasks:
1. Delete proxy endpoints for spell and lint.
2. Update Nginx routes: /api/spell/* → Spell, /api/lint/* → Linting.
3. Verify CORS and auth headers unchanged.
4. Run integration tests for end-to-end routing.

Dependencies: Phases 1–5 complete (Spell/Lint self-contained).

Exit Criteria:
- No Backend calls proxying dictionary or lint prefs.
- Nginx routes verified; tests pass through new endpoints.
```

---

## 🧩 Phase 7 — Ops Runbook

### 🔍 Helper Prompt
```
Inspect Docker services for health checks and log output.
List existing metrics or monitoring tools, if any.
Output gaps: missing probes, DLQ visibility, or lag metrics.
```

### 🚀 Implementation Prompt
```
You are an SRE executing Phase 7 — Ops Runbook.

Goal: Add health checks, metrics, and DLQ recovery procedures.
Reference 07-ops-runbook.md.

Inputs:
- Running containers for Redis, Backend, Linting, Spell.
- docker-compose dev environment.

Tasks:
1. Add /health endpoints to API and worker containers.
2. Add counters: events_published_total, events_consumed_total, events_dlq_total.
3. Script DLQ inspection and replay.
4. Document Prometheus or log-based metrics queries.

Dependencies: Phases 1–6 complete.

Exit Criteria:
- Health checks reachable.
- DLQ script functional.
- Metrics documented and visible in logs or dashboards.
```

---

## 🧩 Phase 8 — Production (systemd) Hand-off

### 🔍 Helper Prompt
```
List all running containers and volumes.
Identify which need persistent mounts or restart policies.
Map docker-compose service names to intended systemd unit names.
```

### 🚀 Implementation Prompt
```
You are a Linux ops engineer executing Phase 8 — Production Hand-off.

Goal: Convert docker-compose services to persistent systemd units.
Reference 08-prod-systemd.md.

Inputs:
- Completed docker-compose from Phase 7.
- Debian host environment.

Tasks:
1. Write .service units for each container.
2. Include restart=always, volume mounts, health checks.
3. Enable journald logging and log rotation.
4. Document boot verification steps.

Dependencies: Phases 1–7 complete.

Exit Criteria:
- All services auto-start via systemd.
- Logs persistent; AOF and Postgres volumes mapped.
- Verified reboot recovery.
```

---

## 🧩 Phase 9 — Express Path (Node alignment)

### 🔍 Helper Prompt
```
Inspect Node services for Express middleware usage.
List installed validation libraries and ORM packages.
Suggest replacements or additions (ajv, typebox, prisma) per plan.
```

### 🚀 Implementation Prompt
```
You are a Node backend engineer executing Phase 9 — Express Path.

Goal: Align Node services on standardized Express stack.
Reference 12-express-path.md.

Inputs:
- Existing Spell and Linting Express apps.
- events-core schemas.

Tasks:
1. Add AJV + typebox validation for request payloads.
2. Ensure DB migrations via Prisma or Drizzle.
3. Integrate express-openapi-validator if OpenAPI specs exist.
4. Refactor routes to use type-safe validators.

Dependencies: Phases 1–8 complete.

Exit Criteria:
- All Node services share consistent Express + validation structure.
- Request/response schemas generated from JSON Schema definitions.
```

---

## 🧩 Phase 10 — Events Core (JSON Schema contracts)

### 🔍 Helper Prompt
```
Check for existing events-core folder.
List schemas, versions, and any mismatched field names across producers/consumers.
Output normalization plan.
```

### 🚀 Implementation Prompt
```
You are a cross-language contracts engineer executing Phase 10 — Events Core.

Goal: Make JSON Schema the single source of truth for event contracts.
Reference 13-events-core-json-schema.md.

Inputs:
- schemas under packages/events-core/
- tooling for json-schema-to-typescript and datamodel-code-generator.

Tasks:
1. Finalize envelope.v1.json and payload schemas.
2. Add npm build script to generate TS types.
3. Add Python build step to generate Pydantic models.
4. Publish @yourorg/events-core (npm) and events_core (PyPI).

Dependencies: All prior phases complete.

Exit Criteria:
- One authoritative JSON Schema per event.
- Generated TS + Pydantic types sync to identical contracts.
- Schemas versioned and published.
```

---

# ✅ Usage Notes
- **Run one phase per agent session.**
- Load `00-README.md`, the current phase file, and relevant preceding phases.
- Always include the helper prompt first if code context is large or unclear.
- After success, commit outputs to a `phase-complete/` folder with summary notes.

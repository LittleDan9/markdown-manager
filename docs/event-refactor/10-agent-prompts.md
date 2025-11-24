# Agent Prompts (Copy/Paste)

## Phase 1 — Architecture Inventory
“You are an expert software architect. Scan the repository to produce:
1) domain-map.md, 2) service-deps.md, 3) backend-slimming-opportunities.md.
Identify owners for each table, map routes to domains, and mark calls to be evented vs API. Output only those files.”

## Phase 2 — Identity + Outbox
“You are a backend engineer. Implement the identity schema and the outbox pattern. Modify user create/update/disable flows to insert outbox rows in the same transaction. Add a relay process that publishes to Redis stream identity.user.v1 and uses SKIP LOCKED. Provide tests that assert an outbox row is created and that published=true is eventually set.”

## Phase 3 — Redis Bus
“You are a devops engineer. Add docker-compose service for Redis with AOF on. Create scripts to initialize consumer groups. Publish a test event and demonstrate end-to-end. Update docs.”

## Phase 4 — Linting Consumer
“You are a backend engineer. Add linting schema (identity_projection, user_prefs, event_ledger). Implement a consumer process that reads identity.user.v1, validates envelopes, upserts rows, and acks. Provide integration tests with a seeded Redis instance.”

## Phase 5 — Spell-Check Ownership Shift
“You are a Node engineer. Create spell schema and migrate custom dictionaries from Backend. Replace Backend proxy with direct Spell-Check API. Implement Node consumer for identity.user.v1 and optional DictUpdated event emission. Provide a migration script and e2e tests.”

## Phase 6 — Backend Slimming
“You are a platform engineer. Remove proxy endpoints from Backend. Update Nginx routes to direct traffic to Linting and Spell-Check. Ensure no call paths depend on Backend for dictionaries or lint prefs.”

## Phase 7 — Ops Runbook
“You are an SRE. Add health checks, metrics, and DLQ procedures. Provide a small dashboard JSON (prometheus/Grafana or logs queries) and a recovery drill script.”

## Phase 8 — systemd
“You are a Linux ops engineer. Produce systemd unit files for each containerized component with restart policies, volumes, and logging. Document rollout/rollback.”

# Phase 4 — Linting Consumer (Agent Scope)

## Goal
Linting service (Python **or Node/Express**) **consumes identity events**, maintains a local `identity_projection` table, and (optionally) creates **eager default lint prefs**.

## DB DDL (linting schema)
```sql
CREATE SCHEMA IF NOT EXISTS linting;

CREATE TABLE IF NOT EXISTS linting.identity_projection (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email CITEXT,
  display_name TEXT,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS linting.event_ledger (
  event_id UUID PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linting.user_prefs (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rules JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
```

## Consumer Loop (outline)
- Subscribe as group `linting_group` to `identity.user.v1`.
- For each event:
  - Validate `EventEnvelope` + `payload` (from `events-core`).
  - Upsert `identity_projection`.
  - If `UserCreated` and eager defaults desired: upsert `user_prefs` with default rules.
  - Record `event_id` in `linting.event_ledger` to ensure idempotency.
  - `XACK`.

## Exit Criteria
- New/updated users reflected in `linting.identity_projection` within seconds.
- (If enabled) Defaults appear in `linting.user_prefs` on `UserCreated`.
- Replays are idempotent (no dup rows).

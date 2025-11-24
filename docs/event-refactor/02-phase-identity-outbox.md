# Phase 2 — Identity + Outbox (Agent Scope)

## Goal
Identity becomes the source of truth for `user_id` (UUID) and minimal profile. Add an **outbox** table and a **relay** container that publishes `UserCreated/UserUpdated/UserDisabled` events.

## DB DDL (example; adjust names)
```sql
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL DEFAULT 'user',
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ
);
```

## Code Tasks
- Modify **create/update/disable user** code paths to insert both `users` row and an `outbox` row in the **same transaction**.
- Add a small **relay** service (same image, different command) that:
  - Claims unpublished rows with `FOR UPDATE SKIP LOCKED` (batch).
  - Publishes to Redis Stream `identity.user.v1`.
  - Sets `published=true` on success; retries with exponential backoff; pushes to `identity.user.v1.dlq` on max attempts.

## Exit Criteria
- Creating/updating/disabling a user results in a matching outbox row.
- Relay publishes to Redis when Redis is up; queues retry when down.
- Logs show `published` counts increasing; no duplicate publishes.

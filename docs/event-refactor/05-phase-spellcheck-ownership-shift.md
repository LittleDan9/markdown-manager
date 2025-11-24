# Phase 5 — Spell-Check Owns Custom Dictionaries (Agent Scope)

## Current Problem
Spell-Check (Node/Express) currently fetches custom dictionaries **indirectly** via Backend → Postgres. This centralizes preferences and couples the flow.

## Target
- **Spell-Check** owns `user_dict` data in its own schema/DB and consumes **identity** (and optional dict) events.
- Backend no longer brokers dictionary reads for Spell-Check.

## DB DDL (spell schema, Postgres)
```sql
CREATE SCHEMA IF NOT EXISTS spell;

CREATE TABLE IF NOT EXISTS spell.identity_projection (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email CITEXT,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS spell.user_dict (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  words JSONB NOT NULL,             -- ["hipaa","medicaid",...]
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS spell.event_ledger (
  event_id UUID PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Data Migration
1. Export existing custom dictionary blobs from Backend DB.
2. Backfill `spell.user_dict` (one-time script).
3. Emit synthetic `DictUpdated` events (optional) or mark a `version` bump to align caches.

## Events
- **Consumed**: `identity.user.v1` → maintain `identity_projection`.
- **Emitted (optional)**: `spell.user-dict.v1` with `DictUpdated` when user edits dictionary in Spell-Check UI.

### DictUpdated Payload (v1)
```python
class DictUpdatedPayload(BaseModel):
    user_id: UUID
    words: list[str]
    version: int
```
*(Node uses JSON Schema + AJV for this payload; TS types generated from schema.)*

## Node Consumer (outline)
- Use `redis` or `ioredis` client.
- Create group `spell_group` on `identity.user.v1`.
- Block-read, validate envelope JSON (events-core), upsert Postgres rows, ACK.

## API Changes
- Replace Backend proxy call with **direct** Spell-Check API:
  - `GET /spell/dict/{tenant_id}/{user_id}` → returns merged dictionary.
  - `PUT /spell/dict/{tenant_id}/{user_id}` → updates words; emits `DictUpdated`.

## Exit Criteria
- Spell-Check functions with **no Backend fetch** for dictionaries.
- Local `spell.user_dict` populated from migration and updated on writes.
- Identity updates (disable user) reflect in spell-check access quickly.

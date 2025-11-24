# Phase 3 — Redis Streams Bus (Agent Scope)

## Goal
Stand up Redis (AOF on), define topics, consumer groups, and shared event models. Node services remain on **Express** with AJV validation for events; TS types are generated from JSON Schema (events-core).

## Docker Compose (dev)
```yaml
services:
  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["6379:6379"]
    volumes: ["./redis-data:/data"]
    restart: unless-stopped
```

## Streams & Groups
- Streams (created implicitly on first `XADD`):
  - `identity.user.v1`
  - `spell.user-dict.v1` (will arrive in Phase 5)
- Consumer Groups (create once):
```bash
redis-cli XGROUP CREATE identity.user.v1 linting_group $ MKSTREAM
redis-cli XGROUP CREATE identity.user.v1 export_group $ MKSTREAM
```

## Event Envelope (shared lib: `events-core`)
```python
from pydantic import BaseModel
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime

class EventEnvelope(BaseModel):
    event_id: UUID
    event_type: str                 # "UserCreated" | "UserUpdated" | ...
    topic: str                      # "identity.user.v1"
    schema_version: int
    occurred_at: datetime
    tenant_id: UUID
    aggregate_id: UUID             # usually == user_id for identity events
    correlation_id: Optional[str] = None
    payload: dict                  # validated per-event type
```

### Payloads (v1)
```python
class UserCreatedPayload(BaseModel):
    user_id: UUID
    email: str
    display_name: Optional[str]
    status: Literal["active","disabled"]

class UserUpdatedPayload(BaseModel):
    user_id: UUID
    email: Optional[str]
    display_name: Optional[str]
    status: Optional[Literal["active","disabled"]]
```

## Exit Criteria
- Redis online with AOF.
- `events-core` package published internally (versioned).
- `identity.user.v1` receives test events from relay; consumer groups exist.

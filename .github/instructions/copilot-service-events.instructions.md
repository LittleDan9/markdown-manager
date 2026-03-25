---
description: "Use when working on the event system: event-consumer, event-publisher, events-core shared package, Redis Streams, outbox pattern, event schemas, idempotency, or domain event types."
applyTo: "services/event-consumer/**,services/event-publisher/**,packages/events-core/**,services/backend/app/services/outbox*,services/backend/app/services/database_outbox*,services/backend/app/services/user_service_outbox*"
---
# Event System (Consumer + Publisher + Events-Core)

## Architecture Overview
Transactional outbox pattern with Redis Streams:
```
Backend (outbox_service) → DB outbox table
  → Event Publisher (relay) → Redis Streams
    → Event Consumer → DB projections
```

## Events-Core Package (`packages/events-core/`)
Shared contract package for cross-service event types:

### Schema Definitions (`schemas/`)
JSON Schema contracts:
- `envelope.v1.json` → Event envelope (id, type, source, timestamp, data)
- `identity.user.v1/UserCreated.json`
- `identity.user.v1/UserUpdated.json`
- `identity.user.v1/UserDisabled.json`

### TypeScript (`ts/`)
Generated types + AJV runtime validators:
```typescript
import { EnvelopeV1, UserCreated, validateEnvelope } from 'events-core';
```

### Python (`py/events_core/`)
Generated Pydantic models for consumer/publisher:
```python
from events_core.models import EnvelopeV1, UserCreated
```

### Type Generation
- `json-schema-to-typescript` → TS types
- `datamodel-code-generator` → Python Pydantic models
- Run generation after schema changes

## Event Publisher (`services/event-publisher/`)

### Outbox Relay (`app/relay.py`)
Polls outbox table and publishes to Redis Streams:
- `SELECT ... FOR UPDATE SKIP LOCKED` for concurrent-safe batch reading
- Envelope construction with metadata
- Exponential retry scheduling for failed publishes
- DLQ (Dead Letter Queue) stream for exhausted retries
- Async SQLAlchemy engine + Redis connection pool

### Configuration (`app/config.py`)
Pydantic settings: `database_url`, `redis_url`, `batch_size`, `poll_interval`.

### Health (`app/health.py`)
FastAPI server for health/status/metrics endpoints.

## Event Consumer (`services/event-consumer/`)

### Consumer Loop (`app/consumer.py`)
Redis Streams consumer with graceful fallback:
- Config-driven topic/group subscription
- Auto handler discovery by domain
- Batch processing with ack/retry behavior
- Fallback imports when events-core validators unavailable

### Idempotency (`app/idempotency.py`)
Event ledger tracking in `event_ledger` table:
- Consumer-group scoped deduplication
- Prevents reprocessing on consumer restarts

### Event Processing (`app/events.py`)
Local envelope/type helpers for compatibility when shared package imports drift.

### Database (`app/database.py`)
Async SQLAlchemy session management, schema/table bootstrap.

## Backend Outbox Integration
Services in `services/backend/app/services/`:
- `outbox_service.py` → Transactional outbox abstraction (typed event payload model, insert-based recording)
- `database_outbox.py` → Database-level outbox operations
- `user_service_outbox.py` → User domain event publishing (UserCreated, UserUpdated, UserDisabled)

## Testing
- Consumer: `tests/test_event_processing.py`, `tests/test_redis_integration.py`, `tests/test_config.py`
- Docker test runner: `tests/docker_test_runner.py`
- Testing docs: `TESTING.md`

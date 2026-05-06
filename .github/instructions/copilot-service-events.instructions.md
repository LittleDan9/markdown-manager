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

### Constants (`py/events_core/constants.py` and `ts/index.ts`)
```python
class EventTypes:
    USER_CREATED = "UserCreated"
    USER_UPDATED = "UserUpdated"
    USER_DISABLED = "UserDisabled"
    AI_PROVIDER_PUBLISHED = "AIProviderPublished"
    AI_USAGE_PUBLISHED = "AIUsagePublished"

class Topics:
    IDENTITY_USER_V1 = "identity.user.v1"
    AI_PROVIDER_V1 = "ai.provider.v1"
    AI_USAGE_V1 = "ai.usage.v1"
```

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

## Cross-App Event Streams

### AI Provider Sync (`ai.provider.v1`)
- Event type: `AIProviderPublished`
- Published by: both MM and TM backends on provider create/update/delete and periodic republish
- Consumed by: both apps' event consumers → upsert `remote_ai_providers` table
- Payload: `{ user_email, providers: [{ id, provider, label, model, base_url, org_name, is_active, has_key }] }`
- Consumer groups: `mm-consumer`, `tm-consumer`
- Keys are NEVER included — only `has_key: bool`

### AI Usage Stats (`ai.usage.v1`)
- Event type: `AIUsagePublished`
- Published by: `ai_usage_publisher.py` in both apps (every 5 minutes)
- Consumed by: both apps' event consumers → upsert `remote_ai_usage_daily` table
- Payload: `{ user_email, date, stats: [{ provider, model, request_count, input_tokens, output_tokens, error_count }] }`
- Consumer groups: `mm-consumer`, `tm-consumer`

### Backend Consumer (`services/backend/app/services/event_consumer_backend.py`)
Lightweight in-process consumer running in the backend lifespan (not the separate event-consumer service):
- Subscribes to: `ai.provider.v1`, `ai.usage.v1`
- Uses XREADGROUP with consumer groups for at-least-once delivery
- Resolves users by email from event payload
- Direct async DB writes (no outbox needed for reads)

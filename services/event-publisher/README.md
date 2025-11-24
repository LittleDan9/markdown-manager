# Relay Service

Outbox pattern relay service for publishing domain events from PostgreSQL to Redis Streams.

## Overview

The relay service implements the outbox pattern by:

1. **Polling** the `identity.outbox` table for unpublished events
2. **Publishing** events to Redis Streams with standardized envelopes
3. **Handling retries** with exponential backoff for failed publishes
4. **Moving** failed events to a dead letter queue (DLQ) after max attempts

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend API   │───▶│  Outbox Table   │◀───│  Relay Service  │
│                 │    │  (Postgres)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ Redis Streams   │
                                              │ identity.user.v1│
                                              └─────────────────┘
```

## Configuration

Environment variables (prefix with `RELAY_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql+asyncpg://postgres:postgres@localhost:5432/markdown_manager | PostgreSQL connection |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection |
| `BATCH_SIZE` | 100 | Events processed per batch |
| `POLL_INTERVAL` | 5 | Seconds between polls |
| `MAX_RETRY_ATTEMPTS` | 5 | Max retries before DLQ |
| `RETRY_BASE_DELAY` | 60 | Base seconds for exponential backoff |
| `STREAM_NAME` | identity.user.v1 | Redis stream name |
| `DLQ_STREAM_NAME` | identity.user.v1.dlq | Dead letter queue stream |

## Event Processing

### 1. Outbox Polling

Uses `FOR UPDATE SKIP LOCKED` to:
- Prevent duplicate processing across multiple relay instances
- Ensure atomic batch processing
- Handle high concurrency safely

### 2. Event Envelope

All events are wrapped in a standardized envelope:

```json
{
  "event_id": "uuid",
  "event_type": "UserCreated|UserUpdated|UserDisabled",
  "topic": "identity.user.v1",
  "schema_version": 1,
  "occurred_at": "2024-01-01T00:00:00Z",
  "tenant_id": "uuid",
  "aggregate_id": "uuid",
  "aggregate_type": "user",
  "payload": { ... }
}
```

### 3. Retry Logic

- **Exponential backoff**: 60s, 120s, 240s, 480s, 960s
- **Max attempts**: 5 (configurable)
- **DLQ**: Events moved to `identity.user.v1.dlq` after max attempts

### 4. Dead Letter Queue

Failed events in DLQ contain:
- Original event data
- Error message
- Attempt count
- Failure timestamp

## Deployment

### Docker Compose

```yaml
relay-service:
  build:
    context: ./relay-service
  environment:
    - RELAY_DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/markdown_manager
    - RELAY_REDIS_URL=redis://redis:6379/0
  depends_on:
    - db
    - redis
```

### Health Checks

The service includes basic health checks for:
- Process liveness
- Database connectivity (on startup)
- Redis connectivity (on startup)

## Monitoring

### Logs

Structured logging with levels:
- **INFO**: Startup, batch processing counts, retries
- **DEBUG**: Individual event processing
- **WARNING**: DLQ moves, connection issues
- **ERROR**: Processing failures, configuration errors

### Metrics (Future)

Planned metrics:
- `events_processed_total`
- `events_failed_total`
- `events_dlq_total`
- `processing_duration_seconds`
- `batch_size_histogram`

## Development

### Local Development

```bash
cd relay-service
poetry install
poetry run python main.py
```

### Testing

```bash
poetry run pytest
```

## Production Considerations

1. **Scaling**: Run multiple relay instances for high throughput
2. **Monitoring**: Monitor DLQ growth and processing lag
3. **Backpressure**: Redis stream maxlen prevents unbounded growth
4. **Persistence**: Redis AOF ensures event durability
5. **Recovery**: DLQ events can be manually replayed if needed

## Event Types

### UserCreated
Emitted when a new user account is created.

### UserUpdated
Emitted when user profile, settings, or status changes.

### UserDisabled
Emitted when a user account is disabled or deleted.

See `packages/events-core/schemas/` for complete event schemas.
# Phase 7 — Ops Runbook (Agent Scope)

## Health Checks
- Redis: `PING`, memory, AOF enabled.
- Relays: backlog gauge (unpublished rows), success/failure counters.
- Consumers: `xpending` per group; warn on growing pending > N minutes.

## Metrics (per service)
- `events_published_total{topic}`
- `events_consumed_total{topic,group}`
- `events_dlq_total{topic}`
- `outbox_backlog`
- `consumer_lag_seconds` (last processed ID vs last stream ID)

## DLQ Handling
- Streams named `*.dlq`.
- Pager on first DLQ in 10 min window.
- Procedure: inspect payload, fix code/data, re-publish corrected message or mark resolved.

## Idempotency
- Each consumer keeps `event_ledger(event_id PK)`.
- Upserts only; never assume exactly-once.

## Backups
- Redis AOF volume included in host backups.
- Postgres regular dumps (pg_dump) + WAL if configured.

## Recovery Drills
- Kill Redis; confirm relays retry and consumers resume.
- Replay: reprocess from a known message ID; confirm idempotence.

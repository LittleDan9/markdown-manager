# Phase 7 — Operations Runbook Implementation

## Health Check Endpoints

### Backend Service (`localhost:8000`)
- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed` (includes Redis monitoring)
- **Metrics**: `GET /monitoring/metrics`

### Relay Service (`localhost:8080`)
- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed` (includes outbox backlog)
- **Metrics**: `GET /metrics`

### Consumer Services
- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /health/detailed` (includes consumer lag)
- **Metrics**: `GET /metrics`

## Metrics Collection

### Available Metrics

#### Relay Service Metrics
```json
{
  "events_published_total": {"identity": 1247},
  "events_dlq_total": {"identity": 3},
  "outbox_backlog": 15,
  "publish_success_total": 1247,
  "publish_failure_total": 8,
  "success_rate": 99.36
}
```

#### Consumer Service Metrics
```json
{
  "events_consumed_total": {"identity": 1244},
  "consumer_lag_seconds": 2.5,
  "events_processed_success": 1241,
  "events_processed_failure": 3,
  "success_rate": 99.76
}
```

### Prometheus Integration (Future)

For Prometheus integration, add these endpoints:

```bash
# Add to relay service
GET /metrics/prometheus

# Add to consumer services
GET /metrics/prometheus
```

Sample Prometheus queries:
```promql
# Event processing rate
rate(events_published_total[5m])

# Consumer lag alert
consumer_lag_seconds > 60

# DLQ alert
increase(events_dlq_total[10m]) > 0

# Success rate
(events_processed_success / (events_processed_success + events_processed_failure)) * 100
```

## DLQ (Dead Letter Queue) Management

### DLQ Tool Usage

Install dependencies:
```bash
pip install aioredis tabulate
```

List failed messages:
```bash
python scripts/dlq_tool.py list --stream identity.dlq --count 20
```

Inspect specific message:
```bash
python scripts/dlq_tool.py inspect --stream identity.dlq --id 1700000000000-0
```

Reprocess message (after fixing root cause):
```bash
python scripts/dlq_tool.py reprocess --stream identity.dlq --id 1700000000000-0
```

Mark as resolved (manual resolution):
```bash
python scripts/dlq_tool.py resolve --stream identity.dlq --id 1700000000000-0
```

Generate DLQ report:
```bash
python scripts/dlq_tool.py report --stream identity.dlq --hours 24
```

### DLQ Alerting

Set up alerts for:
- First DLQ message in 10-minute window
- DLQ backlog > 50 messages
- High error rate (>5% failures)

### Recovery Procedures

1. **Investigate**: Use `dlq_tool.py inspect` to examine failed message
2. **Fix Root Cause**: Update code or data based on error
3. **Reprocess**: Use `dlq_tool.py reprocess` to retry message
4. **Monitor**: Check metrics to ensure success

## Idempotency & Event Ledger

### Database Setup

Run the migration:
```bash
psql -d markdown_manager -f scripts/event_ledger_migration.sql
```

### Consumer Integration

Each consumer uses idempotency tracking:
```python
from app.idempotency import ensure_idempotent_processing

await ensure_idempotent_processing(
    session=session,
    event_id=event_id,
    event_type=event_type,
    consumer_group="markdown-lint-consumer",
    processing_function=process_event_logic,
    schema="public"
)
```

### Cleanup

Automatic cleanup of old ledger entries (30+ days):
```sql
SELECT cleanup_event_ledger();
```

## Monitoring Dashboards

### Log-Based Monitoring

Key log patterns to monitor:
```bash
# Health check failures
grep "unhealthy\|degraded" /var/log/markdown-manager/*.log

# DLQ additions
grep "Moved event.*to DLQ" /var/log/markdown-manager/relay.log

# Processing errors
grep "Failed to process event" /var/log/markdown-manager/*.log

# Consumer lag warnings
grep "consumer.*lag" /var/log/markdown-manager/*.log
```

### Dashboard Queries

#### Grafana Dashboard Queries (if using Prometheus):

**Events Published Rate**:
```promql
sum(rate(events_published_total[5m])) by (topic)
```

**Consumer Lag**:
```promql
max(consumer_lag_seconds) by (consumer_group)
```

**Error Rate**:
```promql
(sum(rate(events_processed_failure[5m])) / sum(rate(events_consumed_total[5m]))) * 100
```

**Outbox Backlog**:
```promql
max(outbox_backlog)
```

## Operational Procedures

### Daily Checks
1. Check health endpoints for all services
2. Review DLQ reports for overnight failures
3. Monitor consumer lag metrics
4. Check outbox backlog levels

### Weekly Maintenance
1. Clean up old event ledger entries
2. Review DLQ trends and patterns
3. Update alert thresholds based on usage
4. Backup Redis AOF files

### Incident Response

#### High Consumer Lag
1. Check consumer service health
2. Verify Redis connectivity
3. Check database performance
4. Scale consumer if needed

#### DLQ Spike
1. Identify error patterns using DLQ report
2. Check for data/schema issues
3. Fix root cause in code
4. Reprocess failed messages

#### Service Health Degraded
1. Check specific service details in `/health/detailed`
2. Verify dependencies (DB, Redis, external services)
3. Check resource usage (CPU, memory)
4. Restart service if needed

## Recovery Drills

### Redis Failure Recovery
```bash
# Stop Redis
docker compose stop redis

# Verify relay retries and consumers wait
curl http://localhost:8080/health/detailed

# Restart Redis
docker compose start redis

# Verify services recover
curl http://localhost:8080/metrics
```

### Event Replay Testing
```bash
# Get last processed event ID
curl http://localhost:8081/metrics | jq '.last_processed_event_id'

# Simulate replay from specific point (manual intervention required)
# This would typically involve resetting consumer group position
```

### Idempotency Testing
```bash
# Reprocess same event multiple times
python scripts/dlq_tool.py reprocess --stream identity.dlq --id <event-id>
python scripts/dlq_tool.py reprocess --stream identity.dlq --id <event-id>

# Verify only processed once in event_ledger
psql -d markdown_manager -c "SELECT * FROM public.event_ledger WHERE event_id = '<event-id>'"
```

## Troubleshooting

### Common Issues

**Consumer Not Processing**:
- Check Redis connectivity
- Verify consumer group configuration
- Check database connections
- Review event ledger for duplicate processing

**High Memory Usage**:
- Check Redis memory usage in health endpoint
- Monitor stream lengths (should be capped at 10k)
- Clean up old DLQ messages

**Processing Failures**:
- Check DLQ for error patterns
- Verify data formats and schemas
- Check database constraints
- Review recent code changes
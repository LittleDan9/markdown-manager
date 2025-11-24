# Event Schemas (Shared)

## Envelope (v1)
```json
{
  "event_id": "uuid",
  "event_type": "UserCreated",
  "topic": "identity.user.v1",
  "schema_version": 1,
  "occurred_at": "2025-11-23T12:00:00Z",
  "tenant_id": "uuid",
  "aggregate_id": "uuid",
  "correlation_id": "optional",
  "payload": { "... typed per event ..." }
}
```

## identity.user.v1
- `UserCreated` → `UserCreatedPayload`
- `UserUpdated` → `UserUpdatedPayload`
- `UserDisabled` → `{ user_id, reason? }`

## spell.user-dict.v1
- `DictUpdated` → `DictUpdatedPayload`

> Breaking changes → bump topic version to `*.v2`. Maintain old topics during transition.

# Events Core

JSON Schema-based event contracts and type generation for markdown-manager microservices.

## Overview

This package provides:
- **JSON Schema definitions** for all domain events
- **TypeScript types** generated from schemas
- **Pydantic models** generated from schemas
- **Runtime validation** for both TypeScript and Python
- **Event envelope standardization** across all services

## Structure

```
packages/events-core/
├── schemas/                    # JSON Schema definitions
│   ├── envelope.v1.json       # Standard event envelope
│   └── identity.user.v1/      # Identity domain events
│       ├── UserCreated.json
│       ├── UserUpdated.json
│       └── UserDisabled.json
├── ts/                        # TypeScript types and validators
│   ├── index.ts
│   └── types.d.ts            # Generated types
├── py/                       # Python models and validators
│   ├── __init__.py
│   ├── validators.py
│   └── models.py            # Generated Pydantic models
├── package.json
└── pyproject.toml
```

## Usage

### TypeScript

```typescript
import { validateEvent, EventTypes, Topics } from '@markdown-manager/events-core';

const event = {
  event_id: '123e4567-e89b-12d3-a456-426614174000',
  event_type: EventTypes.USER_CREATED,
  topic: Topics.IDENTITY_USER_V1,
  schema_version: 1,
  occurred_at: new Date().toISOString(),
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  aggregate_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  payload: {
    user_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    display_name: 'John Doe',
    status: 'active',
    created_at: new Date().toISOString()
  }
};

if (validateEvent(event)) {
  console.log('Event is valid!');
}
```

### Python

```python
from events_core import EventValidator, EventTypes, Topics

validator = EventValidator()

event = {
    "event_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": EventTypes.USER_CREATED,
    "topic": Topics.IDENTITY_USER_V1,
    "schema_version": 1,
    "occurred_at": "2024-01-01T00:00:00Z",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "aggregate_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "payload": {
        "user_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "display_name": "John Doe",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z"
    }
}

if validator.validate_event(event):
    print("Event is valid!")
```

## Development

### TypeScript

```bash
cd packages/events-core
npm install
npm run build        # Generate types and compile
npm run dev          # Watch mode
```

### Python

```bash
cd packages/events-core
pip install -e .[dev]

# Generate Pydantic models from JSON Schema
datamodel-codegen \
  --input schemas \
  --input-file-type jsonschema \
  --output py/models.py \
  --use-standard-collections \
  --target-python-version 3.11 \
  --field-constraints \
  --use-schema-description \
  --validation
```

## Event Types

### Identity Domain (identity.user.v1)

- **UserCreated**: Emitted when a new user account is created
- **UserUpdated**: Emitted when user profile or settings are updated
- **UserDisabled**: Emitted when a user account is disabled or deleted

## Versioning

- **Schema Version**: Incremented for breaking changes to event structure
- **Topic Version**: Embedded in Redis stream name (e.g., `identity.user.v1`)
- **Package Version**: Follows semantic versioning for the package itself

## Integration

This package is designed to be used by:
- **Backend services** (Python/FastAPI) for event publishing
- **Microservices** (Node.js/Express) for event consumption
- **Relay containers** for outbox pattern implementation
- **Message bus** (Redis Streams) for event routing
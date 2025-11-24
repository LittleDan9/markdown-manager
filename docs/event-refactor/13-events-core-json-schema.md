# Events Core — JSON Schema as Source of Truth

We standardize on **JSON Schema** for all event payloads and a common **envelope**. From these, we generate:
- **TypeScript types** (Node/Express) — runtime validation via AJV
- **Pydantic models** (Python) — compile-time + runtime validation

## Repo layout
```
packages/
  events-core/
    schemas/
      envelope.v1.json
      identity.user.v1/
        UserCreated.json
        UserUpdated.json
        UserDisabled.json
      spell.user-dict.v1/
        DictUpdated.json
    ts/
      index.ts
    py/
      models.py
    package.json
    pyproject.toml
```

## Envelope (v1) — JSON Schema (excerpt)
```json
{
  "$id": "envelope.v1.json",
  "type": "object",
  "required": ["event_id","event_type","topic","schema_version","occurred_at","tenant_id","aggregate_id","payload"],
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_type": { "type": "string" },
    "topic": { "type": "string" },
    "schema_version": { "type": "integer", "minimum": 1 },
    "occurred_at": { "type": "string", "format": "date-time" },
    "tenant_id": { "type": "string", "format": "uuid" },
    "aggregate_id": { "type": "string", "format": "uuid" },
    "correlation_id": { "type": ["string","null"] },
    "payload": { "type": "object" }
  },
  "additionalProperties": false
}
```

## Tooling
- **Node (TS types)**: `json-schema-to-typescript`
  - Script: `js2ts -i schemas/**/*.json -o ts/types.d.ts`
- **Python (Pydantic v2 models)**: `datamodel-code-generator`
  - Script: `datamodel-codegen --input schemas --input-file-type jsonschema --output py/models.py --use-standard-collections --target-python-version 3.11`

## Publishing
- **npm**: `@yourorg/events-core`
- **PyPI**: `events_core`

## Versioning
- Topic version in the **stream name**: `identity.user.v1`
- Envelope `schema_version` bumps on breaking changes
- Keep `*.v1` alive during transitions; add `*.v2` for new consumers; retire v1 after migration.

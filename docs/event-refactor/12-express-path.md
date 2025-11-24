# Express Path — Keep Node Services on Express

We will **keep Express** for Spell-Check and Markdown Lint. To align with the Python stack (Pydantic/FastAPI) while remaining language-agnostic:

## Libraries
- **Runtime validation**: `ajv` + `@sinclair/typebox` (or `zod`)
- **Types from JSON Schema**: `json-schema-to-typescript`
- **OpenAPI request validation (optional)**: `express-openapi-validator`
- **DB**: Prisma / Drizzle / Knex (examples assume Prisma)

## Patterns
- **Contracts-first**: JSON Schemas live in a shared `packages/events-core/` workspace → generate TS types for Node and Pydantic models for Python.
- **Per-service data ownership**: Each Node service owns its **schema** (Postgres), **migrations**, and **outbox** (if it emits events).
- **Consumers**: Use Redis Streams with `BLOCK`, `XREADGROUP`, `XACK`. Validate envelopes with AJV before touching the DB.
- **Producers**: Write domain change + outbox row in a single DB transaction. A generic relay publishes.

## Minimal Express route with validation
```ts
import express from "express";
import { Type, Static } from "@sinclair/typebox";
import Ajv from "ajv";
const ajv = new Ajv({allErrors: true});

const DictUpdateBody = Type.Object({
  words: Type.Array(Type.String({ minLength: 1 })),
  version: Type.Integer({ minimum: 1 })
});
type DictUpdateBody = Static<typeof DictUpdateBody>;
const validateBody = ajv.compile(DictUpdateBody);

const app = express();
app.use(express.json());
app.put("/spell/dict/:tenant_id/:user_id", (req, res) => {
  if (!validateBody(req.body)) return res.status(400).json({ errors: validateBody.errors });
  // upsert and outbox write here
  res.status(204).end();
});
app.listen(8003);
```

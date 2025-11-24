# Monolith → Domains (with Redis Streams) — Program Plan

This repository contains a phased plan to decompose the current Backend service into domain services and introduce event-driven communication using Redis Streams + the Outbox pattern. Each phase is designed to be executed by a single AI Agent (Claude Sonnet 4 or GPT-5) with minimal human orchestration.

## Phases (One-Agent-Per-Phase)
1. **Architecture Inventory** — Map domains, tables, routes, and service dependencies.
2. **Identity + Outbox** — Carve out Identity ownership and add an outbox + relay.
3. **Redis Streams Bus** — Stand up Redis, define topics, consumer groups, and envelopes.
4. **Linting Consumer** — Subscribe to identity events and build local read models/prefs.
5. **Spell-Check Ownership Shift** — Move custom dictionaries into Spell-Check (Node/Express).
6. **Backend Slimming** — Remove old paths, wire through Nginx, and update contracts.
7. **Ops Runbook** — Observability, DLQ, idempotency, and recovery drills.
8. **Production (systemd) Hand-off** — Compose → systemd units; persistence and logs.
9. **Express Path** — Keep Node services on Express; add runtime validation + codegen.
10. **Events Core** — JSON Schema as source of truth (generate TS and Pydantic).

> Deployment model: **Single Debian host**, Docker Compose for dev, systemd-managed containers for prod.  
> Message bus: **Redis Streams** with **AOF** persistence.

See each `phase-*.md` file for instructions, exit criteria, and agent prompts.

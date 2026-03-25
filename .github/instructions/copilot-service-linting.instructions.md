---
description: "Use when working on the markdown linting service: markdownlint wrapper, rule definitions, lint endpoint, or linting consumer configuration."
applyTo: "services/linting/**"
---
# Linting Service

## Overview
Lean Node.js/Express service wrapping markdownlint for HTTP-based markdown lint processing.

**Tech Stack**: Node.js 20, Express, markdownlint (ESM dynamic import), CORS.

## Architecture

### Server (`server.js`)
Async bootstrap pattern:
1. Dynamically imports ESM markdownlint/sync module
2. Configures Express with CORS, JSON parsing (large payload support)
3. Starts serving only after successful module load

### Endpoints
- `POST /lint` → Process markdown text with configurable rule set
- `GET /rules` → Rule definitions with metadata
- `GET /recommended-defaults` → Default rule configuration
- `GET /health` → Service health with request stats and performance counters

### Rule System
- `rules-definitions.json` → Maps MD rule IDs to name, description, category, fixability
- `recommended-defaults.json` → Default enabled/disabled state per rule
- Rules categorized by domain: Headings, Lists, Code, Whitespace, Links, etc.
- Fixability metadata enables auto-fix surfacing in UI

## Consumer Integration
- `consumer.config.json` → Configuration for event-driven linting via consumer service
- `markdown-manager-linting-consumer.service` → systemd unit for consumer mode
- `markdown-manager-linting.service` → systemd unit for HTTP service mode

## Development
```bash
docker compose up linting  # Start linting service
# Service runs on port 3002 internally
# Accessed via backend proxy or direct
```

# Phase 6 — Backend Slimming (Agent Scope)

## Goal
Eliminate Backend’s role as “context broker” for linting/spell-check where domain ownership now exists.

## Tasks
- Remove routes:
  - `/api/spell/*` dictionary proxy → replaced with Spell-Check API.
  - Any lint-pref endpoints not owned by Linting → replaced with Linting API.
- Keep only cross-cutting routes that are still legitimately Backend’s domain (if any).

## Nginx
- Route `/api/spell/*` → Spell-Check (Express).
- Route `/api/lint/*` → Linting (Express or Python).
- Preserve `/api/export/*` → Export.

## Exit Criteria
- Requests for spell dictionaries and lint prefs bypass Backend completely.
- Integration tests green via Nginx proxy.

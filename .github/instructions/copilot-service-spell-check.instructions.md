---
description: "Use when working on the spell-check service: spell checking engines, grammar analysis, style checking, language detection, custom dictionaries, contextual analysis, or cspell integration."
applyTo: "services/spell-check/**"
---
# Spell-Check Service

## Overview
Node.js/Express writing-assistance API providing spell, grammar, style, language detection, and contextual analysis.

**Tech Stack**: Node.js 20, Express, nspell + hunspell dictionaries, cspell, compromise, retext, write-good, franc, PostgreSQL, Redis.

## Architecture

### Server (`server.js`)
`SpellCheckApplication` class pattern:
- Merges config, initializes services via `ServiceManager`
- Wires middleware stack + route modules
- Async bootstrap before serving traffic

### ServiceManager (`services/ServiceManager.js`)
Dependency container instantiating all analyzers:
- Enhanced spell checker (nspell/hunspell)
- Grammar analyzer
- Style analyzer
- Language detection (franc)
- Custom dictionary manager
- Contextual analyzer
- Style guide manager
- CSpell code-check engine

### Route Modules (`routes/`)
API surface mounted via `routes/index.js`:
- Health/info endpoints
- `/spell-check` → Core spell checking
- `/batch` → Batch text processing
- `/language` → Language detection
- `/style-guides` → Style guide management
- `/contextual` → Contextual analysis
- `/dictionary` → Custom dictionary CRUD

### Library Layer (`lib/`)
Domain engines and adapters:
- Core spell engines (nspell + hunspell dictionary loading)
- `cspell/` → CSpell integration adapters
- `database/` → PostgreSQL helpers for dictionary persistence

### Middleware (`middleware/`)
Request processing pipeline (CORS, error handling, logging).

## Custom Dictionaries
- Per-user and per-scope dictionary management
- PostgreSQL-backed persistence
- Migration scripts in `migrations/`
- Sync with frontend dictionary UI

## Configuration
- `config/` → Service configuration files
- `dictionaries/en-US/` → Base hunspell dictionary files
- Runtime config via environment variables

## Testing
- Jest test suite in `tests/`
- Testing strategy documented in `TESTING_STRATEGY.md`
- Architecture analysis in `docs/architecture-analysis.md`

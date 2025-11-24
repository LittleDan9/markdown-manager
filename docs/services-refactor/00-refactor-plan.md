# Services Directory Refactor — Program Plan

This repository contains a phased plan to restructure the markdown-manager workspace by consolidating all services under a root `services/` directory and applying consistent naming conventions. Each phase is designed to be executed by a single AI Agent with minimal human orchestration.

## Current Architecture

The markdown-manager system currently has services scattered across the root directory:

- `backend/` - FastAPI application (Python)
- `frontend/` - React/Vue frontend application
- `export-service/` - PDF/diagram export service (Python/Playwright)
- `markdown-lint-service/` - Markdown linting service (Node.js)
- `spell-check-service/` - Spell checking service (Node.js)
- `consumer-service-base/` - Event consumer framework (Python)
- `relay-service/` - Outbox pattern relay service (Python)
- `redis/`, `nginx/`, `packages/` - Infrastructure and shared components

## Target Architecture

Consolidate all services under a unified `services/` directory with meaningful names:

```text
services/
├── backend/              # FastAPI application (renamed from backend/)
├── frontend/             # React/Vue application (renamed from frontend/)
├── export/               # Export service (renamed from export-service/)
├── linting/              # Linting service (renamed from markdown-lint-service/)
├── spell-check/          # Spell check service (renamed from spell-check-service/)
├── event-consumer/       # Event consumer framework (renamed from consumer-service-base/)
└── event-publisher/      # Event publisher service (renamed from relay-service/)
```

## Refactor Objectives

1. **Service Organization** - Consolidate all services under `services/` directory
2. **Naming Consistency** - Remove "service" suffix from folder names for clarity
3. **Semantic Clarity** - Rename ambiguous services (`relay-service` → `event-publisher`, `consumer-service-base` → `event-consumer`)
4. **Infrastructure Alignment** - Update all Docker, deployment, and configuration files
5. **Legacy Cleanup** - Remove unused configuration files and deprecated patterns

## Phases (One-Agent-Per-Phase)

1. **Directory Structure Creation** — Create new `services/` directory and move all service folders with new names
2. **Docker Configuration Update** — Update `docker-compose.yml` and all Dockerfiles to reference new paths
3. **Deployment Infrastructure** — Update Makefile, deployment scripts, and service configurations
4. **System Service Files** — Update systemd service files and production deployment configurations
5. **Cross-Service References** — Update Nginx configs, backend settings, and inter-service communication
6. **Legacy Cleanup** — Remove unused consumer configs and deprecated configuration patterns
7. **Integration Testing** — Validate all services work together with new structure
8. **Documentation Update** — Update all documentation to reflect new service structure

> Deployment model: **Single Debian host**, Docker Compose for dev, systemd-managed containers for prod.
> Event bus: **Redis Streams** with existing event-publisher/event-consumer pattern maintained.

## Key Considerations

### Docker Image Naming
Update Docker Hub images to align with new structure:
- `littledan9/markdown-manager-event-publisher` (was relay)
- `littledan9/markdown-manager-event-consumer` (was consumer)
- `littledan9/markdown-manager-linting` (was lint)

### Consumer Group Names
Update Redis consumer groups to reflect new service names:
- `linting_group` (was `lint_group`)
- `spell_check_group` (consistent with new structure)

### Configuration Management
- Keep consumer configs in domain services (`services/linting/consumer.config.json`)
- Remove legacy configs from `consumer-service-base/configs/`
- Maintain production config deployment patterns

### Service Communication
- Maintain existing Docker internal networking with updated service names
- Preserve Nginx routing patterns with new service references
- Ensure event-publisher/event-consumer communication remains intact

## Success Criteria

- All services consolidated under `services/` directory
- Docker Compose development environment fully functional
- Production systemd deployment updated and validated
- Event-driven communication preserved and operational
- No breaking changes to external APIs or user-facing functionality
- Comprehensive documentation reflecting new structure

See each `phase-*.md` file for detailed instructions, deliverables, and agent prompts.
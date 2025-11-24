# Phase 8 — Documentation Update (Agent Scope)

## Goal
Update all documentation to reflect the new service structure, including README files, deployment guides, development setup instructions, and architectural documentation. This phase ensures documentation accurately represents the refactored system.

## Documentation to Update

### Root Level Documentation
1. `README.md` - Main project README
2. `docs/deployment/` - Deployment documentation
3. `docs/development/` - Development setup guides
4. `docs/ops-runbook.md` - Operations documentation
5. Architecture diagrams and service maps

### Service-Specific Documentation
1. `services/*/README.md` - Individual service documentation
2. Service configuration documentation
3. API documentation
4. Development setup instructions

## Tasks

### 1. Update Root README.md

#### Project Structure Section
```markdown
# Before
## Project Structure

- `backend/` - FastAPI backend service
- `frontend/` - React frontend application
- `export-service/` - PDF/diagram export service
- `markdown-lint-service/` - Markdown linting service
- `spell-check-service/` - Spell checking service
- `consumer-service-base/` - Event consumer framework
- `relay-service/` - Event relay service

# After
## Project Structure

```text
services/
├── backend/              # FastAPI backend service
├── frontend/             # React frontend application
├── export/               # PDF/diagram export service
├── linting/              # Markdown linting service
├── spell-check/          # Spell checking service
├── event-consumer/       # Event consumer framework
└── event-publisher/      # Event publishing service
```

Infrastructure:
- `nginx/` - Reverse proxy configuration
- `redis/` - Redis configuration
- `packages/` - Shared libraries and schemas
```

#### Development Setup Section
```markdown
# Update development setup instructions
## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/LittleDan9/markdown-manager.git
cd markdown-manager

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Service URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Export Service: http://localhost:8001
- Linting Service: http://localhost:8002
- Spell Check Service: http://localhost:8003
```

### 2. Update Deployment Documentation

#### Update docs/deployment/docker-compose.md
```markdown
# Docker Compose Deployment

## Service Configuration

The system consists of 7 main services organized under the `services/` directory:

### Core Services
- **backend** (`services/backend/`) - FastAPI application
- **frontend** (`services/frontend/`) - React application
- **export** (`services/export/`) - PDF/diagram export
- **linting** (`services/linting/`) - Markdown linting
- **spell-check** (`services/spell-check/`) - Spell checking

### Event-Driven Services
- **event-publisher** (`services/event-publisher/`) - Publishes domain events to Redis
- **event-consumer** (`services/event-consumer/`) - Consumes events for domain services

### Consumer Configurations
Consumer services use configurations located in their respective service directories:
- Linting consumer: `services/linting/consumer.config.json`
- Spell check consumer: `services/spell-check/consumer.config.json`
```

#### Update docs/deployment/production.md
```markdown
# Production Deployment

## Systemd Services

The following systemd services manage the containerized applications:

- `markdown-manager-api.service` - Backend API service
- `markdown-manager-export.service` - Export service
- `markdown-manager-linting.service` - Linting service
- `markdown-manager-linting-consumer.service` - Linting event consumer
- `markdown-manager-spell-check.service` - Spell check service
- `markdown-manager-spell-check-consumer.service` - Spell check event consumer
- `markdown-manager-event-publisher.service` - Event publisher service

## Docker Images

Production uses the following Docker images:
- `littledan9/markdown-manager:latest` - Backend service
- `littledan9/markdown-manager-export:latest` - Export service
- `littledan9/markdown-manager-linting:latest` - Linting service
- `littledan9/markdown-manager-spell-check:latest` - Spell check service
- `littledan9/markdown-manager-event-consumer:latest` - Event consumer framework
- `littledan9/markdown-manager-event-publisher:latest` - Event publisher service
```

### 3. Update Service Documentation

#### Update services/backend/README.md
```markdown
# Backend Service

FastAPI-based backend service providing the core API for the markdown manager application.

## Location
This service is located at `services/backend/` (moved from root `backend/` directory).

## Configuration
Service URLs for inter-service communication:
- Export Service: `http://export-service:8001`
- Linting Service: `http://linting-service:8002`
- Spell Check Service: `http://spell-check-service:8003`

## Development
```bash
cd services/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
```

#### Update services/event-consumer/README.md
```markdown
# Event Consumer Service

Configurable Redis Streams consumer framework for domain-specific event processing.

## Overview
This service (formerly `consumer-service-base`) provides a reusable base for consuming events from Redis Streams. It's used by:
- Linting service consumer
- Spell check service consumer

## Configuration
Each domain service maintains its own consumer configuration:
- `services/linting/consumer.config.json` - Linting consumer config
- `services/spell-check/consumer.config.json` - Spell check consumer config

These configurations are mounted into the event-consumer container via Docker volumes.

## Consumer Groups
- `linting_group` - Processes events for linting service
- `spell_check_group` - Processes events for spell check service
```

#### Update services/event-publisher/README.md
```markdown
# Event Publisher Service

Outbox pattern implementation for reliable event publishing from PostgreSQL to Redis Streams.

## Overview
This service (formerly `relay-service`) implements the outbox pattern by:
1. Polling the `identity.outbox` table for unpublished events
2. Publishing events to Redis Streams with standardized envelopes
3. Handling retries with exponential backoff
4. Moving failed events to dead letter queue (DLQ)

## Event Flow
```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend API   │───▶│  Outbox Table   │◀───│ Event Publisher │
│                 │    │  (PostgreSQL)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ Redis Streams   │
                                              │ identity.user.v1│
                                              └─────────────────┘
```
```

### 4. Update Development Documentation

#### Update docs/development/setup.md
```markdown
# Development Setup

## Service Structure
The project uses a unified services directory structure:

```text
services/
├── backend/              # FastAPI backend (Python)
├── frontend/             # React frontend (Node.js)
├── export/               # Export service (Python)
├── linting/              # Linting service (Node.js)
├── spell-check/          # Spell check service (Node.js)
├── event-consumer/       # Event consumer framework (Python)
└── event-publisher/      # Event publisher service (Python)
```

## Local Development

### Start All Services
```bash
docker-compose up -d
```

### Individual Service Development
```bash
# Backend development
cd services/backend
# ... development setup

# Frontend development
cd services/frontend
# ... development setup
```
```

### 5. Update Architecture Documentation

#### Create/Update docs/architecture/services.md
```markdown
# Service Architecture

## Service Organization
All services are organized under the `services/` directory with clear naming conventions:

- **Removed "service" suffix** from directory names for clarity
- **Semantic naming** for event-driven components:
  - `event-publisher` (outbox pattern implementation)
  - `event-consumer` (configurable consumer framework)

## Service Communication

### Synchronous Communication
- Frontend ↔ Backend: HTTP/REST APIs
- Backend ↔ Export: HTTP service calls
- Backend ↔ Linting: HTTP service calls
- Backend ↔ Spell Check: HTTP service calls

### Asynchronous Communication
- Backend → Event Publisher: Database outbox pattern
- Event Publisher → Redis Streams: Event publishing
- Redis Streams → Event Consumer: Event consumption
- Event Consumer → Domain Services: Local database updates

## Docker Service Names
Docker Compose uses the following service names for internal networking:
- `backend` (services/backend/)
- `frontend` (services/frontend/)
- `export-service` (services/export/)
- `linting-service` (services/linting/)
- `spell-check-service` (services/spell-check/)
- `event-publisher` (services/event-publisher/)
```

### 6. Update API Documentation

#### Update API endpoint documentation
```markdown
# API Documentation

## Service Endpoints

### Backend API
- Base URL: `http://localhost:8000`
- Health Check: `GET /health`
- User API: `GET /api/users/*`
- Documents API: `GET /api/documents/*`

### Export Service
- Base URL: `http://localhost:8001`
- Health Check: `GET /health`
- PDF Export: `POST /generate-pdf`
- Diagram Export: `POST /export-diagram`

### Linting Service
- Base URL: `http://localhost:8002`
- Health Check: `GET /health`
- Lint Text: `POST /lint`

### Spell Check Service
- Base URL: `http://localhost:8003`
- Health Check: `GET /health`
- Check Spelling: `POST /check`
```

## Deliverables
1. Updated root README.md with new service structure
2. Updated deployment documentation
3. Updated individual service README files
4. Updated development setup instructions
5. Updated architecture documentation
6. Updated API documentation
7. Updated Docker Compose documentation
8. Updated production deployment guides
9. Created service migration guide
10. Updated troubleshooting documentation

## Validation

### Documentation Review Checklist
```markdown
- [ ] All service paths updated from old to new locations
- [ ] Docker service names correctly documented
- [ ] Consumer configuration locations accurate
- [ ] Development setup instructions work
- [ ] Deployment guides reference correct paths
- [ ] API documentation matches actual endpoints
- [ ] Architecture diagrams reflect new structure
- [ ] Troubleshooting guides reference correct service names
```

### Test Documentation
```bash
# Test that documented commands work
# Follow development setup guide step by step
# Verify all documented endpoints are accessible
# Confirm configuration file locations are correct
```

## Exit Criteria
- ✅ Root README.md accurately describes new service structure
- ✅ All service README files updated with correct locations
- ✅ Deployment documentation references correct paths and service names
- ✅ Development setup instructions work with new structure
- ✅ API documentation matches actual service endpoints
- ✅ Architecture documentation reflects refactored system
- ✅ Docker Compose documentation accurate
- ✅ No references to old service names or paths in documentation
- ✅ Consumer configuration documentation correct
- ✅ Production deployment guides updated

## Agent Prompt Template
```text
You are tasked with Phase 8 of the services refactor: Documentation Update.

Your goal is to:
1. Update root README.md with new service structure
2. Update all service-specific README files
3. Update deployment and development documentation
4. Update API and architecture documentation
5. Ensure all references to old paths/names are corrected

Validate thoroughly:
- Follow documented setup instructions to verify they work
- Check that all service paths and names are correct
- Verify API documentation matches actual endpoints
- Test that configuration file locations are accurate

Document any discrepancies or issues found between documentation and actual implementation.
```

## Content Standards

### Documentation Style Guide
- Use consistent service names throughout
- Include both directory paths and Docker service names where relevant
- Provide clear examples for configuration and setup
- Include troubleshooting sections for common issues
- Use proper markdown formatting and structure

### Code Examples
- Ensure all code examples use correct service paths
- Verify environment variables and configuration values
- Test all command examples actually work
- Include both development and production examples where applicable

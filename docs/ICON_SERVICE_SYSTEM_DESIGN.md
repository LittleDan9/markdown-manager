# Icon Service System Design

## Overview

This document outlines the complete system design for the Icon Service microservice, designed to offload icon management from the frontend and provide efficient, scalable icon serving capabilities. The system uses a hybrid architecture combining PostgreSQL with PostgREST for API generation and PostgreSQL NOTIFY/LISTEN for event-driven communication.

## Architecture Overview

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Main Backend   │    │  Icon Service   │
│                 │    │                  │    │                 │
│ - Icon Browser  │◄──►│ - User Mgmt      │    │ - Icon Serving  │
│ - Mermaid Diag  │    │ - Documents      │    │ - Usage Analytics│
│ - PostgREST API │    │ - Auth           │    │ - Search & Cache │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────────┐
                    │    Shared Database      │
                    │                         │
                    │ - PostgreSQL 15         │
                    │ - PostgREST API Layer   │
                    │ - Event System          │
                    │ - Icon Metadata         │
                    └─────────────────────────┘
```

## Technology Stack

- **Database**: PostgreSQL 15 with JSONB, Full-Text Search, NOTIFY/LISTEN
- **API Layer**: PostgREST (auto-generated REST API from schema)
- **Backend Services**: FastAPI + SQLAlchemy + asyncio
- **Icon Processing**: Node.js build-time extraction
- **Event System**: PostgreSQL native events + triggers
- **Caching**: In-memory + Redis (optional for scaling)
- **Container Orchestration**: Docker Compose

## Core Principles

1. **Database-First Design**: Schema drives API, reducing boilerplate
2. **Event-Driven Architecture**: Asynchronous communication via PostgreSQL events
3. **Microservice Independence**: Services own their domain data
4. **Performance Optimization**: Multi-layer caching and batch operations
5. **Incremental Implementation**: Each phase provides working functionality

## Phase Implementation Strategy

The implementation is broken into 6 phases, each building upon the previous:

### Phase 1: Database Foundation & PostgREST Setup

- PostgreSQL schema design
- PostgREST configuration
- Basic icon metadata storage
- Simple REST API endpoints

### Phase 2: Icon Extraction & Data Population

- Node.js icon extraction system
- Multi-stage Docker build
- AWS icons and Iconify processing
- Database population scripts

### Phase 3: Icon Service Core Features

- FastAPI icon service
- Search and pagination
- Basic caching
- Icon SVG serving

### Phase 4: Event System & Cross-Service Communication

- PostgreSQL NOTIFY/LISTEN implementation
- Event handlers and triggers
- User lifecycle management
- Usage tracking

### Phase 5: Performance Optimization & Batching

- Batch API endpoints
- Advanced caching strategies
- Usage analytics
- Search optimization

### Phase 6: Frontend Integration & Advanced Features

- Updated frontend services
- Infinite scroll with batching
- Real-time updates
- Performance monitoring

## Success Criteria

Each phase must meet these criteria before proceeding:

- **Functional**: Core features work as specified
- **Tested**: Unit and integration tests pass
- **Documented**: API endpoints documented
- **Deployable**: Docker compose up/down works
- **Monitored**: Health checks and logging in place

## Next Steps

Begin with Phase 1 implementation files. Each phase document will contain:

- Detailed requirements
- Implementation code
- Testing strategies
- Deployment instructions
- Migration path to next phase

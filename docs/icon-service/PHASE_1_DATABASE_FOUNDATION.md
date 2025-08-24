# Phase 1: Database Foundation & PostgREST Setup

## Overview

Phase 1 establishes the database foundation for the Icon Service system. This phase creates the PostgreSQL schema, sets up PostgREST for automatic API generation, and provides basic icon metadata storage with simple REST endpoints.

## Objectives

- Create shared PostgreSQL database schema for icon metadata
- Configure PostgREST for automatic REST API generation
- Establish database roles and permissions
- Provide basic CRUD operations for icon packs and metadata
- Set up Docker Compose infrastructure

## Architecture Components

```text
┌─────────────────┐
│   PostgREST     │
│                 │
│ - Auto REST API │
│ - JWT Auth      │
│ - Query Builder │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│                 │
│ - Icon Schema   │
│ - API Views     │
│ - Permissions   │
└─────────────────┘
```

## Implementation Requirements

### 1. Database Schema Design

Create the foundational schema for icon management:

- `icon_packs` table for organizing icon collections
- `icon_metadata` table for individual icon information
- Database views for PostgREST API exposure
- Proper indexing for search performance
- Role-based access control

### 2. PostgREST Configuration

- Configure PostgREST to expose database via REST API
- Set up authentication and authorization
- Define API schema and endpoints
- Configure CORS for frontend access

### 3. Docker Infrastructure

- PostgreSQL container with proper configuration
- PostgREST container with database connection
- Network configuration for service communication
- Volume management for data persistence

### 4. Basic API Endpoints

PostgREST will automatically provide:

- `GET /icon_packs` - List all icon packs
- `GET /icon_metadata` - List icon metadata with filtering
- `POST /rpc/search_icons` - Search function for icons
- Standard REST operations with query parameters

## Implementation Files

### File 1: `docker-compose.phase1.yml`

Docker Compose configuration for Phase 1 infrastructure.

**Purpose**: Set up PostgreSQL and PostgREST containers with proper networking and configuration.

**Key Features**:
- PostgreSQL 15 with proper environment variables
- PostgREST container configured for the database
- Network isolation and port mapping
- Volume management for data persistence

### File 2: `migrations/001_icon_schema.sql`

Database schema creation script.

**Purpose**: Create the foundational database schema for icon management.

**Key Features**:
- Icon packs table with metadata
- Icon metadata table with search optimization
- Database indexes for performance
- Initial data constraints and relationships

### File 3: `migrations/002_postgrest_setup.sql`

PostgREST-specific database setup.

**Purpose**: Configure database roles, permissions, and API views for PostgREST.

**Key Features**:
- API schema creation
- Database roles (anon, authenticated)
- Views for PostgREST exposure
- RPC functions for complex operations

### File 4: `config/postgrest.conf`

PostgREST configuration file.

**Purpose**: Configure PostgREST behavior, authentication, and API settings.

**Key Features**:
- Database connection settings
- JWT authentication configuration
- API schema and role configuration
- CORS and security settings

### File 5: `scripts/setup-phase1.sh`

Setup script for Phase 1 deployment.

**Purpose**: Automate the deployment and configuration of Phase 1 components.

**Key Features**:
- Database initialization
- Migration execution
- Service health checks
- Verification tests

## Success Criteria

Phase 1 is complete when:

- [ ] PostgreSQL database is running with icon schema
- [ ] PostgREST is generating REST API from schema
- [ ] Basic CRUD operations work via HTTP requests
- [ ] Search function returns paginated results
- [ ] Docker Compose can start/stop all services
- [ ] Health checks pass for all services
- [ ] API documentation is accessible via PostgREST

## Testing Strategy

### Unit Tests
- Database schema validation
- Constraint testing
- Index performance verification

### Integration Tests
- PostgREST API endpoint testing
- Authentication and authorization
- Cross-service communication

### Performance Tests
- Database query performance
- API response times
- Concurrent request handling

## API Examples

After Phase 1 completion, these endpoints will be available:

```bash
# Get all icon packs
curl http://localhost:3001/icon_packs

# Search icons with filtering
curl -X POST http://localhost:3001/rpc/search_icons \
  -H "Content-Type: application/json" \
  -d '{"search_term": "aws", "category_filter": "all", "page_num": 0}'

# Get specific icon metadata
curl "http://localhost:3001/icon_metadata?prefix=eq.awssvg&limit=10"
```

## Migration to Phase 2

Phase 1 provides the database foundation. Phase 2 will add:

- Icon extraction from Node.js packages
- Data population scripts
- Multi-stage Docker builds
- Actual icon content processing

The database schema created in Phase 1 will be populated with real icon data in Phase 2.

## Troubleshooting

Common issues and solutions:

- **PostgREST connection fails**: Check DATABASE_URL and PostgreSQL status
- **Permission denied**: Verify database roles and schema permissions
- **API returns empty**: Ensure database is populated and views are correct
- **CORS errors**: Configure PostgREST CORS settings properly

## Dependencies

- PostgreSQL 15+
- PostgREST v12+
- Docker & Docker Compose
- curl (for testing)

## Configuration Variables

Environment variables used in this phase:

- `POSTGRES_DB`: Database name (default: markdown_manager_shared)
- `POSTGRES_USER`: Database user (default: postgres)
- `POSTGRES_PASSWORD`: Database password
- `PGRST_DB_URI`: PostgREST database connection string
- `PGRST_DB_SCHEMA`: API schema name (default: api)
- `PGRST_JWT_SECRET`: JWT secret for authentication

# Phase 2 — Docker Configuration Update (Agent Scope)

## Goal
Update all Docker-related configurations to reference the new service paths and names. This includes docker-compose.yml, Dockerfiles, and any Docker-specific scripts.

## Files to Update

### Primary Targets
1. `docker-compose.yml` - Main Docker Compose configuration
2. `services/*/Dockerfile` - Individual service Dockerfiles
3. `.dockerignore` files (if any)
4. Any Docker build scripts

## Tasks

### 1. Update docker-compose.yml

#### Service Build Contexts
Update build contexts to reference new paths:

```yaml
# Before
build:
  context: ./backend
  dockerfile: Dockerfile

# After
build:
  context: ./services/backend
  dockerfile: Dockerfile
```

#### Volume Mounts
Update volume mount paths:

```yaml
# Before
volumes:
  - ./backend/app:/markdown_manager/app
  - ./markdown-lint-service/consumer.config.json:/app/config/consumer.config.json:ro

# After
volumes:
  - ./services/backend/app:/markdown_manager/app
  - ./services/linting/consumer.config.json:/app/config/consumer.config.json:ro
```

#### Service Dependencies
Update service names in depends_on sections:

```yaml
# Update any references to:
# - relay-service → event-publisher
# - markdown-lint-consumer → linting-consumer
# - spell-check-consumer → spell-check-consumer
```

### 2. Update Consumer Service References

#### Consumer Dockerfile References
Update references to consumer-service-base:

```yaml
# Before
dockerfile: ./consumer-service-base/Dockerfile

# After
dockerfile: ./services/event-consumer/Dockerfile
```

### 3. Update Service Names and Container Names

#### Rename Docker Services
- `relay-service` → `event-publisher`
- Keep other service names consistent with directory names

#### Update Internal Networking
Ensure service-to-service communication uses correct hostnames:

```yaml
# Services should reference each other by Docker service names
# Backend should reach export service at: http://export-service:8001
# Update any environment variables that reference service hostnames
```

### 4. Verify Build Contexts
Ensure all build contexts point to correct directories:
- `./services/backend`
- `./services/frontend`
- `./services/export`
- `./services/linting`
- `./services/spell-check`
- `./services/event-consumer`
- `./services/event-publisher`

## Deliverables
1. Updated `docker-compose.yml` with all new service paths
2. All volume mounts corrected to new paths
3. Service dependencies updated with new names
4. Consumer service Docker references updated
5. Validation that `docker-compose build` succeeds
6. Validation that `docker-compose up` starts all services

## Testing

### Build Test
```bash
docker-compose build --no-cache
```

### Service Start Test
```bash
docker-compose up -d
docker-compose ps
```

### Network Connectivity Test
```bash
# Test inter-service communication
docker-compose exec backend curl http://export-service:8001/health
docker-compose exec backend curl http://linting-service:8002/health
```

## Exit Criteria
- ✅ `docker-compose build` completes without errors
- ✅ `docker-compose up -d` starts all services successfully
- ✅ All services show "healthy" status in `docker-compose ps`
- ✅ Inter-service communication works (health checks pass)
- ✅ Volume mounts correctly map to new service paths
- ✅ No references to old service paths remain in Docker configs

## Agent Prompt Template
```
You are tasked with Phase 2 of the services refactor: Docker Configuration Update.

Your goal is to:
1. Update docker-compose.yml to reference new service paths
2. Update all volume mounts to new locations
3. Rename Docker services (relay-service → event-publisher)
4. Verify all builds and starts work correctly

Test thoroughly:
- Run docker-compose build
- Run docker-compose up -d
- Verify all services are healthy
- Test inter-service communication

Document any networking or dependency issues found.
```

## Common Issues

### Volume Mount Errors
- Check for absolute vs relative paths
- Ensure source paths exist after directory moves

### Service Name Resolution
- Docker internal DNS uses service names from docker-compose.yml
- Update environment variables that reference service hostnames

### Build Context Problems
- Verify Dockerfile locations within new service directories
- Check for any COPY commands that reference old paths

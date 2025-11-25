# Services Directory Migration Guide

This guide helps existing developers adapt to the new unified services directory structure implemented in the `service-organization` branch.

## What Changed

The application has been refactored to consolidate all services under a single `services/` directory with consistent naming:

### Directory Changes

| Old Path | New Path | Notes |
|----------|----------|-------|
| `backend/` | `services/backend/` | FastAPI backend service |
| `frontend/` | `services/ui/` | React frontend application |
| `export-service/` | `services/export/` | PDF/diagram export service |
| `markdown-lint-service/` | `services/linting/` | Markdown linting service |
| `spell-check-service/` | `services/spell-check/` | Spell checking service |
| `consumer-service-base/` | `services/event-consumer/` | Event consumer framework |
| `relay-service/` | `services/event-publisher/` | Event publishing service |

### Docker Service Names

Docker Compose service names have been updated for consistency:

| Old Service Name | New Service Name | Port |
|------------------|------------------|------|
| `export-service` | `export` | 8001 |
| `markdown-lint-service` | `linting` | 8002 |
| `spell-check-service` | `spell-check` | 8003 |
| `relay-service` | `event-publisher` | 8080 |

## Developer Actions Required

### 1. Update Local Environment

If you have existing development environment:

```bash
# Stop existing containers
docker compose down

# Pull latest changes
git checkout service-organization
git pull origin service-organization

# Rebuild with new structure
docker compose build
docker compose up -d
```

### 2. Update IDE/Editor Configuration

- **Path References**: Update any IDE workspace configurations pointing to old service directories
- **Debugging Configurations**: Update debugger configurations to use new service paths
- **Scripts**: Update any personal development scripts that reference old paths

### 3. Environment Variables

If you have custom `.env` files, update service URLs:

**Old:**
```bash
EXPORT_SERVICE_URL=http://export-service:8001
MARKDOWN_LINT_SERVICE_URL=http://markdown-lint-service:8002
SPELL_CHECK_SERVICE_URL=http://spell-check-service:8003
```

**New:**
```bash
EXPORT_SERVICE_URL=http://export:8001
LINTING_SERVICE_URL=http://linting:8002  
SPELL_CHECK_SERVICE_URL=http://spell-check:8003
```

### 4. Documentation References

- Service documentation is now located under `services/*/README.md`
- Main documentation links have been updated in the root README.md
- Deployment guides reflect new service structure

## What Didn't Change

- **API Endpoints**: All REST API endpoints remain the same
- **Database Schema**: No database changes required
- **Application Logic**: Service functionality is identical
- **Development Workflow**: `make dev`, `make build`, etc. commands work the same
- **Docker Images**: Production Docker images maintain backward compatibility

## Verification Steps

After updating your environment, verify everything works:

```bash
# Check all services are running
make status

# Test service health checks
curl http://localhost:8000/health    # Backend
curl http://localhost:8001/health    # Export
curl http://localhost:8002/health    # Linting
curl http://localhost:8003/health    # Spell check

# Access the application
open http://localhost  # Frontend via Nginx
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: If you have containers from the old structure still running:
   ```bash
   docker ps -a
   docker rm $(docker ps -aq)  # Remove all stopped containers
   ```

2. **Volume Mount Errors**: Clear old volumes if needed:
   ```bash
   docker compose down -v
   docker volume prune
   ```

3. **Build Failures**: Clean Docker cache:
   ```bash
   docker system prune -f
   docker compose build --no-cache
   ```

### Getting Help

- **Documentation**: Check updated docs in `docs/development/` and `docs/deployment/`
- **Service Issues**: Individual service READMEs are now in `services/*/README.md`
- **Architecture**: Root README.md has updated service architecture diagrams

## Timeline

- **Migration Completed**: Phase 8 of services refactor (November 2025)
- **Backward Compatibility**: Legacy environment variables are supported during transition period
- **Future**: Old service references will be removed in future releases

This migration maintains full functionality while providing a cleaner, more maintainable service organization structure.
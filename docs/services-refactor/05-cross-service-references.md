# Phase 5 — Cross-Service References Update (Agent Scope)

## Goal
Update all cross-service references including Nginx configurations, backend settings, and inter-service communication to use new service paths and names. This phase ensures services can communicate properly with the new structure.

## Files to Update

### Primary Targets
1. `nginx/nginx-dev.conf` - Development reverse proxy configuration
2. `nginx/sites-available/` - Production Nginx configurations
3. `services/backend/app/configs/settings.py` - Backend service URLs
4. Environment files and configuration references
5. Any hardcoded service references in application code

## Tasks

### 1. Update Nginx Development Configuration

#### Update nginx-dev.conf
Update service routing to reference new Docker service names:

```nginx
# Before
location /api/export/ {
    proxy_pass http://export-service:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /api/markdown-lint/ {
    proxy_pass http://markdown-lint-service:8002/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# After
location /api/export/ {
    proxy_pass http://export-service:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /api/markdown-lint/ {
    proxy_pass http://linting-service:8002/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Note:** Docker service names in docker-compose.yml may stay as `export-service`, `linting-service` etc. for internal networking, while directories are `services/export/`, `services/linting/`.

### 2. Update Backend Service Configuration

#### Update settings.py
Update service URL configurations:

```python
# Before
export_service_url: str = Field(
    default="http://export-service:8001", description="Export service URL"
)

markdown_lint_service_url: str = Field(
    default="http://markdown-lint-service:8002", description="Markdown lint service URL"
)

spell_check_service_url: str = Field(
    default="http://spell-check-service:8003", description="Spell check service URL"
)

# After (if Docker service names change)
export_service_url: str = Field(
    default="http://export-service:8001", description="Export service URL"
)

linting_service_url: str = Field(
    default="http://linting-service:8002", description="Linting service URL"
)

spell_check_service_url: str = Field(
    default="http://spell-check-service:8003", description="Spell check service URL"
)
```

### 3. Update Production Nginx Configuration

#### Update sites-available configurations
Update production Nginx configurations to route to correct services:

```nginx
# Production routing (typically uses localhost ports)
location /api/export/ {
    proxy_pass http://localhost:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /api/linting/ {
    proxy_pass http://localhost:8002/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. Update Environment Variables

#### Docker Compose Environment Variables
Update any environment variables that reference service names:

```yaml
# Update service URL environment variables
environment:
  - EXPORT_SERVICE_URL=http://export-service:8001
  - LINTING_SERVICE_URL=http://linting-service:8002
  - SPELL_CHECK_SERVICE_URL=http://spell-check-service:8003
  - EVENT_PUBLISHER_SERVICE_URL=http://event-publisher:8000
```

#### Production Environment Files
Update production environment files:

```bash
# /etc/markdown-manager.env
EXPORT_SERVICE_URL=http://localhost:8001
LINTING_SERVICE_URL=http://localhost:8002
SPELL_CHECK_SERVICE_URL=http://localhost:8003
```

### 5. Update Inter-Service Communication

#### Backend Service References
Scan backend code for hardcoded service references:

```python
# Look for patterns like:
# httpx.get("http://export-service:8001/...")
# requests.post("http://markdown-lint-service:8002/...")

# Update to use configuration values instead:
# httpx.get(f"{settings.export_service_url}/...")
# requests.post(f"{settings.linting_service_url}/...")
```

#### Frontend Service References
Update frontend service API calls if they reference service names:

```javascript
// Look for hardcoded service references in frontend
// Update API_BASE_URL or similar constants
```

### 6. Update Health Check Endpoints

#### Service Health Checks
Update health check configurations to use correct service names:

```yaml
# Docker Compose health checks
healthcheck:
  test: ["CMD", "curl", "-f", "http://linting-service:8002/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Deliverables
1. Updated Nginx development configuration with correct service routing
2. Updated backend settings.py with new service URLs
3. Updated production Nginx configurations
4. Updated environment variables for service URLs
5. Scanned and updated inter-service communication references
6. Updated health check endpoints
7. Validation that services can communicate correctly
8. Updated API documentation with new service references

## Testing

### Service Communication Test
```bash
# Test service-to-service communication
docker-compose up -d

# Test backend can reach export service
docker-compose exec backend curl http://export-service:8001/health

# Test backend can reach linting service
docker-compose exec backend curl http://linting-service:8002/health

# Test backend can reach spell check service
docker-compose exec backend curl http://spell-check-service:8003/health
```

### Nginx Routing Test
```bash
# Test Nginx routing
curl http://localhost/api/export/health
curl http://localhost/api/markdown-lint/health
curl http://localhost/api/spell-check/health
```

### Frontend Integration Test
```bash
# Test frontend can reach backend APIs
curl http://localhost:3000/api/health
```

## Exit Criteria
- ✅ Nginx development configuration routes correctly to all services
- ✅ Backend settings.py uses correct service URLs
- ✅ Production Nginx configuration updated
- ✅ Environment variables reference correct service names
- ✅ Inter-service communication works (health checks pass)
- ✅ Frontend can reach backend APIs through Nginx
- ✅ No hardcoded service references remain in application code
- ✅ All service health checks pass

## Agent Prompt Template
```text
You are tasked with Phase 5 of the services refactor: Cross-Service References Update.

Your goal is to:
1. Update Nginx configurations to route to correct services
2. Update backend settings.py service URLs
3. Update environment variables for service communication
4. Scan and update any hardcoded service references
5. Verify inter-service communication works

Test thoroughly:
- Run docker-compose up -d
- Test service-to-service communication
- Test Nginx routing with curl commands
- Verify frontend can reach APIs

Document any communication or routing issues found.
```

## Common Issues

### Docker Service Names vs Directory Names
- Docker service names in docker-compose.yml may differ from directory names
- Use `docker-compose ps` to verify actual service names
- Update Nginx to reference correct Docker service names

### Port Conflicts
- Verify no port conflicts exist between services
- Check that health check ports match service configurations

### Network Connectivity
- Ensure all services are on the same Docker network
- Verify firewall rules don't block inter-service communication

### Environment Variable Precedence
- Check that environment variables override default values correctly
- Verify production vs development environment differences

# Service Health Check Guidelines

This document defines the health check architecture and patterns for the Markdown Manager system.

## Health Check Architecture

### Master Health Check

The backend service provides a master health check endpoint at `GET /health` that aggregates the health status of all system components:

- **Database** - PostgreSQL connectivity
- **Redis** - Redis server health and configuration
- **Export Service** - PDF/diagram export service  
- **Icon Service** - Icon management service
- **Linting Service** - Markdown linting service
- **Spell-check Service** - Spell checking service
- **Event Publisher Service** - Event publishing service
- **Event Consumers** - All Redis stream consumers (automatically discovered)

### Service-Level Health Checks

Each service should implement its own `/health` endpoint that returns:

```json
{
  "status": "healthy|degraded|unhealthy",
  "service": "service-name",
  "timestamp": "2026-01-30T12:00:00Z",
  "version": "1.0.0"
}
```

Optional `/health/detailed` endpoint for more information:

```json
{
  "status": "healthy",
  "service": "service-name", 
  "timestamp": "2026-01-30T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "details": "Connected"
    }
  }
}
```

### Event Consumer Health

**Event consumers do not need HTTP health endpoints.** The master health check automatically discovers and monitors all Redis stream consumers by:

1. Scanning Redis for all streams
2. Checking consumer groups on each stream  
3. Evaluating consumer activity based on:
   - **Idle time**: < 5 minutes (allows for processing delays)
   - **Pending messages**: < 50 (not severely backlogged)
4. Reporting aggregate consumer health

**Consumer Health Criteria:**
- **Healthy**: Active consumers with reasonable idle time and manageable backlog
- **Degraded**: Some consumers inactive or high backlog
- **Unhealthy**: No active consumers or severe issues

**Cleanup Considerations:**
- Remove stale consumer groups periodically: `XGROUP DESTROY <stream> <group>`
- Monitor for duplicate groups from development/testing
- Check for orphaned streams that should be cleaned up

## Implementation Guidelines

### For New HTTP Services

1. **Add a `/health` endpoint** that returns basic status
2. **Add the service URL to backend settings** if needed
3. **Update the master health check** in `services/backend/app/routers/default.py` to include your service
4. **Add Docker healthcheck** in docker-compose.yml

Example service addition to master health check:

```python
# Check your-service health
try:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(f"{settings.your_service_url}/health")
        if response.status_code == 200:
            services["your_service"] = ServiceHealth(
                status="healthy", details="Responsive"
            )
        else:
            services["your_service"] = ServiceHealth(
                status="unhealthy", details=f"HTTP {response.status_code}"
            )
            overall_status = "degraded"
except Exception as e:
    services["your_service"] = ServiceHealth(
        status="unhealthy", details=f"Health check failed: {str(e)}"
    )
    overall_status = "degraded"
```

### For Event Consumer Services

**Do not add HTTP endpoints to event consumers.** They are automatically monitored via Redis stream inspection.

If you create a new service that uses event consumers:

1. **Configure the consumer** using the event-consumer template
2. **Add appropriate consumer.config.json** 
3. **Add to docker-compose.yml** with Redis health check
4. **Consumers will be automatically discovered** by the master health check

### Health Status Levels

- **healthy**: Service is fully operational
- **degraded**: Service is operational but with issues (some components failing)
- **unhealthy**: Service is not operational

### Timeout Guidelines

- Service-to-service health checks: 5 seconds
- Master health check timeout: 10 seconds total
- Docker health check intervals: 30 seconds

## Monitoring Integration

The master health check at `GET /health` provides a single endpoint for:

- Load balancer health checks
- Monitoring system integration  
- CI/CD pipeline validation
- Operations dashboard integration

## Examples

### Basic Service Health Check (Node.js)
```javascript
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'your-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
```

### Detailed Service Health Check (Python/FastAPI)
```python
@app.get("/health/detailed")
async def detailed_health_check():
    services = {}
    overall_status = "healthy"
    
    # Check your dependencies
    try:
        # Check database, external APIs, etc.
        services["database"] = {"status": "healthy", "details": "Connected"}
    except Exception as e:
        services["database"] = {"status": "unhealthy", "details": str(e)}
        overall_status = "degraded"
    
    return {
        "status": overall_status,
        "service": "your-service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "services": services
    }
```
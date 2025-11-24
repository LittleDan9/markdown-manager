# Phase 7 — Integration Testing (Agent Scope)

## Goal
Validate that all services work together correctly with the new directory structure and naming conventions. This phase ensures the refactor hasn't broken any functionality and all systems integrate properly.

## Testing Scope

### Service Integration
1. Docker Compose development environment
2. Service-to-service communication
3. Event-driven communication (Redis Streams)
4. Database connectivity and migrations
5. Frontend-to-backend API communication
6. File system operations and document management

### Production Simulation
1. Systemd service management
2. Nginx routing and load balancing
3. Container health checks and restarts
4. Configuration file deployment
5. Log aggregation and monitoring

## Test Categories

### 1. Infrastructure Tests

#### Docker Compose Startup
```bash
# Clean environment test
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Verify all services start
docker-compose ps

# Check for healthy status
docker-compose ps | grep -v "Up (healthy)" | grep -v "CONTAINER"
```

#### Service Health Checks
```bash
# Test individual service health endpoints
curl -f http://localhost:8000/health  # Backend
curl -f http://localhost:8001/health  # Export
curl -f http://localhost:8002/health  # Linting
curl -f http://localhost:8003/health  # Spell Check

# Test through Nginx proxy
curl -f http://localhost/api/health
curl -f http://localhost/api/export/health
curl -f http://localhost/api/markdown-lint/health
curl -f http://localhost/api/spell-check/health
```

### 2. Database and Migration Tests

#### Database Connectivity
```bash
# Test database connections from each service
docker-compose exec backend python -c "from app.database import get_db; print('Backend DB: OK')"
docker-compose exec event-publisher python -c "import asyncio; from app.config import Settings; print('Event Publisher DB: OK')"
```

#### Migration Execution
```bash
# Test database migrations
docker-compose exec backend alembic current
docker-compose exec backend alembic check
```

### 3. Event-Driven Communication Tests

#### Redis Connectivity
```bash
# Test Redis connections
docker-compose exec redis redis-cli ping
docker-compose exec backend python -c "import redis; r=redis.Redis(host='redis'); print('Redis:', r.ping())"
```

#### Event Publisher Tests
```bash
# Test event publisher is processing outbox
docker-compose logs event-publisher | grep -i "processed.*events"

# Test Redis streams have events
docker-compose exec redis redis-cli XLEN identity.user.v1
```

#### Consumer Service Tests
```bash
# Test linting consumer is processing events
docker-compose logs linting-consumer | grep -i "processed.*events"

# Test spell-check consumer is processing events
docker-compose logs spell-check-consumer | grep -i "processed.*events"

# Check consumer group status
docker-compose exec redis redis-cli XINFO GROUPS identity.user.v1
```

### 4. API Integration Tests

#### Backend API Tests
```bash
# Test core API endpoints
curl -X GET http://localhost:8000/api/users/me -H "Authorization: Bearer test_token"
curl -X GET http://localhost:8000/api/documents
curl -X GET http://localhost:8000/api/categories
```

#### Service Integration Tests
```bash
# Test export service integration
curl -X POST http://localhost:8000/api/export/pdf \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Test</h1>", "css": "h1{color:red}"}'

# Test linting service integration
curl -X POST http://localhost:8000/api/lint \
  -H "Content-Type: application/json" \
  -d '{"text": "# Test Header", "rules": {"MD001": true}}'

# Test spell check service integration
curl -X POST http://localhost:8000/api/spell-check \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test sentance with an error."}'
```

### 5. Frontend Integration Tests

#### Frontend Startup
```bash
# Test frontend builds and starts
docker-compose logs frontend | grep -i "compiled successfully"
curl -f http://localhost:3000/
```

#### API Communication
```bash
# Test frontend can reach backend APIs
curl -f http://localhost:3000/api/health
curl -f http://localhost:3000/api/documents
```

### 6. File System and Document Tests

#### Document Operations
```bash
# Test document creation and retrieval
# (These would be actual API calls to test document CRUD)
```

#### File Storage
```bash
# Verify file storage locations are correct
docker-compose exec backend ls -la /app/storage/
```

### 7. Configuration and Environment Tests

#### Consumer Configuration Loading
```bash
# Test consumer configurations load correctly
docker-compose exec linting-consumer python -c "import json; config=json.load(open('/app/config/consumer.config.json')); print('Linting config:', config['service']['name'])"
docker-compose exec spell-check-consumer python -c "import json; config=json.load(open('/app/config/consumer.config.json')); print('Spell check config:', config['service']['name'])"
```

#### Environment Variable Tests
```bash
# Test environment variables are set correctly
docker-compose exec backend env | grep -E "(EXPORT_SERVICE_URL|LINTING_SERVICE_URL|SPELL_CHECK_SERVICE_URL)"
```

## Automated Test Suite

### Create Test Script
```bash
#!/bin/bash
# integration-test.sh

set -e

echo "🧪 Starting Services Refactor Integration Tests"

# Test 1: Infrastructure
echo "1️⃣ Testing Infrastructure..."
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
sleep 30

# Verify all services are up
if ! docker-compose ps | grep -q "Up (healthy)"; then
  echo "❌ Some services are not healthy"
  docker-compose ps
  exit 1
fi
echo "✅ All services started successfully"

# Test 2: Health Checks
echo "2️⃣ Testing Health Endpoints..."
for port in 8000 8001 8002 8003; do
  if ! curl -f http://localhost:$port/health > /dev/null 2>&1; then
    echo "❌ Service on port $port health check failed"
    exit 1
  fi
done
echo "✅ All health checks passed"

# Test 3: Database Connectivity
echo "3️⃣ Testing Database Connectivity..."
if ! docker-compose exec -T backend python -c "from app.database import get_db; print('OK')" > /dev/null 2>&1; then
  echo "❌ Backend database connection failed"
  exit 1
fi
echo "✅ Database connectivity verified"

# Test 4: Redis Connectivity
echo "4️⃣ Testing Redis Connectivity..."
if ! docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo "❌ Redis connection failed"
  exit 1
fi
echo "✅ Redis connectivity verified"

# Test 5: Inter-Service Communication
echo "5️⃣ Testing Inter-Service Communication..."
if ! docker-compose exec -T backend curl -f http://export-service:8001/health > /dev/null 2>&1; then
  echo "❌ Backend to Export service communication failed"
  exit 1
fi
echo "✅ Inter-service communication verified"

echo "🎉 All integration tests passed!"
```

## Performance Tests

### Load Testing
```bash
# Test service performance under load
# Use tools like ab, wrk, or hey
ab -n 100 -c 10 http://localhost:8000/api/health
ab -n 50 -c 5 http://localhost:8001/health
```

### Memory and Resource Usage
```bash
# Monitor resource usage
docker stats --no-stream

# Check for memory leaks
docker-compose exec backend ps aux
```

## Deliverables
1. Comprehensive integration test suite
2. Automated testing script
3. Performance benchmarks
4. Service health validation
5. Event-driven communication verification
6. Database connectivity confirmation
7. API integration validation
8. Frontend-backend integration verification
9. Configuration loading verification
10. Test results documentation

## Exit Criteria
- ✅ All services start successfully with docker-compose
- ✅ All health checks pass
- ✅ Database connections work from all services
- ✅ Redis connectivity verified
- ✅ Event publisher processes outbox events
- ✅ Consumer services process events correctly
- ✅ Inter-service communication functional
- ✅ API endpoints respond correctly
- ✅ Frontend loads and communicates with backend
- ✅ Consumer configurations load properly
- ✅ No error logs in service startup
- ✅ Performance benchmarks meet expectations

## Agent Prompt Template
```text
You are tasked with Phase 7 of the services refactor: Integration Testing.

Your goal is to:
1. Create comprehensive integration tests for all services
2. Verify docker-compose environment works completely
3. Test service-to-service communication
4. Validate event-driven communication (Redis Streams)
5. Test API endpoints and frontend integration
6. Create automated test suite

Test systematically:
- Start with infrastructure (Docker, databases, Redis)
- Test individual service health
- Test service communication
- Test end-to-end workflows
- Create reusable test scripts

Document any integration issues or performance problems found.
```

## Troubleshooting Guide

### Common Issues

#### Service Startup Failures
```bash
# Check logs for startup errors
docker-compose logs service-name

# Check resource constraints
docker stats
```

#### Network Connectivity Issues
```bash
# Verify Docker networks
docker network ls
docker network inspect markdown-manager_default

# Test DNS resolution
docker-compose exec backend nslookup export-service
```

#### Database Connection Problems
```bash
# Check database status
docker-compose exec db pg_isready

# Verify connection strings
docker-compose exec backend env | grep DATABASE_URL
```

#### Redis Stream Issues
```bash
# Check Redis streams
docker-compose exec redis redis-cli XINFO STREAM identity.user.v1

# Check consumer groups
docker-compose exec redis redis-cli XINFO GROUPS identity.user.v1
```

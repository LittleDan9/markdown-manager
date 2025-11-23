# Development Guide

This guide covers local development setup, workflows, and best practices for the Markdown Manager application.

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose**: For containerized development environment
- **Node.js 18+**: For frontend development and Node.js services
- **Python 3.11+**: For backend development
- **Make**: For build automation
- **Git**: Version control

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/LittleDan9/markdown-manager.git
   cd markdown-manager
   ```

2. **Install dependencies**
   ```bash
   make install
   ```

3. **Start development environment**
   ```bash
   make dev
   ```

4. **Verify services are running**
   ```bash
   make status
   ```

## 🏗️ Development Architecture

The development environment uses Docker Compose to orchestrate all services with hot-reload capabilities:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Development Environment                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Nginx     │  │  Frontend   │  │ Backend API │  │   Export Service    │  │
│  │ (Port 80)   │  │(Port 3000)  │  │(Port 8000)  │  │   (Port 8001)       │  │
│  │             │  │ Hot Reload  │  │ Hot Reload  │  │   Hot Reload        │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                            │                                │
│  ┌─────────────┐  ┌─────────────┐         │         ┌─────────────────────┐  │
│  │ Lint Service│  │Spell Service│         │         │    PostgreSQL       │  │
│  │(Port 8002)  │  │(Port 8003)  │         └─────────┤   (Port 5432)       │  │
│  │ Hot Reload  │  │ Hot Reload  │                   │  Persistent Data    │  │
│  └─────────────┘  └─────────────┘                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Configuration

Each service is configured for optimal development experience:

#### Frontend (React/Webpack)
- **Port**: 3000
- **Hot Reload**: Enabled with CHOKIDAR_USEPOLLING
- **Volume Mounts**: `./frontend:/app` for live code updates
- **Node Modules Cache**: Tmpfs for faster installs (5GB allocated)
- **Health Check**: Automated service readiness detection

#### Backend (FastAPI/Python)
- **Port**: 8000
- **Hot Reload**: Via uvicorn with file watching
- **Volume Mounts**:
  - `./backend/app:/markdown_manager/app` for code updates
  - `./storage:/documents` for document storage
- **Environment**: Development mode with debug enabled
- **Database**: PostgreSQL with persistent volume

#### Export Service (Python/Playwright)
- **Port**: 8001
- **Volume Mounts**: `./export-service/app` for live code updates
- **Browser Engine**: Playwright Chromium for PDF/PNG generation
- **Dependencies**: All export libraries pre-installed

#### Microservices (Node.js)
- **Markdown Lint Service** (Port 8002): Real-time markdown validation
- **Spell Check Service** (Port 8003): Grammar and spell checking
- **Hot Reload**: Nodemon for automatic restarts
- **Volume Mounts**: Source code mounted for live updates

## 🔧 Configuration Management

### Environment Variables

Development configuration is managed through multiple layers:

#### Backend Configuration (`backend/.env`)
```bash
# Environment
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/markdown_manager

# Security (development keys - change in production)
SECRET_KEY=development-secret-key-change-in-production-make-it-long-and-random-12345
SECURE_COOKIES=false

# Service URLs
EXPORT_SERVICE_URL=http://export-service:8001
MARKDOWN_LINT_SERVICE_URL=http://markdown-lint-service:8002
SPELL_CHECK_SERVICE_URL=http://spell-check-service:8003

# GitHub OAuth (development)
GITHUB_CLIENT_ID=Ov23likBCpFdyxJhTjRL
GITHUB_CLIENT_SECRET=a8916caf58825c1269549e13f88a903973967efe
GITHUB_REDIRECT_URI=http://localhost/api/github/auth/callback

# Storage
CONTAINER_STORAGE_ROOT=/documents
HOST_STORAGE_ROOT=./documents
```

#### Docker Compose Environment
```yaml
# Service-specific environment variables
environment:
  - CHOKIDAR_USEPOLLING=true  # Frontend hot reload
  - NODE_ENV=development      # Node.js services
  - PYTHONUNBUFFERED=1       # Python service logging
  - DEBUG_PASSWORD_RESET_TOKEN=true
```

### Configuration Hierarchy

1. **Docker Compose**: Service-level environment variables
2. **Environment Files**: `.env` files for each service
3. **Default Values**: Hardcoded fallbacks in application code

## 📊 Logging and Debugging

The development environment includes comprehensive logging across all services:

### Backend Logging (Python)

**Structured Logging with Request IDs:**
```python
# Enhanced middleware logging
logger.info(
    "Incoming request",
    extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "client_ip": client_ip,
        "process_time_ms": round(process_time * 1000, 2),
    },
)
```

**Features:**
- Unique request IDs for tracing across services
- Structured logging with JSON-compatible extra fields
- Client IP extraction (supports reverse proxy headers)
- Request/response timing
- Error tracking with stack traces
- Health check path filtering

### Frontend Logging (React)

**Log Level Management:**
```javascript
// Automatic development/production detection
const isDevelopment = (
  window.location.hostname === "localhost" ||
  window.location.port === "3000"
);

// Service-specific loggers
const logger = useLogger('EditorService');
logger.debug('Component mounted with props:', props);
```

**Features:**
- Environment-aware log levels (DEBUG in dev, WARN in prod)
- Service-specific loggers with namespacing
- localStorage override for production debugging
- Console interception with timestamp formatting
- React Context integration

### Node.js Services Logging

**Request/Response Tracking:**
```javascript
// Performance monitoring
console.log(`[Performance] ${req.method} ${req.path} - ${durationMs.toFixed(2)}ms, Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

// Memory usage alerts
if (memUsage.heapUsed > 500 * 1024 * 1024) {
  console.warn(`High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}
```

**Features:**
- Request timing and memory monitoring
- Enhanced logging for development mode
- Performance alerts for slow requests (>5s)
- Memory usage tracking and warnings
- Configurable body/header logging

## 🛠️ Development Workflows

### Daily Development

1. **Start environment**
   ```bash
   make dev
   ```

2. **Check service status**
   ```bash
   make status
   # Shows which services are running on which ports
   ```

3. **View logs**
   ```bash
   # All services
   docker compose logs -f

   # Specific service
   docker compose logs -f backend
   docker compose logs -f frontend
   ```

4. **Stop environment**
   ```bash
   make stop
   ```

### Frontend Development

- **Hot Reload**: Automatic browser refresh on file changes
- **Access**: http://localhost (via Nginx) or http://localhost:3000 (direct)
- **Webpack Dev Server**: Configured with source maps and hot module replacement
- **Polling**: Enabled for file system compatibility across platforms

### Backend Development

- **Hot Reload**: Uvicorn automatically restarts on Python file changes
- **API Documentation**: http://localhost/api/docs (Swagger UI)
- **Database**: PostgreSQL accessible on localhost:5432
- **Debugging**: Python debugger support with volume-mounted source

### Database Development

```bash
# Connect to PostgreSQL
docker compose exec db psql -U postgres -d markdown_manager

# View database logs
docker compose logs db

# Reset database (destructive)
docker compose down
docker volume rm markdown-manager_postgres-data
docker compose up -d db
```

### Service Testing

```bash
# Run all tests
make test

# Backend tests only
make test-backend

# Test individual services
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
```

## 🔍 Debugging Guide

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -ti:3000,8000,8001,8002,8003,5432

   # Kill processes if needed
   make stop
   ```

2. **Docker Issues**
   ```bash
   # Rebuild containers
   docker compose build --no-cache

   # Clean up
   docker compose down -v
   docker system prune -f
   ```

3. **Frontend Not Loading**
   - Check if Node.js container is running: `docker compose ps`
   - Verify npm install completed: `docker compose logs frontend`
   - Check for JavaScript errors in browser console

4. **Backend API Errors**
   - Check database connection: `docker compose logs db`
   - Verify environment variables: `docker compose exec backend env`
   - Check Python dependencies: `docker compose logs backend`

### Performance Debugging

**Frontend Performance:**
- Use React DevTools for component profiling
- Monitor network requests in browser DevTools
- Check for memory leaks in Components tab

**Backend Performance:**
- Request timing logged automatically
- Memory usage tracked per request
- Slow query logging enabled in development

**Database Performance:**
```sql
-- Enable query logging in PostgreSQL
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

## 🧪 Testing Environment

### Test Database Setup

```bash
# Create test database
docker compose exec db createdb -U postgres markdown_manager_test

# Run migrations on test database
docker compose exec backend alembic -x database_url=postgresql://postgres:postgres@db:5432/markdown_manager_test upgrade head
```

### Service Testing

Each service includes health checks and test endpoints:

```bash
# Backend health check
curl http://localhost:8000/health

# Export service health check
curl http://localhost:8001/health

# Test spell check service
curl -X POST http://localhost:8003/check \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a test sentnce with a typo."}'
```

## 🔐 Security in Development

### Development vs Production

**Development Security (Relaxed):**
- Debug mode enabled
- Detailed error messages
- CORS allows localhost origins
- Non-secure cookies allowed
- Development OAuth credentials

**Never in Production:**
- Hardcoded secrets in environment files
- Debug mode enabled
- Unrestricted CORS
- Default database passwords

### Safe Development Practices

1. **Use development-specific secrets**
2. **Never commit real API keys**
3. **Use local OAuth apps for GitHub integration**
4. **Regularly rotate development secrets**

## 📁 File Structure for Development

```text
├── backend/
│   ├── .env                 # Development environment variables
│   ├── app/                 # FastAPI application code
│   │   ├── middleware/      # Logging, CORS, etc.
│   │   ├── routers/         # API endpoints
│   │   └── services/        # Business logic
│   └── postgres-data/       # Local database storage
├── frontend/
│   ├── src/
│   │   ├── providers/       # React context providers (logging, etc.)
│   │   ├── services/        # API clients and utilities
│   │   └── components/      # React components
│   └── webpack.config.js    # Development build configuration
├── export-service/
│   ├── app/                 # Export service application
│   └── static/              # Static assets for PDF generation
├── markdown-lint-service/
│   ├── server.js            # Express server with hot reload
│   └── middleware/          # Logging middleware
├── spell-check-service/
│   ├── server.js            # Express server with hot reload
│   ├── middleware/          # Logging and security middleware
│   └── dictionaries/        # Spell check dictionaries
├── nginx/
│   ├── nginx-dev.conf       # Development reverse proxy config
│   └── conf.d/              # Additional nginx configuration
├── storage/                 # Local document storage
└── docker-compose.yml       # Development orchestration
```

## 🚀 Advanced Development

### Custom Service Development

To add a new microservice:

1. **Create service directory** with Dockerfile
2. **Add to docker-compose.yml** with appropriate ports and volumes
3. **Configure health checks** for service dependencies
4. **Add logging middleware** for debugging
5. **Update Nginx configuration** for routing

### Performance Optimization

**Development Optimization:**
- Use Docker layer caching
- Enable tmpfs for node_modules cache
- Use polling for file watching in containers
- Configure appropriate health check intervals

**Resource Limits (for development):**
```yaml
# Example resource limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

### IDE Integration

**VS Code Setup:**
- Install Docker extension for container management
- Use Remote-Containers for in-container development
- Configure Python/Node.js debugger for attached containers

**Debugging Configuration:**
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "python",
      "request": "attach",
      "connect": {"host": "localhost", "port": 5678},
      "pathMappings": [
        {"localRoot": "${workspaceFolder}/backend", "remoteRoot": "/markdown_manager"}
      ]
    }
  ]
}
```

This development guide provides comprehensive coverage of the local development environment, debugging tools, and best practices based on the sophisticated logging and configuration system you've implemented.
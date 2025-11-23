# Docker Development Environment

This guide covers the Docker-based development environment configuration and best practices for the Markdown Manager application.

## 🐳 Docker Compose Architecture

The development environment uses Docker Compose to orchestrate multiple services with optimized configurations for development workflows.

### Service Overview

```yaml
services:
  nginx:          # Reverse proxy and static file serving
  frontend:       # React development server with hot reload
  db:             # PostgreSQL database with persistent storage
  backend:        # FastAPI application with hot reload
  export-service: # PDF/diagram export service
  markdown-lint-service:  # Markdown validation service
  spell-check-service:    # Grammar and spell checking service
```

## 🔧 Service Configurations

### Nginx (Reverse Proxy)

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx/nginx-dev.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - ./nginx/scripts:/etc/nginx/scripts:ro
  depends_on:
    - backend
```

**Key Features:**
- Single entry point for all services
- Path-based routing (`/api/*`, `/api/export/*`)
- Read-only configuration mounts
- Automatic backend dependency

### Frontend (React Development Server)

```yaml
frontend:
  image: node:24
  working_dir: /app
  volumes:
    - ./frontend:/app
    - type: tmpfs
      target: /app/node_modules/.cache
      tmpfs:
        size: 5368709120  # 5 GiB
  ports:
    - "3000:3000"
  command: sh -c "npm install && CHOKIDAR_USEPOLLING=true npm run serve"
  environment:
    - CHOKIDAR_USEPOLLING=true
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000"]
    interval: 10s
    timeout: 5s
    retries: 12
    start_period: 30s
  depends_on:
    - backend
    - nginx
  init: true
```

**Optimization Features:**
- **Tmpfs Cache**: 5GB tmpfs for node_modules cache (faster builds)
- **File Watching**: CHOKIDAR_USEPOLLING for cross-platform compatibility
- **Hot Reload**: Automatic browser refresh on code changes
- **Health Checks**: Automated service readiness detection
- **Init Process**: Proper signal handling for graceful shutdown

### Database (PostgreSQL)

```yaml
db:
  image: postgres:16
  restart: unless-stopped
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: markdown_manager
  ports:
    - "5432:5432"
  volumes:
    - ./backend/postgres-data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres -d markdown_manager || exit 1"]
    interval: 5s
    timeout: 5s
    retries: 5
```

**Features:**
- **Persistent Storage**: Local volume mount for data persistence
- **Health Checks**: PostgreSQL readiness detection
- **Development Credentials**: Simple postgres/postgres credentials
- **Port Exposure**: Direct database access for debugging

### Backend (FastAPI)

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  image: backend
  tmpfs:
    - /tmp  # FastAPI temp files
  working_dir: /markdown_manager
  volumes:
    - ./backend/app:/markdown_manager/app
    - ./backend/migrations/:/markdown_manager/migrations/
    - ./backend/markdown_manager.db:/markdown_manager/markdown_manager.db
    - ./backend/alembic.ini:/markdown_manager/alembic.ini
    - ./storage:/documents  # Document storage
  ports:
    - "8000:8000"
  env_file:
    - ./backend/.env
  environment:
    - POETRY_VIRTUALENVS_IN_PROJECT=true
    - DEBUG_PASSWORD_RESET_TOKEN=true
    - MARKDOWN_STORAGE_ROOT=/documents
```

**Development Features:**
- **Hot Reload**: Uvicorn watches for Python file changes
- **Volume Mounts**: Live code updates without rebuilds
- **Environment Files**: Centralized configuration management
- **Document Storage**: Persistent file storage for documents
- **Debug Mode**: Enhanced error messages and logging

### Export Service (Playwright)

```yaml
export-service:
  build:
    context: ./export-service
    dockerfile: Dockerfile
  image: littledan9/markdown-manager-export:latest
  ports:
    - "8001:8001"
  volumes:
    - ./export-service/app:/export-service/app
    - ./export-service/static:/export-service/static
  environment:
    - PYTHONUNBUFFERED=1
    - ICON_SERVICE_URL=http://backend:8000
    - DRAWIO_VERSION=24.7.5
    - DRAWIO_QUALITY_THRESHOLD=60.0
```

**Features:**
- **Playwright Integration**: Headless browser for PDF/PNG generation
- **Hot Reload**: Live code updates for export logic
- **Service Integration**: Direct backend communication
- **Static Assets**: Mounted for PDF styling

### Node.js Microservices

#### Markdown Lint Service

```yaml
markdown-lint-service:
  build:
    context: ./markdown-lint-service
    dockerfile: Dockerfile
  environment:
    - MARKDOWN_LINT_PORT=8002
    - NODE_ENV=development
  ports:
    - "8002:8002"
  volumes:
    - ./markdown-lint-service/server.js:/app/server.js
  command: ["npm", "start"]
  restart: unless-stopped
```

#### Spell Check Service

```yaml
spell-check-service:
  build:
    context: ./spell-check-service
    dockerfile: Dockerfile
  environment:
    - SPELL_CHECK_PORT=8003
    - NODE_ENV=development
    - BACKEND_URL=http://backend:8000
  ports:
    - "8003:8003"
  volumes:
    - ./spell-check-service/server.js:/app/server.js
    - ./spell-check-service/lib:/app/lib
    - ./spell-check-service/config:/app/config:ro
    - ./spell-check-service/dictionaries:/app/dictionaries:ro
  command: ["npm", "run", "dev"]  # Nodemon for hot reload
  restart: unless-stopped
```

**Node.js Service Features:**
- **Nodemon**: Automatic restart on file changes
- **Development Mode**: Enhanced logging and debugging
- **Volume Mounts**: Live code updates
- **Health Checks**: Automated service monitoring
- **Service Communication**: Inter-service HTTP communication

## 🚀 Development Workflow

### Starting the Environment

```bash
# Start all services
make dev

# Alternative: Direct docker compose
docker compose up -d

# View startup logs
docker compose logs -f
```

### Service Management

```bash
# Check service status
make status
docker compose ps

# Restart specific service
docker compose restart backend

# Rebuild and restart service
docker compose up -d --build backend

# View service logs
docker compose logs -f backend
docker compose logs --tail=100 frontend
```

### Development Commands

```bash
# Install dependencies (runs across all services)
make install

# Clean build artifacts
make clean

# Stop all services
make stop
docker compose down

# Stop and remove volumes (destructive)
docker compose down -v
```

## 🔍 Health Checks and Dependencies

### Health Check Configuration

Each service includes comprehensive health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s    # Check every 30 seconds
  timeout: 10s     # 10 second timeout
  retries: 3       # 3 failed attempts before unhealthy
  start_period: 10s # Wait 10s before first check
```

### Service Dependencies

Proper startup ordering with health-based dependencies:

```yaml
backend:
  depends_on:
    db:
      condition: service_healthy
    export-service:
      condition: service_healthy
    spell-check-service:
      condition: service_healthy
    markdown-lint-service:
      condition: service_healthy
```

**Startup Sequence:**
1. **Database** starts first and becomes healthy
2. **Microservices** (export, lint, spell-check) start in parallel
3. **Backend** waits for all dependencies to be healthy
4. **Frontend** and **Nginx** start after backend is ready

## 🏗️ Volume Mounts and Data Persistence

### Code Volumes (Hot Reload)

```yaml
# Backend hot reload
- ./backend/app:/markdown_manager/app

# Frontend hot reload
- ./frontend:/app

# Service hot reload
- ./spell-check-service/server.js:/app/server.js
- ./spell-check-service/lib:/app/lib
```

### Data Persistence

```yaml
# Database data
- ./backend/postgres-data:/var/lib/postgresql/data

# Document storage
- ./storage:/documents

# Configuration (read-only)
- ./nginx/nginx-dev.conf:/etc/nginx/nginx.conf:ro
- ./spell-check-service/dictionaries:/app/dictionaries:ro
```

### Temporary Storage Optimization

```yaml
# Fast tmpfs for node_modules cache
volumes:
  - type: tmpfs
    target: /app/node_modules/.cache
    tmpfs:
      size: 5368709120  # 5 GiB

# FastAPI temp files
tmpfs:
  - /tmp
```

## 🐛 Debugging and Troubleshooting

### Container Debugging

```bash
# Execute commands in running containers
docker compose exec backend bash
docker compose exec db psql -U postgres -d markdown_manager
docker compose exec frontend npm ls

# Check container resources
docker stats

# Inspect container configuration
docker compose config
docker inspect markdown-manager-backend-1
```

### Log Analysis

```bash
# Follow all logs with timestamps
docker compose logs -f -t

# Filter logs by service
docker compose logs backend | grep ERROR

# Get recent logs
docker compose logs --tail=50 --since=5m

# Export logs for analysis
docker compose logs > debug.log
```

### Network Debugging

```bash
# Check service connectivity
docker compose exec backend curl http://export-service:8001/health
docker compose exec frontend curl http://backend:8000/health

# Inspect Docker network
docker network ls
docker network inspect markdown-manager_default
```

### Volume Debugging

```bash
# Check volume mounts
docker compose exec backend ls -la /markdown_manager/app
docker compose exec backend ls -la /documents

# Volume inspection
docker volume ls
docker volume inspect markdown-manager_postgres-data
```

## ⚡ Performance Optimization

### Build Optimization

```dockerfile
# Multi-stage builds for smaller images
FROM node:24 AS build
FROM node:24-alpine AS runtime

# Layer caching optimization
COPY package*.json ./
RUN npm ci --only=production
COPY . .
```

### Resource Limits (Development)

```yaml
# Optional resource limits for development
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

### File Watching Optimization

```yaml
# Polling for file changes (cross-platform compatibility)
environment:
  - CHOKIDAR_USEPOLLING=true
  - CHOKIDAR_INTERVAL=1000  # Poll every 1 second
```

## 🔒 Security Considerations

### Development Security

```yaml
# Non-root user in containers
USER node
USER exportservice

# Read-only mounts where possible
volumes:
  - ./config:/app/config:ro
  - ./dictionaries:/app/dictionaries:ro

# Environment variable security
env_file:
  - ./backend/.env  # Keep secrets in files, not docker-compose.yml
```

### Network Isolation

```yaml
# Internal service communication
networks:
  default:
    driver: bridge

# Only expose necessary ports
ports:
  - "80:80"    # Only Nginx exposed publicly
  - "3000:3000"  # Frontend for development debugging
```

## 📊 Monitoring and Metrics

### Container Metrics

```bash
# Resource usage monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Service health monitoring
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
```

### Application Metrics

```bash
# Database connections
docker compose exec db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Memory usage by service
docker compose exec backend python -c "import psutil; print(f'Memory: {psutil.virtual_memory().percent}%')"
```

This Docker development environment provides a robust, scalable, and developer-friendly setup that supports hot reloading, comprehensive logging, health checks, and easy debugging while maintaining production-like service architecture.
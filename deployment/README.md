# Markdown Manager Deployment

Complete deployment system using Ansible for production deployment to Danbian server.

## 🏗️ Architecture Overview

```
Development Machine → Ansible → SSH → Production Server (Danbian)
                                ↓
                          Deploy Services via Systemd
                          ├── Redis (Event Store)
                          ├── Backend API
                          ├── Export Service
                          ├── Linting Service + Consumer
                          ├── Spell-check Service + Consumer
                          ├── Event Publisher
                          └── Static UI (via Nginx)
```

## 🚀 Quick Start

### Prerequisites
- SSH access to production server (`~/.ssh/id_danbian`)
- Docker installed locally (for building images)
- Ubuntu/Debian system (Ansible auto-installed)

### Deploy Everything
```bash
make deploy                    # Deploy all services
make deploy-quiet             # Minimal output
make deploy-verbose           # Debug mode
```

### Deploy Individual Services
```bash
make deploy-backend           # Backend API only
make deploy-nginx             # Nginx + UI only
make deploy-redis             # Redis only
make deploy-export            # Export service only
make deploy-linting           # Linting service + consumer
make deploy-spell-check       # Spell-check service + consumer
```

### Status & Validation
```bash
make deploy-status            # Check all service status
make deploy-dry-run           # Preview changes without deploying
```

## 📁 Directory Structure

```text
deployment/
├── ansible.cfg               # Ansible configuration
├── inventory.yml             # Target hosts (Danbian)
├── deploy.yml               # Main deployment playbook
├── status.yml               # Status checking playbook
├── config.yml               # Service configuration
├── group_vars/              # Environment variables
│   └── production.yml
└── roles/                   # Ansible roles
    ├── infrastructure/      # Docker, networks, registry
    ├── docker_service/      # Container deployment
    ├── nginx_config/        # Nginx + UI deployment
    ├── redis/              # Redis deployment
    ├── cleanup/            # Image cleanup
    └── status/             # Service status checking
```

## ⚙️ Service Configuration

Services are defined in `config.yml` with these key properties:

```yaml
services:
  backend:
    name: "markdown-manager-backend"
    image: "littledan9/markdown-manager"
    tag: "latest"
    port: 8000
    build_context: "./services/backend"
    systemd_service: true
    health_check: "/health"
    env_file: "/etc/markdown-manager.env"
    restart_policy: "unless-stopped"
```

### Service Types

**Containerized Services:**

- **Backend**: Main API (`port 8000`)
- **Export**: Document export (`port 8001`)
- **Linting**: Markdown linting (`port 8002`)
- **Spell-check**: Spell checking (`port 8003`)
- **Event Publisher**: Background event publishing
- **Redis**: Event store and message broker (`port 6379`)

**Event Consumers** (auto-deployed):

- **Linting Consumer**: Processes linting events
- **Spell-check Consumer**: Processes spell-check events

**Static Content:**

- **UI**: React frontend (built and served by nginx)

## 🔄 Deployment Process

### 1. Change Detection (Smart Deployment)

- **Service Config**: SHA256 checksums detect systemd config changes
- **Images**: Skip builds if registry image already exists
- **Conditional Restarts**: Only restart services when necessary

### 2. Build & Push

- Images built locally with Docker
- Pushed to local registry (port 5000)
- Tagged for production deployment

### 3. Service Deployment

- Systemd services created/updated
- Containers deployed with proper networking
- Health checks verify service availability

### 4. Verification

- Systemd service status verified
- Container status confirmed with retries
- HTTP health checks for services with endpoints

## 🌐 Infrastructure Components

### Docker Registry

Local registry on port 5000 for image distribution:

```bash
# Check registry status
curl -s http://localhost:5000/v2/
```

### Docker Network

All services connected via `markdown-manager` network for inter-service communication.

### Systemd Integration

Each service runs as a systemd service with:

- Automatic restart on failure
- Proper dependency management
- Service logging integration

## 📊 Event System Architecture

**Redis Streams** power the event-driven architecture:

```text
Database Changes → Event Publisher → Redis Streams → Event Consumers
                                        ├── Linting Consumer
                                        └── Spell-check Consumer
```

### Configuration

Services with event consumption have `consumer_config` defined:

```yaml
linting:
  consumer_config: "consumer.config.json"  # Enables auto-consumer deployment
```

## 🔧 Development vs Production

### Development

- Services run via `docker-compose`
- Hot reload for UI development
- Local database and Redis

### Production

- Services managed by systemd
- UI deployed as static files
- Persistent data volumes
- Environment file: `/etc/markdown-manager.env`

## 🖥️ UI Deployment (Static Files)

The UI is deployed as static files served by nginx (not containerized):

### Build Process

1. Node.js installed on target server
2. UI source copied and built (`npm run build:clean`)
3. Static files deployed to `/var/www/littledan.com`
4. Nginx configured for SPA routing and asset caching

### Nginx Configuration

- **Static Assets**: 1-year cache with immutable headers
- **HTML Files**: No cache for instant updates
- **SPA Routing**: `try_files` for client-side routing
- **API Proxy**: Backend requests proxied to port 8000

## 🎯 Smart Deployment Features

### Change Detection

- **Skip Unchanged**: Services only restart when config or image changes
- **Checksum Validation**: SHA256 comparison of systemd service files
- **Image Caching**: Local registry prevents unnecessary rebuilds

### Error Handling

- **Retry Logic**: Container verification with multiple attempts
- **Graceful Failures**: Clear error messages with relevant logs
- **Health Validation**: Services verified as healthy before success

### Output Control

- **Default**: Shows changes and important status
- **Quiet Mode**: Minimal output, errors only
- **Verbose Mode**: Full debug output for troubleshooting

## 🔍 Monitoring & Troubleshooting

### Service Status

```bash
# Check all services
make deploy-status

# Individual service status
sudo systemctl status markdown-manager-backend
sudo systemctl status markdown-manager-redis
```

### Container Logs

```bash
# View service logs
docker logs markdown-manager-backend
docker logs markdown-manager-redis

# Follow logs in real-time
docker logs -f markdown-manager-backend
```

### Redis Monitoring

```bash
# Connect to Redis CLI
docker exec -it markdown-manager-redis redis-cli

# Monitor event streams
XINFO STREAM document_events
XRANGE document_events - +
```

### Common Issues

**Container Startup Failures:**

```bash
# Check systemd service status
sudo systemctl status markdown-manager-[service]

# Check container logs
docker logs markdown-manager-[service]

# Restart service manually
sudo systemctl restart markdown-manager-[service]
```

**Registry Connection Issues:**

```bash
# Verify local registry
curl -s http://localhost:5000/v2/

# Check registry container
docker ps | grep registry
```

**UI Build Failures:**

```bash
# Manual UI build test
cd services/ui
npm install
npm run build:clean
ls -la dist/
```

## 🚨 Environment Configuration

### Production Environment File

Location: `/etc/markdown-manager.env`

Required variables:

```bash
# Database
DATABASE_URL=sqlite:///data/markdown_manager.db

# Services
EXPORT_SERVICE_URL=http://markdown-manager-export:8001
MARKDOWN_LINT_SERVICE_URL=http://markdown-manager-lint:8002
SPELL_CHECK_SERVICE_URL=http://markdown-manager-spell-check:8003

# Redis
REDIS_URL=redis://markdown-manager-redis:6379/0

# Event Publisher (RELAY_ prefix required)
RELAY_DATABASE_URL=sqlite:///data/markdown_manager.db
RELAY_REDIS_URL=redis://markdown-manager-redis:6379/0
RELAY_BATCH_SIZE=50
RELAY_POLL_INTERVAL=5
RELAY_MAX_RETRY_ATTEMPTS=5
RELAY_LOG_LEVEL=INFO

# GitHub Integration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://littledan.com/auth/github/callback

# Security
JWT_SECRET_KEY=your_jwt_secret_key
ALLOWED_ORIGINS=https://littledan.com

# Storage
HOST_STORAGE_ROOT=/opt/markdown-manager/storage
CONTAINER_STORAGE_ROOT=/documents
```

## 🔐 Security Considerations

### SSH Access

- Key-based authentication required
- SSH key: `~/.ssh/id_danbian`
- User: `dlittle` with sudo access

### Container Security

- Services run in isolated Docker network
- Environment variables loaded from secure file
- No dangerous Redis commands in production
- File permissions managed appropriately

### Network Security

- Only necessary ports exposed
- Internal service communication via Docker network
- UI served over HTTPS in production

## 📈 Performance Characteristics

### Static UI Serving

- **nginx**: 50,000+ requests/second for static files
- **Memory**: ~5MB nginx vs ~50MB Node.js service
- **Cache Strategy**: 1-year cache for assets, no-cache for HTML

### Service Performance

- **Health Checks**: 2-second intervals with 30-attempt retries
- **Container Startup**: 5-attempt verification with delays
- **Image Builds**: Cached when possible, skip unchanged

### Resource Usage

- **Redis**: 256MB memory limit with LRU eviction
- **Backend**: Optimized Python with minimal dependencies
- **Event Consumers**: Lightweight background processing

## 🛠️ Adding New Services

1. **Add to config.yml:**

```yaml
services:
  newservice:
    name: "markdown-manager-newservice"
    image: "littledan9/markdown-manager-newservice"
    port: 8004
    build_context: "./services/newservice"
    systemd_service: true
```

1. **Update service deployment order:**

```yaml
service_deploy_order:
  - "redis"
  - "newservice"  # Add here based on dependencies
```

1. **Add Makefile target:**

```makefile
deploy-newservice: ## Deploy new service
    @./scripts/setup-ansible.sh
    @cd deployment && ansible-playbook -i inventory.yml deploy.yml --tags newservice
```

## 📋 Deployment Checklist

Before deploying:

- [ ] Environment file configured on target server
- [ ] SSH key access verified (`ssh dlittle@10.0.1.51`)
- [ ] Docker registry accessible
- [ ] Service configurations reviewed in `config.yml`

After deploying:

- [ ] All services show as active: `make deploy-status`
- [ ] UI accessible at production URL
- [ ] API health checks passing
- [ ] Redis accepting connections
- [ ] Event consumers processing (if applicable)

---

**🎉 The deployment system is designed for reliability, performance, and ease of use. All services are monitored, health-checked, and automatically restarted on failure!**

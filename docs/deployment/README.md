# Deployment Guide

This guide covers deploying the Markdown Manager application to production environments using the automated deployment system.

## 🏗️ Deployment Architecture

The deployment system uses a sophisticated multi-phase approach with Docker containerization, private registry, and automated Nginx configuration.

### Production Environment

- **Target Server**: Remote Linux server (configurable)
- **Containerization**: All services run in Docker containers
- **Registry**: Temporary SSH-tunneled Docker registry for image distribution
- **Reverse Proxy**: Nginx with SSL termination and path-based routing
- **Database**: PostgreSQL with persistent volume storage
- **File Storage**: Filesystem-based document storage

### Service Deployment Model

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Production Server                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Nginx     │  │  Frontend   │  │ Backend API │  │   Export Service    │  │
│  │ (Port 80)   │  │   Static    │  │(Port 8000)  │  │   (Port 8001)       │  │
│  │             │  │   Files     │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                            │                                │
│  ┌─────────────┐  ┌─────────────┐         │         ┌─────────────────────┐  │
│  │ Lint Service│  │Spell Service│         │         │    PostgreSQL       │  │
│  │(Port 8002)  │  │(Port 8003)  │         └─────────┤   (Port 5432)       │  │
│  │             │  │             │                   │                     │  │
│  └─────────────┘  └─────────────┘                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Deployment

### Prerequisites

- **SSH Access**: Key-based authentication to production server
- **Docker**: Local Docker installation for building images
- **Make**: Build automation tool
- **Production Server**: Linux server with Docker and Nginx installed

### Full Deployment

Deploy the entire application stack:

```bash
make deploy
```

This command executes:

1. `make deploy-front` - Builds and deploys frontend + Nginx config
2. `make deploy-back` - Deploys all backend services + Nginx config

### Individual Component Deployment

Deploy specific components:

```bash
# Frontend only
make deploy-front

# Backend services only
make deploy-back

# Nginx configuration only
make deploy-nginx-all
```

## 📋 Deployment Process

### Frontend Deployment (`make deploy-front`)

1. **Build Phase**

   ```bash
   make build  # Webpack production build
   ```

2. **File Sync**
   - Cleans remote directory: `/var/www/littledan.com`
   - Syncs build artifacts via rsync over SSH
   - Preserves file permissions and timestamps

3. **Nginx Configuration**
   - Deploys frontend-specific Nginx configuration
   - Reloads Nginx service

### Backend Deployment (`make deploy-back`)

The backend deployment follows a sophisticated 6-phase process:

#### Phase 1: Infrastructure Setup
- Establishes SSH tunnel for Docker registry (port 5000)
- Validates SSH connectivity and server prerequisites
- Sets up temporary container registry

#### Phase 2: Build and Registry Push
- Builds Docker images for all services:
  - Backend API (`littledan9/markdown-manager:latest`)
  - Export Service (`littledan9/markdown-manager-export:latest`)
  - Lint Service (`littledan9/markdown-manager-lint:latest`)
  - Spell Check Service (`littledan9/markdown-manager-spell-check:latest`)
- Tags and pushes images to temporary registry
- Optimizes builds with layer caching

#### Phase 3: Remote Deployment
- Pulls images from registry to production server
- Stops existing containers gracefully
- Starts new containers with updated images
- Validates service health checks

#### Phase 4: Infrastructure Cleanup
- Closes SSH tunnel
- Cleans up temporary registry

#### Phase 5: Nginx Configuration
- Deploys API-specific Nginx configurations
- Updates routing rules for backend services
- Reloads Nginx with new configuration

#### Phase 6: Image Cleanup
- Removes unused Docker images
- Prunes build artifacts
- Optimizes disk usage

## 🔧 Configuration

### Environment Variables

Production configuration is managed through `/etc/markdown-manager.env`:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/markdown_manager
POSTGRES_USER=markdown_manager
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=markdown_manager

# Service URLs
ICON_SERVICE_URL=http://backend:8000
EXPORT_SERVICE_URL=http://export-service:8001

# Export Service Configuration
DRAWIO_VERSION=24.7.5
DRAWIO_QUALITY_THRESHOLD=60.0

# Storage Configuration
MARKDOWN_STORAGE_ROOT=/documents

# Security
SECRET_KEY=your-secret-key-here
DEBUG=false
```

### SSH Configuration

The deployment system uses key-based SSH authentication:

- **Default Key**: `~/.ssh/id_danbian`
- **Default User**: `dlittle@10.0.1.51`
- **Configurable**: Edit Makefile variables for different environments

### Nginx Configuration

Production Nginx configurations are deployed to:
- **Frontend Config**: `/etc/nginx/sites-available/littledan.com`
- **API Config**: `/etc/nginx/sites-available/api.littledan.com`
- **Backup System**: Automatic config backups with rotation

## 🎯 Advanced Deployment Options

### Individual Service Deployment

Deploy specific microservices without affecting others:

```bash
# Deploy only the main backend API
make deploy-backend-only

# Deploy only the export service
make deploy-export-only

# Deploy only the markdown lint service
make deploy-lint-only

# Deploy only the spell check service
make deploy-spell-check-only
```

### Phase-Specific Deployment

Execute specific deployment phases:

```bash
# Setup infrastructure only
make deploy-infra-only

# Build and push images only
make deploy-build-only

# Deploy to remote servers only (assumes images exist)
make deploy-remote-only

# Run cleanup operations only
make deploy-cleanup-only
```

### Nginx-Specific Deployment

Update Nginx configurations without touching services:

```bash
# Deploy frontend Nginx config
make deploy-nginx-frontend

# Deploy API Nginx config
make deploy-nginx-api

# Deploy all Nginx configs
make deploy-nginx-all
```

## 🔍 Monitoring and Validation

### Service Health Checks

All services include health check endpoints:

- **Backend API**: `GET /health`
- **Export Service**: `GET /health`
- **Lint Service**: `GET /health`
- **Spell Check Service**: `GET /health`

### Deployment Validation

After deployment, validate services are running:

```bash
# Check service status on remote server
ssh user@server 'docker ps'

# Test API endpoints
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/export/health
```

### Log Inspection

View service logs for troubleshooting:

```bash
# View all service logs
ssh user@server 'docker logs markdown-manager-backend'
ssh user@server 'docker logs markdown-manager-export'
ssh user@server 'docker logs markdown-manager-lint'
ssh user@server 'docker logs markdown-manager-spell-check'
```

## 🚨 Troubleshooting

### Common Issues

1. **SSH Connection Failures**
   - Verify SSH key permissions: `chmod 600 ~/.ssh/id_danbian`
   - Test SSH connectivity: `ssh -i ~/.ssh/id_danbian user@server`

2. **Docker Registry Issues**
   - Check if port 5000 is available locally
   - Verify SSH tunnel establishment in deployment logs

3. **Service Startup Failures**
   - Check environment file exists: `/etc/markdown-manager.env`
   - Verify PostgreSQL is running and accessible
   - Check Docker image integrity

4. **Nginx Configuration Errors**
   - Validate Nginx syntax: `sudo nginx -t`
   - Check file permissions on config files
   - Verify SSL certificate paths (if using HTTPS)

### Recovery Procedures

**Rollback Deployment:**
```bash
# Restore from automatic backup
ssh user@server 'sudo cp /etc/nginx/sites-available/config.backup.TIMESTAMP /etc/nginx/sites-available/config'
ssh user@server 'sudo systemctl reload nginx'

# Restart previous container versions
ssh user@server 'docker restart container_name'
```

**Emergency Service Restart:**
```bash
# Restart all services
ssh user@server 'docker restart $(docker ps -q)'

# Restart specific service
ssh user@server 'docker restart markdown-manager-backend'
```

## 📊 Performance Considerations

### Build Optimization

- Docker layer caching reduces build times
- Multi-stage builds minimize image sizes
- Parallel builds when possible

### Deployment Speed

- Average full deployment: 3-5 minutes
- Individual service deployment: 30-60 seconds
- Frontend-only deployment: 10-20 seconds

### Resource Requirements

**Production Server Minimum:**

- **CPU**: 2 cores (ARM64 compatible)
- **RAM**: 4GB (with swap recommended)
- **Storage**: 20GB available space
- **Network**: Broadband connection

**Development Machine:**

- **Docker**: 2GB+ available memory
- **Network**: Stable connection for image pushing

### Raspberry Pi 5 Compatibility

**✅ Can Run On Raspberry Pi 5 (8GB model):**
The system is designed to run on ARM64 architecture and can operate on a Raspberry Pi 5, but with some considerations:

**Hardware Requirements:**

- **Model**: Raspberry Pi 5 with 8GB RAM (4GB model not recommended)
- **Storage**: Fast microSD card (Class 10/U3) or USB 3.0 SSD strongly recommended
- **Cooling**: Active cooling recommended for sustained performance

**Expected Performance:**

- **Export Service**: PDF generation will be slower (~10-30 seconds vs 2-5 seconds)
- **Playwright Operations**: SVG to PNG conversion will take longer due to headless browser overhead
- **Database**: PostgreSQL performance will be adequate for small to medium workloads
- **Concurrent Users**: Recommend limiting to 2-5 concurrent users

**Memory Usage Breakdown:**

- **PostgreSQL**: ~100-200MB
- **Backend API**: ~150-300MB
- **Export Service**: ~300-800MB (with Playwright/Chromium)
- **Frontend (Nginx)**: ~10-20MB
- **Lint Service**: ~50-100MB
- **Spell Check Service**: ~50-100MB
- **System Overhead**: ~500MB
- **Total**: ~1.2-1.8GB base usage, peaks to 2.5-3GB under load

**Optimizations for Pi 5:**

```bash
# Recommended environment settings for Pi deployment
WORKERS=1  # Reduce worker processes
EXPORT_TIMEOUT=300  # Increase timeouts for slower processing
MAX_MEMORY_USAGE_MB=200  # Stricter memory limits
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright/browsers  # Ensure browser reuse
```

**Pi-Specific Deployment Considerations:**

- Enable swap (8GB recommended): `sudo dphys-swapfile swapsize=8192`
- Use USB 3.0 SSD for Docker volumes and PostgreSQL data
- Monitor CPU temperature and implement throttling if needed
- Consider running fewer concurrent services or disabling non-essential features

**Not Recommended For:**

- High-traffic production environments (>10 concurrent users)
- Heavy diagram export workloads
- CPU-intensive document processing at scale

## 🔒 Security Considerations

### Network Security

- All services communicate through internal Docker networks
- Only Nginx exposed to public internet
- SSH key-based authentication required

### Data Protection

- PostgreSQL data persisted in Docker volumes
- Document storage in filesystem with appropriate permissions
- Environment variables stored securely outside containers

### SSL/TLS

Production deployments should include:

```bash
# SSL certificate installation (manual step)
sudo certbot --nginx -d yourdomain.com
```

## 📚 Related Documentation

- **[Development Setup](../development/)** - Local development environment
- **[Architecture Overview](../../README.md#architecture)** - System architecture details
- **[Service Documentation](../../export-service/README.md)** - Individual service guides
- **[Nginx Configuration](../../nginx/)** - Reverse proxy setup

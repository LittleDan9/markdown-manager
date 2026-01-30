# Environment Configuration

This guide covers configuring environment variables and settings for production deployment.

## Production Environment File

All production configuration is managed through `/etc/markdown-manager.env` on the production server.

### Complete Configuration Template

```bash
# ────────────────────────────────────────────────────────────────────────────
# Markdown Manager Production Configuration
# ────────────────────────────────────────────────────────────────────────────

# ────────────────────────────────────────────────────────────────────────────
# APPLICATION SETTINGS
# ────────────────────────────────────────────────────────────────────────────

# Environment mode
NODE_ENV=production
DEBUG=false
ENVIRONMENT=production

# Application URLs
FRONTEND_URL=https://yourdomain.com
API_BASE_URL=https://yourdomain.com/api

# ────────────────────────────────────────────────────────────────────────────
# DATABASE CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# PostgreSQL Database
DATABASE_URL=postgresql://markdown_manager:secure_password@db:5432/markdown_manager
POSTGRES_USER=markdown_manager
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=markdown_manager
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Database Pool Settings
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30

# ────────────────────────────────────────────────────────────────────────────
# SERVICE URLS
# ────────────────────────────────────────────────────────────────────────────

# Internal service communication
ICON_SERVICE_URL=http://backend:8000
EXPORT_SERVICE_URL=http://export:8001
LINTING_SERVICE_URL=http://linting:8002
SPELL_CHECK_SERVICE_URL=http://spell-check:8003

# ────────────────────────────────────────────────────────────────────────────
# EXPORT SERVICE CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# Draw.io Export Settings
DRAWIO_VERSION=24.7.5
DRAWIO_QUALITY_THRESHOLD=60.0

# Export timeouts (seconds)
EXPORT_TIMEOUT=120
PDF_GENERATION_TIMEOUT=60
DIAGRAM_CONVERSION_TIMEOUT=30

# ────────────────────────────────────────────────────────────────────────────
# STORAGE CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# Document storage
MARKDOWN_STORAGE_ROOT=/documents
STORAGE_MAX_FILE_SIZE=50MB
STORAGE_ALLOWED_EXTENSIONS=.md,.txt,.json

# Temporary file settings
TEMP_DIR=/tmp
TEMP_FILE_CLEANUP_HOURS=24

# ────────────────────────────────────────────────────────────────────────────
# SECURITY SETTINGS
# ────────────────────────────────────────────────────────────────────────────

# Application secrets (CHANGE THESE!)
SECRET_KEY=your-super-secure-secret-key-minimum-32-characters
JWT_SECRET_KEY=your-jwt-secret-key-for-tokens
ENCRYPTION_KEY=your-encryption-key-for-sensitive-data

# Session settings
SESSION_TIMEOUT=86400  # 24 hours
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=Strict

# CORS settings
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_CREDENTIALS=true

# ────────────────────────────────────────────────────────────────────────────
# PERFORMANCE SETTINGS
# ────────────────────────────────────────────────────────────────────────────

# Worker processes
WORKERS=4
WORKER_CONNECTIONS=1000
WORKER_TIMEOUT=30

# Caching
CACHE_TTL=300  # 5 minutes
REDIS_URL=redis://redis:6379/0  # If using Redis

# ────────────────────────────────────────────────────────────────────────────
# EVENT PUBLISHER CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# Event publisher service (RELAY_ prefix required)
RELAY_DATABASE_URL=postgresql://markdown_manager:secure_password@db:5432/markdown_manager
RELAY_REDIS_URL=redis://redis:6379/0
RELAY_BATCH_SIZE=50
RELAY_POLL_INTERVAL=5
RELAY_MAX_RETRY_ATTEMPTS=5
RELAY_LOG_LEVEL=INFO

# Event stream names
RELAY_STREAM_NAME=identity.user.v1
RELAY_DLQ_STREAM_NAME=identity.user.v1.dlq
RELAY_RETRY_BASE_DELAY=60

# ────────────────────────────────────────────────────────────────────────────
# RATE LIMITING & PERFORMANCE
# ────────────────────────────────────────────────────────────────────────────

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60  # seconds

# ────────────────────────────────────────────────────────────────────────────
# LOGGING CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_LEVEL=INFO
LOG_FORMAT=json  # or 'text'

# Log file paths (if logging to files)
LOG_FILE=/var/log/markdown-manager/app.log
ERROR_LOG_FILE=/var/log/markdown-manager/error.log

# Log rotation
LOG_MAX_SIZE=100MB
LOG_BACKUP_COUNT=5

# ────────────────────────────────────────────────────────────────────────────
# MONITORING & HEALTH CHECKS
# ────────────────────────────────────────────────────────────────────────────

# Health check settings
HEALTH_CHECK_TIMEOUT=5
DATABASE_HEALTH_CHECK=true
EXTERNAL_SERVICE_HEALTH_CHECK=true

# Metrics collection
METRICS_ENABLED=true
METRICS_PORT=9090

# ────────────────────────────────────────────────────────────────────────────
# EMAIL CONFIGURATION (if using notifications)
# ────────────────────────────────────────────────────────────────────────────

SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com

# ────────────────────────────────────────────────────────────────────────────
# BACKUP CONFIGURATION
# ────────────────────────────────────────────────────────────────────────────

# Database backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=/backups

# ────────────────────────────────────────────────────────────────────────────
# DEVELOPMENT OVERRIDES (remove in production)
# ────────────────────────────────────────────────────────────────────────────

# Only include these for debugging production issues
# DEBUG_PASSWORD_RESET_TOKEN=false
# ALLOW_ORIGINS=*
```

## Environment-Specific Settings

### Development Environment

```bash
# Development overrides in backend/.env
NODE_ENV=development
DEBUG=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/markdown_manager
CORS_ORIGINS=http://localhost:3000,http://localhost:80
```

### Staging Environment

```bash
# Staging configuration
NODE_ENV=staging
DEBUG=false
DATABASE_URL=postgresql://staging_user:staging_pass@staging-db:5432/markdown_manager_staging
FRONTEND_URL=https://staging.yourdomain.com
```

### Production Environment

```bash
# Production configuration
NODE_ENV=production
DEBUG=false
DATABASE_URL=postgresql://prod_user:secure_prod_pass@prod-db:5432/markdown_manager
FRONTEND_URL=https://yourdomain.com
```

## Security Best Practices

### Secret Management

1. **Generate Strong Secrets**
   ```bash
   # Generate 32-character secret key
   openssl rand -base64 32

   # Generate JWT secret
   openssl rand -hex 64
   ```

2. **File Permissions**
   ```bash
   # Secure environment file
   sudo chmod 600 /etc/markdown-manager.env
   sudo chown root:root /etc/markdown-manager.env
   ```

3. **Environment Variable Validation**
   - Never commit secrets to version control
   - Use different secrets for each environment
   - Rotate secrets regularly (quarterly recommended)

### Database Security

1. **Connection Security**
   ```bash
   # Use SSL connections in production
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
   ```

2. **User Permissions**
   ```sql
   -- Create dedicated database user
   CREATE USER markdown_manager WITH PASSWORD 'secure_password';
   GRANT CONNECT ON DATABASE markdown_manager TO markdown_manager;
   GRANT USAGE ON SCHEMA public TO markdown_manager;
   GRANT CREATE ON SCHEMA public TO markdown_manager;
   ```

## Service Configuration

### Backend API Configuration

The FastAPI backend reads configuration from environment variables with these priorities:

1. Environment variables
2. `.env` file (development only)
3. Default values

### Export Service Configuration

```bash
# Export service specific settings
PLAYWRIGHT_BROWSERS_PATH=/app/browsers
PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net
```

### Lint Service Configuration

```bash
# Markdown lint service settings
MARKDOWN_LINT_PORT=8002
MARKDOWN_LINT_RULES_FILE=/app/rules-definitions.json
```

### Spell Check Service Configuration

```bash
# Spell check service settings
SPELL_CHECK_PORT=8003
DICTIONARY_PATH=/app/dictionaries
BACKEND_URL=http://backend:8000
```

## Docker Compose Environment

When using Docker Compose, environment variables can be passed through:

```yaml
# docker-compose.production.yml (example)
version: '3.8'
services:
  backend:
    image: littledan9/markdown-manager:latest
    env_file:
      - /etc/markdown-manager.env
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SECRET_KEY=${SECRET_KEY}
```

## Configuration Validation

### Environment Check Script

Create a validation script to check configuration:

```bash
#!/bin/bash
# validate-config.sh

CONFIG_FILE="/etc/markdown-manager.env"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Source the configuration
source "$CONFIG_FILE"

# Required variables
REQUIRED_VARS=(
    "DATABASE_URL"
    "SECRET_KEY"
    "POSTGRES_PASSWORD"
    "MARKDOWN_STORAGE_ROOT"
)

echo "Validating configuration..."

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required variable $var is not set"
        exit 1
    fi
done

echo "✅ Configuration validation passed"
```

### Health Check Integration

Services can validate their configuration on startup:

```python
# Example Python configuration validation
import os
import sys

def validate_config():
    required_vars = [
        'DATABASE_URL',
        'SECRET_KEY',
        'MARKDOWN_STORAGE_ROOT'
    ]

    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)

    if missing_vars:
        print(f"Error: Missing required environment variables: {missing_vars}")
        sys.exit(1)

    print("✅ Configuration validation passed")

if __name__ == "__main__":
    validate_config()
```

## Troubleshooting Configuration Issues

### Common Problems

1. **Database Connection Failures**
   ```bash
   # Test database connectivity
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

2. **Service Communication Issues**
   ```bash
   # Test internal service URLs
   curl http://backend:8000/health
   curl http://export:8001/health
   ```

3. **File Permission Issues**
   ```bash
   # Check storage directory permissions
   ls -la /documents
   docker exec container-name ls -la /documents
   ```

### Debug Configuration

Enable debug mode temporarily for troubleshooting:

```bash
# Add to environment file temporarily
DEBUG=true
LOG_LEVEL=DEBUG

# Restart services
docker restart $(docker ps -q)
```

## Configuration Migration

When updating configuration between versions:

1. **Backup Current Config**
   ```bash
   sudo cp /etc/markdown-manager.env /etc/markdown-manager.env.backup.$(date +%Y%m%d)
   ```

2. **Compare with Template**
   ```bash
   diff /etc/markdown-manager.env docs/deployment/environment-template.env
   ```

3. **Validate New Config**
   ```bash
   bash validate-config.sh
   ```

4. **Deploy with New Config**
   ```bash
   make deploy
   ```
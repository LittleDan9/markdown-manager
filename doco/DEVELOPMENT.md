# Development and Deployment Guide

## Overview

This project now supports multiple deployment modes:
- **Production**: HTTPS deployment via nginx to littledan.com
- **Development (nginx)**: HTTP deployment via nginx to localhost (accessible from 10.0.1.0/24 network)
- **Development (webpack)**: Hot-reload development server on localhost:8080

## Quick Start

### For Development with nginx localhost (Recommended)
```bash
./dev.sh
```
This will:
- Start the backend on port 8000
- Deploy frontend to nginx localhost configuration
- Start file watcher for automatic rebuilds
- Access via multiple URLs:
  - **http://localhost** (local access only)
  - **http://10.0.1.51** (network access via IP)
  - **http://danbian** (network access via hostname)

### For Development with webpack dev server
```bash
./dev.sh -n
```
This will:
- Start the backend on port 8000
- Start webpack dev server on port 8080
- Hot reload enabled
- Access via http://localhost:8080

## Deployment Commands

### Development Deployment
```bash
# Start development servers
make dev

# Start only frontend
make dev-frontend

# Start only backend
make dev-backend
```

### Production Deployment
```bash
# Full production deployment (build + deploy)
make deploy

# Check deployment status
make status

# Stop development servers
make stop
```

## Build Commands

### Frontend Builds
```bash
cd frontend

# Production build (optimized)
npm run build

# Development build (faster, unminified)
npm run build:dev

# Clean production build
npm run build:clean

# Incremental build with file watching
npm run build:dev:incremental
```

## Network Access

### Development (nginx localhost)
- **URL**: http://localhost
- **Access**: Any device on 10.0.1.0/24 network
- **SSL**: None (HTTP only)
- **Backend**: Proxied through nginx to localhost:8000

### Production (nginx HTTPS)
- **URL**: https://littledan.com
- **Access**: Public internet
- **SSL**: Full HTTPS with security headers
- **Backend**: Proxied through nginx to localhost:8000

### Development (webpack dev server)
- **URL**: http://localhost:8080
- **Access**: Local machine only (or configured network)
- **SSL**: None
- **Backend**: Direct connection to localhost:8000

## Configuration Files

### Nginx Configurations
- `nginx/sites-available/littledan.com` - Production HTTPS configuration
- `nginx/sites-available/localhost-dev` - Development HTTP configuration
- `nginx/conf.d/` - Shared nginx configurations

### Deployment Paths
- **Production Frontend**: `/var/www/littledan.com/`
- **Development Frontend**: `/var/www/localhost-dev/`
- **Backend**: `/opt/markdown-manager-api/`

## Benefits of Each Approach

### nginx localhost (Development)
✅ **Pros:**
- Real nginx environment (closer to production)
- Accessible from any device on local network
- Proper API proxying
- Fast incremental builds
- No CORS issues

❌ **Cons:**
- Requires nginx configuration
- Manual rebuild needed (unless using file watcher)

### webpack dev server (Development)
✅ **Pros:**
- Hot module replacement
- Fastest development cycle
- No nginx setup required
- Built-in development features

❌ **Cons:**
- Different environment from production
- Potential CORS issues
- Only accessible from local machine (by default)

### Production
✅ **Pros:**
- Full HTTPS security
- Optimized builds
- Production-grade nginx configuration
- Public accessibility

❌ **Cons:**
- Slower build times
- Requires SSL certificates
- Less suitable for rapid development

## File Watching and Auto-Rebuild

When using nginx localhost development mode, the file watcher will automatically rebuild the frontend when files change. This provides a balance between production-like environment and development convenience.

To manually trigger a rebuild:
```bash
cd frontend && npm run build:dev
```

## Troubleshooting

### VS Code Simple Browser Issues
If the VS Code Simple Browser shows a white screen, this is a known limitation with complex JavaScript applications. The application works correctly in external browsers.

**Solution**: Use an external browser for testing:
- **Chrome/Edge**: http://localhost (development) or https://littledan.com (production)
- **Mobile testing**: Use your mobile device browser on the same network
- **Cross-device testing**: Any device on 10.0.1.0/24 can access http://localhost

### nginx Permission Issues
```bash
# Add user to nginx-admin group
sudo usermod -a -G nginx-admin $USER

# Reload group membership
newgrp nginx-admin
```

### Port Conflicts
- Backend: Default port 8000
- Webpack dev server: Default port 8080
- nginx: Ports 80 (HTTP) and 443 (HTTPS)

### Network Access Issues
Check nginx configuration allows your IP range:
```nginx
allow 127.0.0.1;
allow 10.0.1.0/24;
```

## Best Practices

1. **Use nginx localhost for most development** - It's closer to production environment
2. **Use webpack dev server for rapid UI changes** - When you need hot reload
3. **Use incremental builds** - Faster feedback during development
4. **Test both environments** - Ensure compatibility between development and production
5. **Use production deployment for staging/testing** - Before going live

## Database Management

### Database Location and Git

- **Database file**: `backend/markdown_manager.db` (SQLite)
- **Important**: Database files are **excluded from git** for security and performance
- Each environment (dev/staging/prod) maintains its own database

### Database Operations

```bash
# Run migrations (apply schema changes)
make migrate

# Create new migration
make migrate-create MIGRATION_NAME="description_of_change"

# Backup database
make db-backup

# Restore from backup
make db-restore BACKUP_FILE="path/to/backup.db"

# Check migration status
make status
```

### First Time Setup

1. Ensure backend dependencies are installed: `cd backend && poetry install`
2. Run initial migrations: `make migrate`
3. Database will be created automatically if it doesn't exist

### Production Database

- Production database is backed up before each deployment
- Database is excluded from rsync during deployment
- Migrations are run automatically during deployment

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
# Full development deployment
./deploy/deploy.sh dev

# Skip build (use existing dist)
./deploy/deploy.sh dev true

# Skip backend deployment
./deploy/deploy.sh dev false true

# Incremental build (faster, development only)
./deploy/deploy.sh dev false false true
```

### Production Deployment
```bash
# Full production deployment
./deploy/deploy.sh production

# Skip build
./deploy/deploy.sh production true

# Skip backend
./deploy/deploy.sh production false true
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

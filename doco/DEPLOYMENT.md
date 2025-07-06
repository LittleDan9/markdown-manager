# Deployment Guide

This project includes multiple deployment options for different environments and use cases.

## Quick Start

```bash
# Build and deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging

# Deploy without rebuilding (if you just built)
npm run deploy:skip-build
```

## Available Commands

### Build Commands
- `npm run build` - Build for production
- `npm run build:clean` - Clean build directory and build for production
- `npm run build:dev` - Build for development
- `npm run build:analyze` - Build with bundle analysis

### Development Commands
- `npm run serve` - Start development server
- `npm run serve:prod` - Start production server for testing

### Deployment Commands
- `npm run deploy` - Build and deploy to production
- `npm run deploy:staging` - Build and deploy to staging
- `npm run deploy:skip-build` - Deploy to production without rebuilding
- `npm run deploy:staging:skip-build` - Deploy to staging without rebuilding
- `npm run deploy:legacy` - Use the original deploy.sh script

## Deployment Configuration

The deployment is configured via the `Makefile` and supports:

### Environments
- **Production**: Deploys to main website
- **Development**: Local development servers

### Automatic Target Detection
The deployment script automatically detects whether you're deploying:
- **Locally** (when hostname is "Danbian"): Direct file copy
- **Remotely** (other hostnames): rsync over SSH

### Deployment Features
- ✅ Automatic build verification
- ✅ Progress indicators with colors
- ✅ File cleanup and optimization
- ✅ Post-deployment verification
- ✅ Error handling and rollback
- ✅ Skip build option for faster deployments

## Manual Deployment

You can also use the enhanced bash script directly:

```bash
# Basic deployment
./deploy.sh

# Skip build step
./deploy.sh production true

# Deploy to staging
./deploy.sh staging
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x deploy.sh
   chmod +x scripts/deploy.js
   ```

2. **SSH Key Issues**
   - Ensure your SSH key is set up for the remote server
   - Test connection: `ssh dlittle@10.0.1.51`

3. **Build Failures**
   - Run `npm run build:clean` to start fresh
   - Check for syntax errors in your code
   - Verify all dependencies are installed

4. **Deployment Verification Failed**
   - Check that the destination directory exists
   - Verify write permissions on the target directory
   - Ensure the web server is running

### Logs and Debugging

The deployment script provides colored output to help identify issues:
- 🔴 Red: Errors
- 🟡 Yellow: Warnings
- 🟢 Green: Success messages
- 🔵 Blue: Information

## Configuration

Edit the `Makefile` to customize:
- Deployment targets
- Build configuration
- Service management
- Environment variables

## Commands

Use `make help` to see all available commands for deployment, development, and maintenance.

# Migration from Legacy Shell Script Deployment to Ansible

## Overview

This guide helps you migrate from the legacy shell script deployment system to the new Ansible-based deployment system on your Danbian production server.

## Migration Process

### Phase 1: Identify and Backup User Data (CRITICAL)

**🚨 CRITICAL STEP: Before starting migration, identify and backup user data!**

```bash
# Step 1: Analyze what data exists and where
./deployment/check-user-data.sh

# Step 2: Backup only the essential user data (much faster):
# User documents (the most important data):
scp -i ~/.ssh/id_danbian -r dlittle@10.0.1.51:'/opt/markdown-manager-api/documents' ./backup-user-documents-$(date +%Y%m%d)/

# Database:
mkdir -p ./backup-database-$(date +%Y%m%d)
scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'/opt/markdown-manager-api/app/markdown_manager.db' ./backup-database-$(date +%Y%m%d)/

# Environment configuration:
mkdir -p ./backup-config-$(date +%Y%m%d)
scp -i ~/.ssh/id_danbian dlittle@10.0.1.51:'/opt/markdown-manager-api/.env' ./backup-config-$(date +%Y%m%d)/

# Step 3: Backup system state
ssh dlittle@10.0.1.51 "
  # Backup current containers
  docker ps -a > ~/backup-containers-$(date +%Y%m%d).txt
  
  # Backup systemd services
  systemctl list-units '*markdown-manager*' > ~/backup-services-$(date +%Y%m%d).txt
  
  # Backup any important data volumes
  docker volume ls > ~/backup-volumes-$(date +%Y%m%d).txt
  
  # Backup nginx config if customized
  sudo cp -r /etc/nginx ~/backup-nginx-$(date +%Y%m%d)
"

# Step 4: Verify backups are complete
ls -la ./backup-*
```

**⚠️ DO NOT PROCEED until you have confirmed all user data is backed up!**

### Phase 2: Run Legacy Cleanup

The cleanup script will safely remove legacy deployment artifacts:

```bash
# Run the legacy cleanup script directly
./deployment/cleanup-legacy.sh

# Alternative: Use the deployment script wrapper
./deploy-ansible.sh cleanup-legacy

# Alternative: Use Makefile
make deploy-ansible-cleanup-legacy
```

**What the cleanup does:**
- ✅ Stops legacy containers gracefully
- ✅ Removes legacy systemd services  
- ✅ Cleans up legacy directories in `/opt/`
- ✅ Removes dangling Docker images/volumes
- ✅ Prepares directories for Ansible management
- ✅ Provides multiple confirmation prompts for safety

### Phase 3: Deploy with Ansible

After cleanup, deploy the new Ansible-managed services:

```bash
# Deploy all services
./deploy-ansible.sh all

# Or deploy incrementally
./deploy-ansible.sh redis
./deploy-ansible.sh event-publisher
./deploy-ansible.sh backend
./deploy-ansible.sh nginx
```

### Phase 4: Verification

Verify the new deployment is working:

```bash
# Check container status
ssh dlittle@10.0.1.51 "docker ps"

# Check systemd services  
ssh dlittle@10.0.1.51 "systemctl status markdown-manager-*"

# Test health endpoints
curl http://10.0.1.51:8000/health
curl http://10.0.1.51:8001/health
curl http://10.0.1.51:8002/health
curl http://10.0.1.51:8003/health

# Test UI
curl -I http://10.0.1.51/
```

## Key Differences

### Legacy System (Shell Scripts)
- **Manual deployment**: Scripts in `scripts/deploy/`
- **Ad-hoc naming**: Inconsistent container names
- **Manual systemd**: Hand-created service files
- **Complex dependencies**: Shell script logic for ordering
- **UI as service**: Node.js container for frontend
- **Error-prone**: No idempotency or rollback

### New System (Ansible)
- **Configuration-driven**: All services defined in `config.yml`
- **Consistent naming**: Standardized `markdown-manager-*` pattern  
- **Automated systemd**: Generated service files with proper dependencies
- **Dependency management**: Explicit service ordering in config
- **UI as static files**: Nginx serves built assets directly
- **Robust**: Idempotent operations with error handling

## Service Name Changes

If you have any custom integrations or monitoring, update these service names:

| Legacy Name | New Ansible Name |
|-------------|------------------|
| `markdown-manager` | `markdown-manager-backend` |
| `markdown-manager-ui` | *(Removed - static files)* |
| `event-consumer` | `markdown-manager-linting-consumer` |
| `event-consumer` | `markdown-manager-spell-check-consumer` |
| `redis` | `markdown-manager-redis` |

## File Location Changes

| Legacy Location | New Location | Notes |
|----------------|--------------|-------|
| `/opt/markdown-manager/` | *(Removed)* | No longer needed |
| Custom nginx config | `/etc/nginx/` | Managed by Ansible |
| Manual systemd files | `/etc/systemd/system/markdown-manager-*.service` | Auto-generated |
| Environment files | `/etc/markdown-manager.env` | Centralized config |

## Rollback Plan

If you need to rollback to the legacy system:

1. **Stop Ansible services**:
   ```bash
   ssh dlittle@10.0.1.51 "
     systemctl stop markdown-manager-*
     systemctl disable markdown-manager-*
   "
   ```

2. **Restore from backup**:
   ```bash
   # Restore nginx config
   ssh dlittle@10.0.1.51 "sudo cp -r ~/backup-nginx-* /etc/nginx/"
   
   # Restore legacy deployment
   cd scripts/deploy
   ./deploy-backend.sh
   ```

3. **Re-enable legacy services**:
   ```bash
   # Follow your original deployment process
   make deploy-backend-original
   ```

## Common Issues & Solutions

### Port Conflicts
**Problem**: New services can't bind to ports  
**Solution**: Legacy cleanup should stop old containers, but check manually:
```bash
ssh dlittle@10.0.1.51 "netstat -tlnp | grep :8000"
```

### Permission Issues  
**Problem**: Docker socket or file permissions  
**Solution**: Ensure user is in docker group:
```bash
ssh dlittle@10.0.1.51 "sudo usermod -aG docker dlittle"
```

### Registry Issues
**Problem**: Can't push/pull from local registry  
**Solution**: Check SSH tunnel and registry container:
```bash
# Check tunnel
curl http://localhost:5000/v2/

# Check registry on Danbian
ssh dlittle@10.0.1.51 "docker ps | grep registry"
```

### Systemd Service Issues
**Problem**: Services won't start automatically  
**Solution**: Check systemd service files and reload:
```bash
ssh dlittle@10.0.1.51 "
  systemctl daemon-reload
  systemctl enable markdown-manager-backend
  systemctl status markdown-manager-backend
"
```

## Post-Migration Cleanup

After successful migration, you can remove legacy deployment files:

```bash
# Remove legacy deployment scripts (optional)
rm -rf scripts/deploy/

# Remove legacy Makefile targets (optional)  
# Edit Makefile to remove deploy-backend-original, etc.

# Archive legacy docker-compose files
mv docker-compose.yml docker-compose.legacy.yml
```

## Benefits After Migration

✅ **Consistency**: All services managed identically  
✅ **Reliability**: Idempotent operations prevent drift  
✅ **Maintainability**: Single source of truth in `config.yml`  
✅ **Performance**: Static UI files served by nginx  
✅ **Monitoring**: Standardized service names and structure  
✅ **Scalability**: Easy to add new services  
✅ **Documentation**: Self-documenting configuration  

## Support

If you encounter issues during migration:

1. **Check deployment logs**: `deployment/logs/ansible.log`
2. **Run in check mode**: `./deploy-ansible.sh all --check`
3. **Test single services**: `./deploy-ansible.sh backend`
4. **Review systemd logs**: `ssh dlittle@10.0.1.51 "journalctl -u markdown-manager-backend"`
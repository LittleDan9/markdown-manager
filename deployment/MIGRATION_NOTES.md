# Deployment Migration Notes

This file documents important configuration changes that require manual intervention during production deployments.

## 2026-01-30: Event Publisher Configuration Fix

### Issue
The event-publisher service was failing to start due to environment variable configuration mismatch:
- Service expected: `RELAY_DATABASE_URL`, `RELAY_REDIS_URL` 
- Production provided: `DATABASE_URL`, `REDIS_URL`

### Impact
- Event-publisher service would fail to start
- Linting and spell-check event processing would not work
- Core API and UI would continue to function normally

### Required Changes

#### 1. Update Production Environment File

Add the following variables to `/etc/markdown-manager.env`:

```bash
# Event Publisher (RELAY_ prefix required)
RELAY_DATABASE_URL=sqlite:///data/markdown_manager.db  # or your PostgreSQL URL
RELAY_REDIS_URL=redis://markdown-manager-redis:6379/0
RELAY_BATCH_SIZE=50
RELAY_POLL_INTERVAL=5
RELAY_MAX_RETRY_ATTEMPTS=5
RELAY_LOG_LEVEL=INFO
```

#### 2. Deploy Updated Configuration

```bash
# Redeploy event-publisher with new configuration
make deploy-event-publisher

# Or redeploy all services
make deploy
```

#### 3. Verify Service Health

```bash
# Check that event-publisher is running
sudo systemctl status markdown-manager-event-publisher

# Check container logs
docker logs markdown-manager-event-publisher
```

### Files Modified
- `deployment/config.yml` - Updated environment variables for event-publisher
- `deployment/README.md` - Added RELAY_ variables to environment documentation
- `docs/deployment/environment.md` - Added comprehensive event-publisher configuration
- `services/event-publisher/app/config.py` - Added `env_prefix = "RELAY_"` to Settings class

### Verification
After deployment, the event-publisher logs should show successful connections:
```
Database connection successful
Redis connection successful
Starting outbox relay processing loop
```

### Notes
- This change is backward compatible - the service will use default values if RELAY_ variables are missing
- The original DATABASE_URL and REDIS_URL variables are still used by other services
- Event consumers depend on the event-publisher, so they may need restarting after this fix
# Redis Integration in Deployment

## Overview
Redis has been added as a core infrastructure service to support the event publishing/consuming system in the markdown-manager microservices architecture.

## Architecture
- **Redis**: Event store and message broker using Redis Streams
- **Event Publisher**: Publishes database events to Redis streams
- **Event Consumers**: Services consume events from Redis streams for processing
  - Linting Consumer: Processes document change events for linting
  - Spell-check Consumer: Processes document change events for spell checking

## Deployment Configuration

### Service Configuration (`deployment/config.yml`)
```yaml
redis:
  name: "markdown-manager-redis"
  image: "redis"
  tag: "7-alpine"
  port: 6379
  systemd_service: true
  health_check: "redis-cli ping"
  config_file: "/etc/redis/redis.conf"
  data_volume: "/var/lib/redis"
  networks:
    - "markdown-manager"
  restart_policy: "unless-stopped"
  command: ["redis-server", "/etc/redis/redis.conf"]
```

### Deployment Order
Redis is deployed first as it's a dependency for all event-related services:
1. **Redis** - Event store (required by all event services)
2. **Event Publisher** - Publishes events (depends on Redis)
3. **Core Services** - Export, Linting, Spell-check
4. **Event Consumers** - Auto-deployed for services with `consumer_config`
5. **Backend** - Main API
6. **UI** - Frontend

## Available Commands

### Deploy Redis Only
```bash
make deploy-ansible-redis
./deploy-ansible.sh redis
```

### Deploy Full Stack (including Redis)
```bash
make deploy-ansible
./deploy-ansible.sh all
```

### Test Redis Deployment
```bash
./deploy-ansible.sh redis --check  # Dry run
```

## Redis Configuration Features

### Production-Ready Settings
- **Persistence**: AOF (Append Only File) for durability
- **Memory Management**: LRU eviction with 256MB limit
- **Streams Optimization**: Configured for Redis Streams workload
- **Security**: Disabled dangerous commands in production
- **Performance**: Lazy freeing, optimized rewrite settings

### Health Monitoring
- **Container Health Check**: `redis-cli ping`
- **Systemd Integration**: Automatic restart on failure
- **Log Management**: Structured logging to `/data/redis.log`

### Data Persistence
- **Volume Mount**: `/var/lib/redis` for persistent storage
- **AOF Configuration**: Every-second sync for balance of durability/performance
- **Automatic Rewrite**: Triggered at 100% growth, minimum 64MB

## Event System Integration

### Environment Variables
Services that depend on Redis will have these environment variables:
```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/0
```

### Service Dependencies
- **Event Publisher**: Requires Redis for stream publishing
- **Linting Consumer**: Requires Redis for event consumption
- **Spell-check Consumer**: Requires Redis for event consumption
- **Backend**: May use Redis for caching (optional)

## Monitoring & Troubleshooting

### Check Redis Status
```bash
# Via Docker
docker exec markdown-manager-redis redis-cli ping

# Via systemd
systemctl status markdown-manager-redis

# Check logs
docker logs markdown-manager-redis
```

### Redis CLI Access
```bash
# Connect to Redis CLI
docker exec -it markdown-manager-redis redis-cli

# Monitor Redis streams
XINFO STREAM document_events
XRANGE document_events - +
```

### Common Issues
1. **Connection Refused**: Check if Redis container is running and healthy
2. **Data Loss**: Verify volume mount and AOF persistence settings
3. **Memory Issues**: Monitor Redis memory usage and adjust maxmemory if needed
4. **Stream Backlog**: Monitor consumer lag using `XPENDING` commands

## Security Considerations

### Production Security
- Password authentication (configure `requirepass` in production)
- Dangerous command renaming (already configured)
- Network isolation via Docker networks
- Volume permission management (Redis user ID: 999)

### Development vs Production
- Development: No password required, all commands enabled
- Production: Password required, dangerous commands disabled/renamed
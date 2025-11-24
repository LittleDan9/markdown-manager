# Phase 4 — System Service Files Update (Agent Scope)

## Goal
Update all systemd service files and production deployment configurations to reference new service locations and names. This phase ensures production systemd-managed containers work with the new structure.

## Files to Update

### Systemd Service Files
1. `services/backend/markdown-manager-api.service`
2. `services/export/markdown-manager-export.service`
3. `services/linting/markdown-manager-lint.service`
4. `services/linting/markdown-manager-lint-consumer.service`
5. `services/spell-check/markdown-manager-spell-check.service`
6. `services/spell-check/markdown-manager-spell-check-consumer.service`
7. Any relay/event-publisher service files

### Configuration Files
1. Production environment files
2. Service-specific configuration files
3. Consumer configuration files

## Tasks

### 1. Update Service File Locations

#### Move Service Files to New Locations
```bash
# Move service files to their new service directories
# (if they aren't already there after directory moves)
```

### 2. Update Docker Image References

#### Backend Service
```ini
# Before
ExecStart=/usr/bin/docker run --name markdown-manager-api \
  --image littledan9/markdown-manager:latest

# After - update if image name changes
ExecStart=/usr/bin/docker run --name markdown-manager-api \
  --image littledan9/markdown-manager:latest
```

#### Export Service
```ini
# Verify image name consistency
ExecStart=/usr/bin/docker run --name markdown-manager-export \
  --image littledan9/markdown-manager-export:latest
```

#### Linting Service
```ini
# Before
ExecStart=/usr/bin/docker run --name markdown-manager-lint \
  --image littledan9/markdown-manager-lint:latest

# After
ExecStart=/usr/bin/docker run --name markdown-manager-linting \
  --image littledan9/markdown-manager-linting:latest
```

#### Linting Consumer Service
```ini
# Before
ExecStart=/usr/bin/docker run --name markdown-manager-lint-consumer \
  --image littledan9/markdown-manager-consumer:latest \
  -v /opt/markdown-manager/configs/markdown-lint-consumer.config.json:/app/config/consumer.config.json:ro

# After
ExecStart=/usr/bin/docker run --name markdown-manager-linting-consumer \
  --image littledan9/markdown-manager-event-consumer:latest \
  -v /opt/markdown-manager/configs/linting-consumer.config.json:/app/config/consumer.config.json:ro
```

#### Spell Check Services
```ini
# Update consumer service references
ExecStart=/usr/bin/docker run --name markdown-manager-spell-check-consumer \
  --image littledan9/markdown-manager-event-consumer:latest \
  -v /opt/markdown-manager/configs/spell-check-consumer.config.json:/app/config/consumer.config.json:ro
```

### 3. Add Event Publisher Service

#### Create Event Publisher Systemd Service
```ini
[Unit]
Description=Markdown Manager Event Publisher Service
After=docker.service postgresql.service redis.service
Requires=docker.service
Wants=postgresql.service redis.service

[Service]
Type=forking
Restart=always
RestartSec=5
TimeoutStartSec=300
TimeoutStopSec=30

# Stop any existing container
ExecStartPre=-/usr/bin/docker stop markdown-manager-event-publisher
ExecStartPre=-/usr/bin/docker rm markdown-manager-event-publisher

# Start the container
ExecStart=/usr/bin/docker run -d --name markdown-manager-event-publisher \
  --network markdown-manager-network \
  --env-file /etc/markdown-manager.env \
  --restart unless-stopped \
  littledan9/markdown-manager-event-publisher:latest

# Stop the container
ExecStop=/usr/bin/docker stop markdown-manager-event-publisher
ExecStopPost=/usr/bin/docker rm markdown-manager-event-publisher

[Install]
WantedBy=multi-user.target
```

### 4. Update Configuration File References

#### Consumer Configuration Paths
Update deployment scripts that copy consumer configs:

```bash
# In deploy-remote.sh
# Before
sudo cp /tmp/markdown-lint-consumer.config.json /opt/markdown-manager/configs/markdown-lint-consumer.config.json

# After
sudo cp /tmp/linting-consumer.config.json /opt/markdown-manager/configs/linting-consumer.config.json
```

### 5. Update Consumer Group Names

#### Update consumer.config.json Files
Update Redis consumer group names in configuration files:

```json
// services/linting/consumer.config.json
{
  "service": {
    "name": "linting-consumer",
    "domain": "linting",
    "schema": "linting"
  },
  "consumer_group": "linting_group",
  "topics": [
    "identity.user.v1"
  ]
}
```

```json
// services/spell-check/consumer.config.json
{
  "service": {
    "name": "spell-check-consumer",
    "domain": "spell_checking",
    "schema": "spell_checking"
  },
  "consumer_group": "spell_check_group",
  "topics": [
    "identity.user.v1"
  ]
}
```

## Deliverables
1. All systemd service files updated with new image references
2. Container names updated to match new service structure
3. Consumer configuration file paths updated
4. Event publisher systemd service created
5. Consumer group names updated in configuration files
6. Production configuration deployment updated
7. Validation that systemd services can be enabled and started

## Testing

### Service File Validation
```bash
# Validate systemd service files
sudo systemctl daemon-reload
sudo systemctl status markdown-manager-api
sudo systemctl status markdown-manager-export
sudo systemctl status markdown-manager-linting
sudo systemctl status markdown-manager-event-publisher
```

### Configuration Validation
```bash
# Test configuration file parsing
python -c "import json; print('Valid JSON' if json.load(open('services/linting/consumer.config.json')) else 'Invalid')"
python -c "import json; print('Valid JSON' if json.load(open('services/spell-check/consumer.config.json')) else 'Invalid')"
```

### Docker Image Availability
```bash
# Verify new Docker images exist or can be built
docker pull littledan9/markdown-manager-linting:latest
docker pull littledan9/markdown-manager-event-consumer:latest
docker pull littledan9/markdown-manager-event-publisher:latest
```

## Exit Criteria
- ✅ All systemd service files reference correct Docker images
- ✅ Container names updated consistently across all services
- ✅ Consumer configuration file paths corrected in service files
- ✅ Event publisher systemd service created and functional
- ✅ Consumer group names updated in configuration files
- ✅ `systemctl daemon-reload` executes without errors
- ✅ All services can be enabled with `systemctl enable`
- ✅ Production deployment scripts updated for new config paths

## Agent Prompt Template
```
You are tasked with Phase 4 of the services refactor: System Service Files Update.

Your goal is to:
1. Update all systemd service files to reference new Docker images
2. Update container names to match new service structure
3. Create systemd service for event-publisher
4. Update consumer configuration file references
5. Update consumer group names in config files
6. Verify systemd services load correctly

Test thoroughly:
- Run systemctl daemon-reload
- Check service file syntax with systemctl status
- Validate configuration file JSON syntax
- Verify Docker images are available

Document any systemd or configuration issues found.
```

## Production Considerations

### Rolling Deployment
- Consider blue-green deployment for image name changes
- Update one service at a time to minimize downtime
- Verify Redis consumer group continuity

### Backup Strategy
- Backup existing systemd service files before changes
- Keep old Docker images available during transition
- Document rollback procedures for each service

### Monitoring
- Update monitoring systems to expect new container names
- Verify log aggregation picks up new service names
- Update alerting rules for new service identifiers

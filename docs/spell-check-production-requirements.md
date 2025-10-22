# Production Environment Variables and Configuration Requirements
# Spell Check Service - Additional Production Setup

## 1. Environment Variables Required

### Backend API Service (/etc/markdown-manager.env)
The spell-check service URL should be configurable for production. Add this to `/etc/markdown-manager.env`:

```bash
# Spell Check Service Configuration
SPELL_CHECK_SERVICE_URL=http://localhost:8003
```

### Systemd Service Environment Variables
The spell-check service systemd file should be updated to support environment variables:

```bash
# Optional: Custom port for spell check service
SPELL_CHECK_PORT=8003

# Optional: Node environment  
NODE_ENV=production

# Optional: Memory limits for Node.js
NODE_OPTIONS=--max-old-space-size=512
```

## 2. Required Sudoers Permissions

### Complete Sudoers Configuration
Add these lines to `/etc/sudoers` or create `/etc/sudoers.d/markdown-manager-deployment`:

```bash
# Spell Check Service - Systemd Management
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl enable markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl disable markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl start markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl stop markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl restart markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl is-enabled markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/systemctl status markdown-manager-spell-check.service

# Spell Check Service - File Operations
%deployment_user ALL=(ALL) NOPASSWD: /bin/cp /tmp/markdown-manager-spell-check.service /etc/systemd/system/markdown-manager-spell-check.service
%deployment_user ALL=(ALL) NOPASSWD: /bin/rm -f /etc/systemd/system/markdown-manager-spell-check.service

# Note: These are IN ADDITION to existing permissions for other services
```

## 3. Updated Production Files

### A. Backend API Service File
Update `/etc/systemd/system/markdown-manager-api.service` to include spell-check service URL:

```bash
ExecStart=/usr/bin/docker run --rm --name markdown-manager-api \
  -e DATABASE_URL=${DATABASE_URL} \
  -e EXPORT_SERVICE_URL=${EXPORT_SERVICE_URL} \
  -e MARKDOWN_LINT_SERVICE_URL=${MARKDOWN_LINT_SERVICE_URL} \
  -e SPELL_CHECK_SERVICE_URL=${SPELL_CHECK_SERVICE_URL} \
  # ... other environment variables
```

### B. Spell Check Service File
Update `spell-check-service/markdown-manager-spell-check.service`:

```bash
[Unit]
Description=Spell Check Service for Markdown Manager
After=network.target docker.service
Wants=network.target
Requires=docker.service

[Service]
Type=simple
User=dlittle
Group=dlittle
WorkingDirectory=/home/dlittle
EnvironmentFile=-/etc/markdown-manager.env
ExecStartPre=-/usr/bin/docker stop markdown-manager-spell-check
ExecStartPre=-/usr/bin/docker rm markdown-manager-spell-check
ExecStart=/usr/bin/docker run --rm --name markdown-manager-spell-check \
    --publish ${SPELL_CHECK_PORT:-8003}:8003 \
    -e NODE_ENV=${NODE_ENV:-production} \
    -e NODE_OPTIONS=${NODE_OPTIONS:---max-old-space-size=512} \
    --health-cmd="curl -f http://localhost:8003/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=40s \
    --restart=unless-stopped \
    littledan9/markdown-manager-spell-check:latest
ExecStop=/usr/bin/docker stop markdown-manager-spell-check
Restart=always
RestartSec=5

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

# Resource limits
LimitNOFILE=65536
MemoryLimit=512M

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=markdown-manager-spell-check

[Install]
WantedBy=multi-user.target
```

## 4. Code Updates Required

### A. Backend Service Client
Update `backend/app/services/spell_check_service.py`:

```python
import os

class SpellCheckServiceClient:
    def __init__(self, base_url: str = None):
        if base_url is None:
            base_url = os.getenv("SPELL_CHECK_SERVICE_URL", "http://localhost:8003")
        self.base_url = base_url.rstrip('/')
        # ... rest of implementation
```

## 5. Network Configuration

### A. Firewall Rules (if applicable)
```bash
# Allow internal communication to spell-check service
sudo ufw allow from 10.0.0.0/8 to any port 8003
sudo ufw allow from 172.16.0.0/12 to any port 8003  
sudo ufw allow from 192.168.0.0/16 to any port 8003
```

### B. Docker Network (if using custom networks)
Ensure spell-check service is on the same Docker network as other services.

## 6. Monitoring and Logging

### A. Log Rotation
Add to `/etc/logrotate.d/markdown-manager-spell-check`:

```bash
/var/log/journal/markdown-manager-spell-check.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    create 644 syslog adm
}
```

### B. Health Check Monitoring
Consider adding the spell-check service to your monitoring system:

```bash
# Example health check script
#!/bin/bash
curl -f http://localhost:8003/health || {
    echo "Spell check service is down"
    # Alert logic here
}
```

## 7. Production Deployment Checklist

Before deploying to production:

- [ ] Add `SPELL_CHECK_SERVICE_URL` to `/etc/markdown-manager.env`
- [ ] Update sudoers permissions for deployment user
- [ ] Update backend API service file with new environment variable
- [ ] Update spell-check service file with environment support
- [ ] Test service health checks
- [ ] Verify firewall rules allow internal communication
- [ ] Set up log rotation
- [ ] Add to monitoring system

## 8. Security Considerations

### A. Service Isolation
- Spell-check service runs as non-root user
- Limited system access via systemd security settings
- Memory limits prevent resource exhaustion

### B. Network Security
- Service only accessible internally (localhost)
- No external network access required
- CORS policies configured for same-origin requests

### C. Data Security
- No persistent storage required
- Text processed in memory only
- No sensitive data cached or logged

---

## Summary

The spell-check service requires minimal additional production configuration beyond what's already implemented. The main additions needed are:

1. **Environment variable configuration** for service URL
2. **Sudoers permissions** for systemd management
3. **Updated service files** to support environment variables
4. **Minor code update** to read service URL from environment

All security and performance considerations have been built into the existing implementation.
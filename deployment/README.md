# Ansible Deployment System

This directory contains the native Ansible-based deployment system for Markdown Manager services.

## Overview

The deployment system uses native Ansible installation to deploy services to the Danbian production server. It replaces the complex shell script system with a mature, configuration-driven approach that ensures services are actually operational before marking deployment as successful.

## Architecture

```
[Development Machine] → [Native Ansible] → [SSH] → [Danbian Production]
         ↓                                         ↓
    Auto-install Ansible                    Deploy Services
    Build Images Locally                    Update Systemd
    Push to Registry                        Validate Health Checks
    Verify Success                          Update Nginx
```

## Quick Start

The deployment system automatically installs Ansible if needed, then deploys services with proper health validation.

### Deploy All Services

```bash
make deploy-ansible
```

### Deploy Single Service

```bash
make deploy-ansible-backend
make deploy-ansible-export
make deploy-ansible-linting
make deploy-ansible-spell-check
# etc.
```

### Prerequisites

- SSH access to production server (`~/.ssh/id_danbian`)
- Docker installed locally (for building images)
- Ubuntu/Debian system (for automatic Ansible installation)

## Directory Structure

This deployment system follows **standard Ansible best practices** and conventions:

```text
deployment/
├── ansible.cfg                 # Ansible configuration (callbacks, SSH settings)
├── inventory.yml              # Target hosts (YAML format preferred over INI)
├── deploy.yml                 # Main deployment playbook
├── config.yml                 # Custom: Centralized service configuration
├── group_vars/               # Standard: Group-specific variables
│   └── production.yml        #   Environment-specific settings
├── roles/                    # Standard: Ansible roles directory
│   ├── infrastructure/       #   Infrastructure setup role
│   │   └── tasks/main.yml    #   Standard role task structure
│   ├── docker_service/       #   Reusable service deployment role
│   │   ├── tasks/main.yml    #   Main task file
│   │   └── templates/        #   Jinja2 templates
│   ├── nginx_config/         #   Nginx configuration role
│   │   ├── tasks/main.yml    #   Tasks for nginx setup
│   │   ├── templates/        #   Nginx configuration templates
│   │   └── handlers/         #   Standard: Service restart handlers
│   └── redis/                #   Redis deployment role
│       ├── tasks/main.yml    #   Redis-specific tasks
│       ├── templates/        #   Redis configuration templates
│       └── handlers/         #   Redis service handlers
├── test-*.yml                # Test playbooks for validation
└── setup-sudoers.sh          # Custom: Deployment preparation script
```

### Standard vs Custom Elements

**✅ Standard Ansible Conventions:**
- Role structure (`tasks/main.yml`, `templates/`, `handlers/`)
- Group variables in `group_vars/`
- YAML inventory format
- Playbook naming conventions

**🚀 Custom Enhancements:**
- `config.yml` - Single source of truth for service configuration
- Containerized execution with `docker-compose.yml`
- Service-specific roles (redis, nginx_config)
- Automated sudoers setup script

This structure ensures maintainability and follows industry standards while adding custom optimizations for containerized deployment.

## Configuration Files

- `config.yml` - Service definitions and deployment settings
- `inventory.yml` - Target hosts (Danbian production server)
- `ansible.cfg` - Ansible behavior configuration
- `group_vars/production.yml` - Environment-specific variables

## Ansible Roles

### infrastructure
Sets up Docker, networks, registry, and systemd directories.

### registry  
Establishes SSH tunnel to production registry for image transfers.

### docker_service
Reusable role that:
1. Builds Docker images locally
2. Pushes to production registry via SSH tunnel
3. Deploys containers on production server
4. Creates systemd services for auto-restart
5. Performs health checks

### nginx_config
Updates nginx configuration files and reloads the service.

### cleanup
Removes old Docker images, keeping only the latest N versions.

## Service Configuration

Each service in `config.yml` supports:

```yaml
services:
  backend:
    name: "markdown-manager-backend"        # Container name
    image: "littledan9/markdown-manager"    # Image name
    tag: "latest"                           # Image tag
    port: 8000                              # Exposed port
    build_context: "./services/backend"     # Build directory
    dockerfile: "Dockerfile"                # Dockerfile name
    systemd_service: true                   # Create systemd service
    health_check: "/health"                 # Health check endpoint
    env_file: "/etc/markdown-manager.env"   # Environment file
    networks: ["markdown-manager"]          # Docker networks
    restart_policy: "unless-stopped"       # Container restart policy
```

## Deployment Process

1. **Build Phase**: Images built locally with Docker
2. **Registry Phase**: SSH tunnel established, images pushed
3. **Deploy Phase**: Containers deployed on production
4. **Service Phase**: Systemd services created/updated
5. **Health Phase**: Services verified as healthy
6. **Cleanup Phase**: Old images removed

## SSH Configuration

The system requires SSH key access to Danbian:
- Key file: `~/.ssh/id_danbian`
- User: `dlittle`
- Host: `10.0.1.51`

## Testing

### Dry Run
Test without making changes:
```bash
make deploy-ansible-dry-run
```

### Single Service Test
Test one service deployment:
```bash
make deploy-ansible-backend
```

## Logs

Deployment logs are stored in `./logs/ansible.log` and displayed during execution.

## Migration from Shell Scripts

The old shell script deployment system (`scripts/deploy/`) is preserved for fallback:

```bash
# New Ansible system
make deploy-ansible-backend

# Old shell system (fallback)
make deploy-backend-only
```

## Troubleshooting

### SSH Tunnel Issues
```bash
# Check if tunnel is active
curl -s http://localhost:5000/v2/

# Kill existing tunnels
pkill -f "ssh.*5000:localhost:5000"
```

### Registry Problems
```bash
# Check registry status on Danbian
ssh dlittle@10.0.1.51 "docker ps | grep registry"

# Check Docker daemon config
cat ~/.docker/daemon.json
```

### Service Deployment Issues
```bash
# Check service logs on Danbian
ssh dlittle@10.0.1.51 "docker logs markdown-manager-backend"

# Check systemd status
ssh dlittle@10.0.1.51 "systemctl status markdown-manager-backend"
```

## Adding New Services

1. Add service definition to `config.yml`
2. Add to `service_deploy_order` if dependencies exist
3. Add Makefile target:
   ```makefile
   deploy-ansible-newservice: ## Deploy new service
       @cd deployment && docker compose run --rm ansible-deploy deploy.yml -i inventory.yml --tags newservice
   ```

## Benefits Over Shell Scripts

✅ **Configuration-driven** - YAML instead of complex shell logic  
✅ **Idempotent** - Safe to run multiple times  
✅ **Error handling** - Built-in rollback and retry logic  
✅ **Reusable** - Single role handles all services  
✅ **Maintainable** - Clear separation of concerns  
✅ **Testable** - Dry-run mode for validation  
✅ **Extensible** - Easy to add new services  
✅ **Versioned** - Ansible container ensures consistency
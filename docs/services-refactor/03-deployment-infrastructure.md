# Phase 3 — Deployment Infrastructure Update (Agent Scope)

## Goal
Update all deployment scripts, Makefile, and service configuration files to reference new service paths and names. This phase ensures production deployment continues to work with the new structure.

## Files to Update

### Primary Targets
1. `Makefile` - Build and deployment targets
2. `scripts/deploy-backend-services.sh` - Backend deployment orchestration
3. `scripts/deploy/deploy-services.sh` - Service deployment automation
4. `scripts/deploy/deploy-common.sh` - Service configuration mappings
5. `scripts/deploy/deploy-build.sh` - Docker image building
6. `scripts/deploy/deploy-remote.sh` - Remote deployment

## Tasks

### 1. Update Makefile

#### Directory Variables
Update directory variable definitions:

```makefile
# Before
BACKEND_DIR := ./backend
EXPORT_DIR := ./export-service
LINT_DIR := ./markdown-lint-service
SPELL_CHECK_DIR := ./spell-check-service
CONSUMER_DIR := ./consumer-service-base

# After
BACKEND_DIR := ./services/backend
EXPORT_DIR := ./services/export
LINT_DIR := ./services/linting
SPELL_CHECK_DIR := ./services/spell-check
CONSUMER_DIR := ./services/event-consumer
EVENT_PUBLISHER_DIR := ./services/event-publisher
```

#### Build Targets
Update build targets to use new directories:

```makefile
build-backend:
	cd $(BACKEND_DIR) && docker build -t littledan9/markdown-manager:latest .

build-export:
	cd $(EXPORT_DIR) && docker build -t littledan9/markdown-manager-export:latest .
```

### 2. Update deploy-common.sh

#### Service Configuration Array
Update the SERVICE_CONFIG array:

```bash
# Before
SERVICE_CONFIG=(
    ["backend"]="./backend:littledan9/markdown-manager:latest:8000"
    ["export"]="./export-service:littledan9/markdown-manager-export:latest:8001"
    ["lint"]="./markdown-lint-service:littledan9/markdown-manager-lint:latest:8002"
    ["spell-check"]="./spell-check-service:littledan9/markdown-manager-spell-check:latest:8003"
    ["consumer"]="./consumer-service-base:littledan9/markdown-manager-consumer:latest:0"
)

# After
SERVICE_CONFIG=(
    ["backend"]="./services/backend:littledan9/markdown-manager:latest:8000"
    ["export"]="./services/export:littledan9/markdown-manager-export:latest:8001"
    ["linting"]="./services/linting:littledan9/markdown-manager-linting:latest:8002"
    ["spell-check"]="./services/spell-check:littledan9/markdown-manager-spell-check:latest:8003"
    ["event-consumer"]="./services/event-consumer:littledan9/markdown-manager-event-consumer:latest:0"
    ["event-publisher"]="./services/event-publisher:littledan9/markdown-manager-event-publisher:latest:0"
)
```

#### Default Directory Variables
Update default directory paths:

```bash
DEFAULT_BACKEND_DIR="./services/backend"
DEFAULT_EXPORT_SERVICE_DIR="./services/export"
DEFAULT_LINT_SERVICE_DIR="./services/linting"
DEFAULT_SPELL_CHECK_SERVICE_DIR="./services/spell-check"
DEFAULT_CONSUMER_SERVICE_DIR="./services/event-consumer"
DEFAULT_EVENT_PUBLISHER_DIR="./services/event-publisher"
```

### 3. Update deploy-remote.sh

#### Consumer Config Deployment
Update paths for consumer configuration deployment:

```bash
# Before
scp -q -i "$ssh_key" "$lint_dir/consumer.config.json" "$remote_host:/tmp/markdown-lint-consumer.config.json"
scp -q -i "$ssh_key" "$spell_check_dir/consumer.config.json" "$remote_host:/tmp/spell-check-consumer.config.json"

# After
scp -q -i "$ssh_key" "$lint_dir/consumer.config.json" "$remote_host:/tmp/linting-consumer.config.json"
scp -q -i "$ssh_key" "$spell_check_dir/consumer.config.json" "$remote_host:/tmp/spell-check-consumer.config.json"
```

### 4. Update deploy-build.sh

#### Service Directory References
Update any hardcoded service directory references:

```bash
# Update service directories in configuration
SERVICE_CONFIG["backend"]="$backend_dir:$(get_service_image "backend"):$(get_service_port "backend")"
SERVICE_CONFIG["export"]="$export_dir:$(get_service_image "export"):$(get_service_port "export")"
SERVICE_CONFIG["linting"]="$lint_dir:$(get_service_image "linting"):$(get_service_port "linting")"
```

### 5. Update deploy-backend-services.sh

#### Service Deployment Order
Update deployment orchestration to use new service names:

```bash
# Deploy services in dependency order
echo "🔧 Building export service..."
deploy_service "export" "$registry_port" "$remote_host" "$ssh_key"

echo "🧪 Building linting service..."
deploy_service "linting" "$registry_port" "$remote_host" "$ssh_key"
```

## Docker Image Naming Updates

### New Docker Image Names
Update Docker Hub image names to match new service structure:

- `littledan9/markdown-manager-linting:latest` (was markdown-manager-lint)
- `littledan9/markdown-manager-event-consumer:latest` (was markdown-manager-consumer)
- `littledan9/markdown-manager-event-publisher:latest` (new)

## Deliverables
1. Updated Makefile with new directory variables
2. Updated deploy-common.sh with new service configuration
3. Updated deploy-remote.sh with new paths
4. Updated deploy-build.sh service references
5. Updated deploy-backend-services.sh orchestration
6. New Docker image naming convention implemented
7. Validation that deployment scripts execute without errors

## Testing

### Build Script Test
```bash
# Test individual service builds
make build-backend
make build-export
make build-linting
```

### Deployment Script Test
```bash
# Test deployment configuration parsing
bash scripts/deploy/deploy-common.sh
echo "Testing service config parsing..."
```

### Integration Test
```bash
# Test full deployment pipeline (dry run)
bash scripts/deploy-backend-services.sh --dry-run
```

## Exit Criteria
- ✅ Makefile builds all services successfully with new paths
- ✅ deploy-common.sh parses service configuration without errors
- ✅ All deployment scripts reference correct service directories
- ✅ Docker image names updated consistently across all scripts
- ✅ Service deployment order preserved and functional
- ✅ Consumer configuration deployment paths updated
- ✅ No references to old service paths in deployment scripts

## Agent Prompt Template
```
You are tasked with Phase 3 of the services refactor: Deployment Infrastructure Update.

Your goal is to:
1. Update Makefile directory variables and build targets
2. Update all deployment scripts to use new service paths
3. Update service configuration mappings in deploy-common.sh
4. Update Docker image names to match new service structure
5. Verify deployment scripts execute without errors

Test thoroughly:
- Run make build commands
- Execute deployment scripts in dry-run mode
- Verify service configuration parsing

Document any deployment dependencies or issues found.
```

## Rollback Considerations
- Keep backup of original deployment scripts
- Docker images with old names may still exist in registry
- Production systems may need gradual migration of image names
- Consider maintaining compatibility tags during transition

# Phase 6 — Legacy Cleanup (Agent Scope)

## Goal
Remove unused configuration files, deprecated patterns, and legacy references that are no longer needed after the services refactor. This phase cleans up technical debt and ensures the codebase is consistent with the new structure.

## Files to Remove/Update

### Legacy Consumer Configurations
1. `services/event-consumer/configs/linting.config.json` - Legacy detailed config
2. `services/event-consumer/configs/spell-check.config.json` - Legacy detailed config
3. Any unused configuration templates or examples

### Deprecated Documentation
1. Old README files referencing previous structure
2. Outdated deployment documentation
3. Legacy configuration examples

### Unused Scripts or Files
1. Old deployment scripts with hardcoded paths
2. Backup configuration files
3. Temporary files from previous refactors

## Tasks

### 1. Remove Legacy Consumer Configurations

#### Verify Configs Are Unused
First, confirm these legacy configs are not referenced:

```bash
# Search for references to legacy configs
grep -r "linting.config.json" .
grep -r "spell-check.config.json" .
grep -r "configs/linting" .
grep -r "configs/spell-check" .
```

#### Remove Legacy Config Files
```bash
# Remove unused consumer configs
rm -f services/event-consumer/configs/linting.config.json
rm -f services/event-consumer/configs/spell-check.config.json

# Remove configs directory if empty
rmdir services/event-consumer/configs/ 2>/dev/null || true
```

### 2. Update Documentation References

#### Update README Files
Update any README files that reference old structure:

```markdown
# Before
The consumer-service-base provides configuration-driven event consumption.
See configs/linting.config.json for an example.

# After
The event-consumer provides configuration-driven event consumption.
See individual service directories for consumer configurations:
- services/linting/consumer.config.json
- services/spell-check/consumer.config.json
```

#### Update Service-Specific Documentation
Update documentation in individual service directories:

```markdown
# services/event-consumer/README.md
# Remove references to configs/ directory
# Update examples to show volume mounting from service directories
```

### 3. Clean Up Configuration Templates

#### Remove Duplicate Configuration Examples
Remove any duplicate or outdated configuration examples:

```bash
# Look for duplicate config files
find . -name "*.config.json.example" -o -name "*.config.json.template"

# Remove if they reference old structure
```

### 4. Update Configuration Documentation

#### Update Consumer Configuration Documentation
Update documentation to reflect correct configuration locations:

```markdown
# Consumer Configuration

Each service that uses the event-consumer maintains its own configuration:

- **Linting Service**: `services/linting/consumer.config.json`
- **Spell Check Service**: `services/spell-check/consumer.config.json`

These configurations are mounted into the event-consumer container via Docker volumes.
```

### 5. Validate Configuration Consistency

#### Check Active Consumer Configurations
Ensure the active consumer configurations are properly formatted:

```bash
# Validate JSON syntax
python -m json.tool services/linting/consumer.config.json
python -m json.tool services/spell-check/consumer.config.json
```

#### Verify Configuration Schema
Ensure configurations match expected schema:

```json
// Expected schema for consumer.config.json
{
  "service": {
    "name": "string",
    "domain": "string",
    "schema": "string"
  },
  "redis": {
    "url": "string"
  },
  "consumer_group": "string",
  "topics": ["string"]
}
```

### 6. Remove Unused Dependencies

#### Check for Unused Imports or References
Scan for any code that might reference removed configurations:

```bash
# Search for references to removed config paths
grep -r "configs/linting" services/
grep -r "configs/spell-check" services/
grep -r "consumer-service-base/configs" .
```

#### Clean Up Import Statements
Remove any import statements or path references to removed files.

### 7. Update Deployment Scripts

#### Remove Legacy Config Deployment
Update deployment scripts to not deploy removed configs:

```bash
# In deploy-remote.sh, remove lines like:
# scp legacy-config.json remote:/opt/configs/
```

### 8. Update .gitignore if Needed

#### Remove Obsolete Ignore Patterns
Update .gitignore to remove patterns for deleted files:

```gitignore
# Remove if no longer relevant:
# consumer-service-base/configs/*.local.json
# *.config.backup
```

## Deliverables
1. Legacy consumer configuration files removed
2. Documentation updated to reflect new structure
3. Configuration templates cleaned up
4. Deployment scripts updated to not reference removed files
5. Code scanned and cleaned of references to removed configurations
6. Active configurations validated for syntax and schema
7. .gitignore updated if necessary
8. README files updated with correct configuration locations

## Validation

### Configuration Validation
```bash
# Ensure active configs are valid JSON
for config in services/*/consumer.config.json; do
  echo "Validating $config"
  python -m json.tool "$config" > /dev/null && echo "✅ Valid" || echo "❌ Invalid"
done
```

### Reference Check
```bash
# Ensure no broken references remain
grep -r "configs/linting" . && echo "❌ Found legacy references" || echo "✅ No legacy references"
grep -r "configs/spell-check" . && echo "❌ Found legacy references" || echo "✅ No legacy references"
```

### Docker Build Validation
```bash
# Ensure builds still work after cleanup
docker-compose build event-consumer
docker-compose build linting-consumer
docker-compose build spell-check-consumer
```

## Exit Criteria
- ✅ Legacy consumer configuration files removed
- ✅ No references to removed configuration files found in codebase
- ✅ Documentation updated to reflect new configuration locations
- ✅ Active consumer configurations validated for syntax and schema
- ✅ Docker builds succeed after cleanup
- ✅ Deployment scripts updated to not reference removed files
- ✅ No broken links or references in documentation
- ✅ README files accurate for new structure

## Agent Prompt Template
```text
You are tasked with Phase 6 of the services refactor: Legacy Cleanup.

Your goal is to:
1. Remove legacy consumer configuration files from event-consumer/configs/
2. Update documentation to reflect new configuration locations
3. Scan codebase for references to removed files
4. Validate active configurations are properly formatted
5. Update deployment scripts to not reference removed files

Validate thoroughly:
- Search for references to removed files
- Validate JSON syntax of remaining configs
- Test Docker builds after cleanup
- Verify documentation accuracy

Document any dependencies or references found that need attention.
```

## Rollback Plan

If issues are discovered:

### Restore Removed Files
```bash
# Restore from git if needed
git checkout HEAD~1 -- services/event-consumer/configs/
```

### Verify Dependencies
```bash
# Check if any services actually depend on removed configs
docker-compose up event-consumer
docker logs event-consumer_container_name
```

### Gradual Removal
- Consider moving files to `.deprecated/` directory first
- Monitor logs for any references to moved files
- Remove completely only after confirming no dependencies

# Phase 1 — Directory Structure Creation (Agent Scope)

## Goal
Create the new `services/` directory structure and move all service folders to their new locations with updated names. This phase focuses purely on directory reorganization without modifying file contents.

## Current Service Locations
- `backend/` → `services/backend/`
- `frontend/` → `services/frontend/`
- `export-service/` → `services/export/`
- `markdown-lint-service/` → `services/linting/`
- `spell-check-service/` → `services/spell-check/`
- `consumer-service-base/` → `services/event-consumer/`
- `relay-service/` → `services/event-publisher/`

## Tasks

### 1. Create Services Directory Structure
```bash
mkdir -p services
```

### 2. Move Services with New Names
Move each service directory to its new location:

```bash
# Move backend (no name change)
mv backend/ services/backend/

# Move frontend (no name change)
mv frontend/ services/frontend/

# Move and rename export service
mv export-service/ services/export/

# Move and rename markdown lint service
mv markdown-lint-service/ services/linting/

# Move spell check service (no name change)
mv spell-check-service/ services/spell-check/

# Move and rename consumer service base
mv consumer-service-base/ services/event-consumer/

# Move and rename relay service
mv relay-service/ services/event-publisher/
```

### 3. Verify Directory Structure
Ensure the final structure matches:

```text
services/
├── backend/
├── frontend/
├── export/
├── linting/
├── spell-check/
├── event-consumer/
└── event-publisher/
```

## Deliverables
1. All services moved to `services/` directory
2. Services renamed according to plan
3. Original service directories removed from root
4. Directory structure validation completed

## Method
- Use `mv` commands to relocate directories
- Verify each move operation succeeded
- Document any unexpected files or dependencies discovered
- Take note of any symlinks or special files that need attention

## Exit Criteria
- ✅ `services/` directory exists with all 7 service subdirectories
- ✅ All original service directories removed from workspace root
- ✅ No broken symlinks or missing files
- ✅ Each service directory contains expected files and structure
- ✅ Git shows clean rename operations (not delete/add)

## Agent Prompt Template
```
You are tasked with Phase 1 of the services refactor: Directory Structure Creation.

Your goal is to:
1. Create a new services/ directory
2. Move all service directories to their new locations with updated names
3. Verify the structure matches the plan

Use git mv commands where possible to preserve history.
Document any issues or unexpected dependencies found.
Do not modify file contents - only move and rename directories.
```

## Rollback Plan
If issues arise:
1. Use `git reset --hard HEAD` to revert changes
2. Individual service moves can be reversed with `mv services/[service]/ ./[original-name]/`
3. Remove empty `services/` directory if needed

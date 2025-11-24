# Services Refactor — Dependency-Aware Agent Prompts

This file defines the exact AI agent prompts (Claude Sonnet 4 / GPT-5) for each phase of the **Services Directory Refactor** program (see `00-refactor-plan.md`).

Each phase includes:

1. A helper (analysis / readiness) prompt
2. The implementation prompt (execution scope only for that phase)
3. Explicit dependency awareness (assume prior completed phases succeeded)

Use one phase per agent session. Do not intermingle tasks across phases. Output only assets/deliverables for the current phase.

---

## 🧭 GLOBAL CONTEXT (include in EVERY phase prompt)

> You are part of a coordinated multi-agent refactor to consolidate scattered services into a unified `services/` directory with consistent naming and deployment semantics. Each phase has its own markdown file (`01-directory-structure.md` … `08-documentation-update.md`) describing goals, tasks, and exit criteria. Assume all previously marked “complete” phases were implemented successfully. Docker Compose, Postgres, Redis, Nginx, and existing systemd/service deployment patterns are available. Preserve functionality; this is a structural/naming refactor, not a feature rewrite. Use Git moves (`git mv`) where possible to retain history. Avoid modifying application logic unless explicitly required for path/name alignment. All changes MUST respect the development environment guidelines and unification instructions under `.github/instructions/`.

---

## 🧩 Phase 1 — Directory Structure Creation

### 🔍 Helper Prompt (Phase 1)

```text
You are an expert repository restructuring engineer.
Scan the root for existing service directories (backend, frontend, export-service, markdown-lint-service, spell-check-service, consumer-service-base, relay-service).
Produce a readiness report:
- Confirm all 7 directories exist and list any extraneous service-like folders.
- Flag symlinks, large binaries, or generated artifacts that might need special handling during moves.
- Identify any top-level scripts that hardcode old paths (just list, do not modify).
Output concise markdown tables: Directory Inventory, Special Files, Hardcoded Path Candidates.
```

### 🚀 Implementation Prompt (Phase 1)

```text
You are executing Phase 1 — Directory Structure Creation.
Reference 01-directory-structure.md.

Goal: Create unified services/ directory and relocate/rename service folders without altering contents.

Tasks:
1. Create services/ root.
2. Move/rename:
   - backend → services/backend
   - frontend → services/frontend
   - export-service → services/export
   - markdown-lint-service → services/linting
   - spell-check-service → services/spell-check
   - consumer-service-base → services/event-consumer
   - relay-service → services/event-publisher
3. Use git mv to preserve history.
4. Verify resulting tree matches plan.
5. Record any anomalies (missing dirs, unexpected large files, broken symlinks) in a summary.

Dependencies: none (first phase).

Exit Criteria:
- All seven directories relocated and renamed under services/.
- No original service directories remain at root.
- Git status shows renames (not delete/add) where possible.
- Summary report `phase-complete/phase1-directory-structure.md` created.
Output: The summary markdown file only.
```

---

## 🧩 Phase 2 — Docker Configuration Update

### 🔍 Helper Prompt (Phase 2)

```text
Audit docker-compose.yml and service Dockerfiles.
List all build contexts, volume mounts, container names, depends_on entries referencing old paths/names.
Classify findings:
- Build Context Changes Needed
- Volume Path Changes Needed
- Service Name Adjustments (relay-service → event-publisher etc.)
- Consumer config mounts referencing old lint/spell paths.
Output a markdown checklist indicating each required update (unchecked state).
```

### 🚀 Implementation Prompt (Phase 2)

```text
You are executing Phase 2 — Docker Configuration Update.
Reference 02-docker-configuration.md.

Goal: Align docker-compose.yml and Docker-related paths with new services/ structure.

Tasks:
1. Update build contexts to services/*.
2. Update volume mounts to new directories.
3. Rename service entries where required (relay-service → event-publisher).
4. Adjust depends_on to new service keys.
5. Confirm consumer config mounts point to services/linting and services/spell-check.
6. Run docker-compose build && docker-compose up -d (document results; do not optimize images here).
7. Validate inter-service health endpoints via curl.

Dependencies: Phase 1 complete (new paths exist).

Exit Criteria:
- docker-compose.yml contains only new paths.
- All services build successfully.
- Containers start and health checks pass.
- No references to old directory names remain.
- Summary report `phase-complete/phase2-docker-update.md` with before/after snippets.
Output: The summary markdown file only.
```

---

## 🧩 Phase 3 — Deployment Infrastructure Update

### 🔍 Helper Prompt (Phase 3)

```text
Inspect Makefile and scripts/deploy/* for old path variables.
Extract:
- Variable Definitions (old vs target)
- Docker image names needing updates
- Any hardcoded scp/rsync paths referencing old directories
Provide a delta table: Item | Current | Required New | Risk (Low/Med/High).
```

### 🚀 Implementation Prompt (Phase 3)

```text
You are executing Phase 3 — Deployment Infrastructure Update.
Reference 03-deployment-infrastructure.md.

Goal: Update Makefile and deployment automation to reflect new service structure and image naming.

Tasks:
1. Update directory variables (backend, export, linting, spell-check, event-consumer, event-publisher).
2. Adjust service config arrays/maps in deploy-common.sh & related scripts.
3. Rename image targets (markdown-manager-lint → markdown-manager-linting, add event-publisher).
4. Update remote deployment paths for consumer configs (linting-consumer, spell-check-consumer).
5. Dry-run build/deploy scripts; capture output.
6. Document any residual legacy references.

Dependencies: Phases 1–2 complete (paths + Compose stable).

Exit Criteria:
- All scripts reference services/* paths.
- New image names consistently applied.
- Dry-run completes without path errors.
- Summary report `phase-complete/phase3-deployment-infra.md` including updated variable blocks.
Output: The summary markdown file only.
```

---

## 🧩 Phase 4 — System Service Files Update

### 🔍 Helper Prompt (Phase 4)

```text
Enumerate existing systemd *.service files (API, export, lint, spell, consumers, relay).
Identify which need image/container name changes and which must add event-publisher.
List:
- Service File | Old Image | New Image | Additional Volume/Env Changes.
Output markdown table and any missing expected service file.
```

### 🚀 Implementation Prompt (Phase 4)

```text
You are executing Phase 4 — System Service Files Update.
Reference 04-system-services.md.

Goal: Align systemd service units with new naming and introduce event-publisher service.

Tasks:
1. Update lint service to linting image name.
2. Update consumer service names and config mount file names.
3. Add event-publisher systemd unit (if absent).
4. Reload systemd (document commands; actual enable/start may be simulated if environment constrained).
5. Validate unit syntax (systemd-analyze verify if available).
6. Update consumer group references only if present in units.

Dependencies: Phases 1–3 complete.

Exit Criteria:
- All unit files reference correct images/container names.
- Event-publisher unit present and valid.
- No legacy image names remain.
- Summary report `phase-complete/phase4-system-services.md` with unified unit diffs.
Output: The summary markdown file only.
```

---

## 🧩 Phase 5 — Cross-Service References Update

### 🔍 Helper Prompt (Phase 5)

```text
Scan nginx configs (dev + sites-available), backend settings modules, and environment example files for outdated service hostnames.
Report findings grouped:
- Nginx Routes (Old → New)
- Backend Settings Variables
- Env Files / .env References
- Hardcoded HTTP calls in code (list file:path:line ranges)
Output concise markdown checklist.
```

### 🚀 Implementation Prompt (Phase 5)

```text
You are executing Phase 5 — Cross-Service References Update.
Reference 05-cross-service-references.md.

Goal: Ensure reverse proxy, backend config, env variables, and inter-service calls reflect new service names.

Tasks:
1. Update nginx-dev.conf and production configs for linting vs markdown-lint-service name.
2. Confirm backend settings service URL constants match Compose service names.
3. Replace any hardcoded old hostnames inside backend / other services with configurable settings usage.
4. Update env examples (.env / deployment env) with new keys if needed.
5. Curl test routes through nginx and direct service ports.

Dependencies: Phases 1–4 complete.

Exit Criteria:
- Nginx routes functional for all services.
- Backend references only new URLs.
- No grep hits for deprecated service names.
- Summary report `phase-complete/phase5-cross-service.md` with test curl outputs.
Output: The summary markdown file only.
```

---

## 🧩 Phase 6 — Legacy Cleanup

### 🔍 Helper Prompt (Phase 6)

```text
Search for legacy config files and deprecated references:
- consumer-service-base remnants
- old lint/spell config paths
- example/template configs referencing removed dirs
Provide categorized lists: Unused Configs, Deprecated Docs, Obsolete Scripts, Candidate .gitignore Entries.
```

### 🚀 Implementation Prompt (Phase 6)

```text
You are executing Phase 6 — Legacy Cleanup.
Reference 06-legacy-cleanup.md.

Goal: Remove obsolete configuration files and update documentation stubs while preserving operational configs.

Tasks:
1. Confirm unused legacy configs not referenced (grep verification).
2. Remove legacy consumer configs from event-consumer if superseded.
3. Update any README references pointing to removed paths.
4. Purge deprecated scripts or mark with DEPRECATED.md if uncertain.
5. Validate remaining consumer configs JSON syntax.
6. Ensure no active code imports removed artifacts.

Dependencies: Phases 1–5 complete.

Exit Criteria:
- Legacy configs removed or archived.
- No code references to removed files.
- Documentation updated to new config locations.
- Summary report `phase-complete/phase6-legacy-cleanup.md` listing removals and validation commands.
Output: The summary markdown file only.
```

---

## 🧩 Phase 7 — Integration Testing

### 🔍 Helper Prompt (Phase 7)

```text
Enumerate test coverage needs:
- Docker startup & health
- Inter-service HTTP calls
- Redis event flow (publisher → consumer)
- Environment variable correctness
Assess existing test scripts; list gaps.
Output a matrix: Category | Existing Coverage | Gap | Priority.
```

### 🚀 Implementation Prompt (Phase 7)

```text
You are executing Phase 7 — Integration Testing.
Reference 07-integration-testing.md.

Goal: Validate full system coherence after refactor (structural parity + runtime integrity).

Tasks:
1. Implement or update an integration test script (integration-test.sh) if missing or incomplete.
2. Run clean start: docker compose down -v && build && up.
3. Execute scripted health + inter-service curl checks.
4. Verify Redis streams/event publisher if applicable (identity.user.v1 length or logs).
5. Capture performance baseline (light curl/ab). Optional if tooling absent — note limitation.
6. Summarize pass/fail and remediation recommendations.

Dependencies: Phases 1–6 complete.

Exit Criteria:
- All health checks green.
- Inter-service communication validated.
- Integration script present & executable.
- Summary report `phase-complete/phase7-integration-testing.md` with results log excerpts.
Output: The summary markdown file only.
```

---

## 🧩 Phase 8 — Documentation Update

### 🔍 Helper Prompt (Phase 8)

```text
Scan README.md, docs/deployment/, docs/development/, service READMEs for outdated paths or service names.
Produce a doc remediation list:
- File | Outdated Reference Snippet | Proposed Replacement.
Include count of remaining legacy name occurrences (grep summary).
```

### 🚀 Implementation Prompt (Phase 8)

```text
You are executing Phase 8 — Documentation Update.
Reference 08-documentation-update.md.

Goal: Update all documentation to reflect the finalized services/ structure, naming, and operational patterns.

Tasks:
1. Revise root README project structure section.
2. Update service READMEs (backend, export, linting, spell-check, event-consumer, event-publisher).
3. Refresh deployment + production docs (systemd units, image names).
4. Update development guide: commands, paths, service list.
5. Add architecture summary (services relationships) if not present.
6. Run grep to ensure no old service names remain.
7. Provide migration completion summary.

Dependencies: Phases 1–7 complete.

Exit Criteria:
- All docs reflect new structure accurately.
- No legacy names/path references remain (grep validated).
- Architecture and service interaction documented.
- Summary report `phase-complete/phase8-documentation-update.md` with grep proof section.
Output: The summary markdown file only.
```

---

## ✅ Usage Notes

- Always include the GLOBAL CONTEXT block at the top of each agent execution (prepend helper prompt output if used).
- Produce ONLY the deliverables for the active phase (e.g., summary markdown). Do not modify future-phase assets.
- Maintain backward compatibility; do not remove runtime functionality while refactoring structure.
- For each phase’s completion, create or update `docs/services-refactor/phase-complete/` with the designated summary file.
- If a required file is missing or environment action (systemd, Redis) cannot be fully executed, mock results and clearly annotate limitations.

---

## 🔄 Dependency Chain Summary

| Phase | Depends On | Primary Output |
|-------|------------|----------------|
| 1 | None | phase1-directory-structure.md |
| 2 | 1 | phase2-docker-update.md |
| 3 | 1–2 | phase3-deployment-infra.md |
| 4 | 1–3 | phase4-system-services.md |
| 5 | 1–4 | phase5-cross-service.md |
| 6 | 1–5 | phase6-legacy-cleanup.md |
| 7 | 1–6 | phase7-integration-testing.md |
| 8 | 1–7 | phase8-documentation-update.md |

---

## 🏁 Final Guidance

Agents must act surgically: rename/move, then propagate references, then validate runtime equivalence, then clean up, then document. Preserve history, avoid logic drift, and ensure every summary report captures before/after key snippets and validation evidence.

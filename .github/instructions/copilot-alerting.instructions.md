---
description: Use when working on app-specific Grafana alert definitions, push-alerts script, or adding/modifying alert rules for the Markdown Manager application.
applyTo: deployment/alerts/**,scripts/push-alerts.sh
---

# Alerting — Markdown Manager App Alerts

## Architecture

- MM owns its own alert rules, defined as JSON in `deployment/alerts/`
- Rules are pushed to Grafana via `scripts/push-alerts.sh` during each blue/green deploy
- Auth: service account token sourced from `/opt/platform-manager/deployment/production.env`
- Non-fatal: failed push does not block deployment

## File Structure

```
deployment/alerts/
├── mm-error-rates.json    # 5xx error rate threshold
├── mm-services.json       # Spell-check service down
├── mm-linting.json        # Linting service down
├── mm-cross-app.json      # Cross-app auth failures
└── mm-performance.json    # Slow API response detection
```

## JSON Rule Format

Each file defines one Grafana alert rule:

```json
{
  "uid": "mm-<descriptive-name>",
  "title": "MM <Human Title>",
  "ruleGroup": "MM - <Category>",
  "folderUID": "mm-alerts",
  "condition": "C",
  "for": "<duration>",
  "data": [...],
  "labels": { "severity": "warning|critical", "app": "mm", "service": "<service>" },
  "annotations": { "summary": "<description>" }
}
```

## Conventions

- **UID prefix**: always `mm-` (globally unique across all apps)
- **Folder UID**: always `mm-alerts` (auto-created by push script)
- **Severity**: `critical` = immediate email, `warning` = grouped (5 min)
- **App label**: always `mm` (matches Promtail's derived `app` label)
- **Service label**: matches the Compose service name seen in logs
- **Datasource UID**: always `loki`

## LogQL Patterns

Common patterns for MM alerts:

```
# 5xx errors from backend
{app="mm", service=~".*backend"} | json | status_code >= 500

# Slow responses
{app="mm", service=~".*backend"} | json | process_time_ms > 5000

# Spell-check service absence
count_over_time({app="mm", service="spell-check"} [5m])

# Linting service absence
count_over_time({app="mm", service="linting"} [5m])

# Cross-app auth failures
{app="mm", service=~".*backend"} |~ "(?i)(cross.app.*unauthorized|X-Cross-App-Token.*failed)"
```

## Adding a New Alert

1. Create `deployment/alerts/mm-<name>.json` following the format above
2. Choose a unique `uid` with `mm-` prefix
3. Test: `./scripts/push-alerts.sh --dry-run`
4. Deploy normally — push happens automatically after health check
5. Verify: `grafana.littledan.com/alerting/list`

## push-alerts.sh Behavior

- Sources token from `/opt/platform-manager/deployment/production.env`
- Connects to Grafana at `http://grafana:3000` (shared-services network)
- Creates the `mm-alerts` folder if it doesn't exist
- For each JSON: checks if UID exists → PUT (update) or POST (create)
- Exits 0 even if Grafana unreachable (graceful degradation)
- Exits 1 only if some rules fail to push while others succeed

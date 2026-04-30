---
description: "Use when working on the export gateway: PDF/DOCX export API client, export service integration, or nginx export routing to the platform export service."
applyTo: "services/backend/app/services/pdf_*,services/backend/app/services/export_service_client*,services/backend/app/routers/pdf*,nginx/**"
---
# Export Service Integration

## Overview
The export service (PDF, DOCX, diagrams) is a **shared platform service** hosted in `platform-manager/export/`. Markdown Manager accesses it over the `shared-services` Docker network.

**The source code does NOT live in this repo.** See `platform-manager/export/` for the service implementation.

## How MM Connects

### Nginx Proxy
Both dev (`nginx-dev.conf`) and prod (`nginx-prod.conf`) proxy `/api/export/` to the export container:
```nginx
location /api/export/ {
    proxy_pass http://export:8001/;
}
```

### Backend Client
`services/backend/app/services/export_service_client.py` wraps HTTP calls to the export service (env var `EXPORT_SERVICE_URL=http://export:8001`).

### Frontend
`services/ui/src/api/exportServiceApi.js` calls the backend's `/api/export/` proxy endpoints for PDF and DOCX export.

## Available Endpoints (provided by platform-manager)
| Endpoint | Method | Description |
|---|---|---|
| `/document/pdf` | POST | HTML → PDF (Playwright + Chromium) |
| `/document/docx` | POST | HTML → DOCX (pypandoc + pandoc) |
| `/diagram/svg` | POST | Rendered diagram → SVG |
| `/diagram/png` | POST | Rendered diagram → PNG |
| `/diagram/drawio/xml` | POST | Mermaid → Draw.io XML |
| `/diagram/drawio/png` | POST | Mermaid → Draw.io editable PNG |

## Important
- Do NOT add export service source code to this repo
- The container name `export` resolves via Docker DNS on `shared-services`
- If the export service needs changes, modify `platform-manager/export/`

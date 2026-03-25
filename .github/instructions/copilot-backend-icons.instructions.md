---
description: "Use when working on icon management backend: icon packs, icon search, icon metadata, icon upload, batch operations, statistics, Iconify integration, SVGL integration, or third-party icon sources."
applyTo: "services/backend/app/routers/icons/**,services/backend/app/services/icons/**,services/backend/app/services/icon_service*,services/backend/app/services/standardized_icon_installer*,services/backend/app/services/document_icon_updater*,services/backend/app/models/icon_models*,services/backend/app/schemas/icon_schemas*,services/backend/app/routers/iconify*,services/backend/app/routers/third_party*"
---
# Backend Icons

## Router Architecture (`routers/icons/`)
REST-oriented with specialized subrouters composed in `router.py`:

```
/icons/search     → Icon search across packs
/icons/packs      → Pack management (authenticated)
/icons/packs-public → Public pack listing (no auth)
/icons/batch      → Batch icon retrieval
/icons/metadata   → Icon metadata queries
/icons/overview   → Pack overview/summary
/icons/statistics → Usage statistics
/icons/cache      → Cache invalidation
/icons/{icon_id}  → Legacy single-icon endpoint (MUST BE LAST)
```

Additional routers at app level:
- `iconify_router.py` → Proxy endpoints for Iconify API
- `third_party_router.py` → Third-party icon source endpoints

## Service Layer (`services/icons/`)
Unified facade `IconService` delegates to specialized services:

### Core Services
- `metadata.py` → Icon metadata management
- `search.py` → Cross-pack search with filtering
- `pack_management.py` → Pack installation, updates, removal
- `svg.py` → SVG processing and optimization
- `statistics.py` → Usage tracking and analysis
- `creation.py` → Custom icon creation
- `cache.py` → Icon data caching
- `realtime_analysis.py` → Document icon reference analysis
- `installer.py` → Pack installation orchestration
- `base.py` → Base service class with db + cache dependencies

### Third-Party Integration (`services/icons/third_party/`)
Isolated subpackage for external icon sources:
- `base.py` → Abstract third-party provider interface
- `browser_service.py` → Browser-based icon browsing

**Iconify** (`third_party/iconify/`):
- `api.py` → Iconify API client
- `collections.py` → Collection listing and metadata
- `cache.py` → Iconify-specific caching

**SVGL** (`third_party/svgl/`):
- `api.py` → SVGL API client
- `categories.py` → Category management
- `svg_processor.py` → SVG processing and normalization
- `cache.py` → SVGL-specific caching

## Related Services (app root)
- `icon_service.py` → Legacy/simplified icon access layer
- `standardized_icon_installer.py` → Standardized pack installation process
- `document_icon_updater.py` → Updates icon references when packs change

## Data Layer
- **Models**: `icon_models.py` (IconPack, Icon — pack metadata, individual icon records)
- **Schemas**: `icon_schemas.py` (request/response schemas for icon operations)

## Key Patterns
- Public-read design: pack listing and icon content don't require auth
- Legacy `/{icon_id}` endpoint placed last to prevent route shadowing
- Service decomposition mirrors API facets (search, metadata, packs, SVG, stats)
- Third-party providers share a common base interface for consistent integration

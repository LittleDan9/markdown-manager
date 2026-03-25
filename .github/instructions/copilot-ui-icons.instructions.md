---
description: "Use when working on the icon browser, icon management modal, icon packs, icon search, icon statistics, icon upload, Iconify integration, or icon usage insights."
applyTo: "services/ui/src/components/icons/**,services/ui/src/hooks/icons/**,services/ui/src/services/icons/**,services/ui/src/api/iconsApi*,services/ui/src/api/admin/iconsApi*"
---
# Icons UI

## Architecture
Icon system split between browsing/search and admin/maintenance, with a coordinator service pattern.

### Component Hierarchy
```
IconBrowser (inline browser for Mermaid icon insertion)
ThirdPartyIconBrowser (Iconify/external source browsing)
IconManagementModal (admin)
├── InstalledIconsTab (view/manage installed packs)
├── IconPacksTab (browse available packs)
├── IconifyPackTab (Iconify collection browser)
├── UploadIconTab (custom icon upload)
├── IconStatsTab (usage statistics)
└── IconViewModal (single icon detail view)
PackCategorySelector (shared pack/category filter)
DocumentUsageInsights (icon usage analysis per document)
```

## Hooks (`hooks/icons/`)
- `useIconCache` → Client-side icon data caching
- `useIconStatistics` → Aggregated icon usage stats
- `useDocumentUsageInsights` → Per-document icon reference analysis

## Service Stack (`services/icons/`)
Central facade is `IconService`, delegating to specialized services:
- `IconPackService` → Pack listing, installation, metadata
- `IconSearchService` → Search across installed packs
- `IconCacheService` → Client-side cache management
- `IconUsageService` → Usage tracking and analysis
- `IconManagementService` → Admin operations (install, uninstall, update)

## API Client (`iconsApi`)
Extends base `Api` class. Icon pack retrieval uses `noAuth: true` (public-read design for icon metadata/content). Methods include pack listing, icon search, batch retrieval, and metadata queries.

Admin icon operations use separate `admin/iconsApi` client with authenticated endpoints.

## Patterns
- Icons are loaded on-demand for Mermaid diagrams via `MermaidIconLoader`
- Icon packs support multiple sources: local (awssvg, awsgrp), third-party (Iconify, SVGL, logos, devicon)
- Icon browser generates proper Mermaid syntax for insertion into editor
- Statistics track which icons are used across documents for cleanup/optimization

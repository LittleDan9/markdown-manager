---
description: "Use when working on the export service: PDF generation, diagram export (SVG/PNG), Mermaid-to-Draw.io conversion, Playwright/Chromium rendering, or diagram converter framework."
applyTo: "services/export/**"
---
# Export Service

## Overview
Python FastAPI microservice for document and diagram export. Uses Playwright/Chromium for high-quality rendering.

**Tech Stack**: Python 3.11, FastAPI, Playwright, Pillow, CairoSVG, BeautifulSoup4, lxml, aiohttp.

## Architecture

### App Factory (`app/app_factory.py`)
Follows the same factory pattern as the backend:
- `create_app()` with lifespan management
- Startup initializes shared CSS service
- Router imports delayed inside setup to avoid circular imports
- root_path not set (nginx handles `/api/export/` prefix)

### Routers
```
/              → Health check (default.py)
/document/pdf  → PDF export from HTML/markdown (pdf.py)
/diagram/svg   → Mermaid diagram → SVG export (diagram.py)
/diagram/png   → Mermaid diagram → PNG export (diagram.py)
/diagram/drawio → Mermaid → Draw.io XML conversion (drawio.py)
```

### Services
- `css_service.py` → Shared CSS for consistent document/diagram styling
- `pdf_service.py` → PDF rendering pipeline with Chromium
- `diagram_service.py` → SVG/PNG diagram export via Playwright
- `mermaid_drawio_service.py` → Mermaid-to-Draw.io orchestrator

### Diagram Converter Framework (`services/diagram_converters/`)
Modular conversion pipeline:
```
diagram_converters/
├── detector.py          → Diagram type detection (architecture/flowchart/etc.)
├── converter_factory.py → Factory selecting converter by diagram type
├── base_converter.py    → Abstract converter interface
├── architecture_converter.py → Architecture-beta diagram conversion
├── flowchart_converter.py    → Flowchart diagram conversion
├── default_converter.py      → Fallback converter
├── parsing/             → Mermaid syntax parsing modules
├── positioning/         → Element layout and positioning
└── validation/          → Input/output validation and quality scoring
```

## Draw.io Integration
- Converts Mermaid diagrams to Draw.io XML format
- Generates editable Draw.io PNG with embedded XML metadata (via PIL)
- Quality scoring validates conversion accuracy
- Performance monitoring for conversion pipeline

## Testing
- `tests/integration/` → Full pipeline tests
- `tests/performance/` → Conversion speed benchmarks
- `tests/fixtures/` → Sample diagrams and expected outputs

## Nginx Routing
Accessed via `/api/export/` prefix through nginx. Both dev and prod configs have `/api/export/` location blocks with precedence before general `/api/` catch-all.

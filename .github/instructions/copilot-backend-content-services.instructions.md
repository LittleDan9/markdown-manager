---
description: "Use when working on backend PDF export gateway, syntax highlighting API, custom dictionary backend, markdown lint rules backend, or backend content processing services."
applyTo: "services/backend/app/routers/pdf*,services/backend/app/routers/syntax_highlighting*,services/backend/app/routers/custom_dictionary*,services/backend/app/routers/markdown_lint*,services/backend/app/services/pdf_*,services/backend/app/services/export_service_client*,services/backend/app/services/syntax_highlighting*,services/backend/app/services/markdown_lint_rule*,services/backend/app/models/custom_dictionary*,services/backend/app/models/markdown_lint_rule*,services/backend/app/crud/custom_dictionary*,services/backend/app/schemas/custom_dictionary*"
---
# Backend Content Services

## PDF/DOCX Export Gateway (`routers/pdf.py`)
Backend proxy to the **platform export service** (lives in `platform-manager/export/`):
- `POST /pdf/export` → Preprocesses HTML content, calls export service for PDF generation
- `POST /pdf/export-docx` → Preprocesses HTML content, calls export service for DOCX generation
- Uses `ExportServiceClient` for HTTP communication with export microservice
- `PdfProcessor` handles HTML enhancement (page breaks, table layout, diagram sizing)
- `PdfImageProcessor` handles image resolution and embedding

### Related Services
- `services/export_service_client.py` → Async HTTP client calling export service (`generate_pdf`, `generate_docx`, `health_check`)
- `services/pdf_processor.py` → HTML preprocessing for PDF layout quality (headers, tables, lists, diagrams)
- `services/pdf_image_processor.py` → Image processing for PDF embedding

## Syntax Highlighting (`routers/syntax_highlighting.py`)
Pygments-based syntax highlighting API:
```
POST /highlight/syntax              → Highlight code block (language + code → HTML)
GET  /highlight/languages           → List all supported languages
GET  /highlight/languages/{lang}    → Language metadata
GET  /highlight/languages/{lang}/check → Check language support
```
- Backend service: `services/syntax_highlighting.py` (Pygments wrapper with language metadata)

## Custom Dictionary Backend (`routers/custom_dictionary.py`)
User/category/folder scoped dictionary management:
```
GET    /dictionary/words           → Words for scope (folder_path or category_id query params)
GET    /dictionary/words/all       → All user words across scopes
GET    /dictionary/category/{id}/words → Category-specific words
GET    /dictionary/folder/words    → Folder-specific words
GET    /dictionary/               → Paginated entries with metadata
POST   /dictionary/               → Add word (folder_path preferred, category_id fallback)
PUT    /dictionary/{word_id}      → Update word
DELETE /dictionary/{word_id}      → Delete by ID
DELETE /dictionary/word/{word}    → Delete by text (with optional scope)
POST   /dictionary/bulk           → Bulk add words
```
- **Model**: `models/custom_dictionary.py` (scope: user/category/folder, with folder_path field)
- **CRUD**: `crud/custom_dictionary.py`
- **Schema**: `schemas/custom_dictionary.py`

## Markdown Lint Rules Backend (`routers/markdown_lint.py`)
Hierarchical lint rule configuration with user/category/folder scopes:
```
GET/PUT/DELETE /lint/rules/defaults          → User default rules
GET/PUT/DELETE /lint/rules/category/{id}     → Category-scoped rules
GET/PUT/DELETE /lint/rules/folder            → Folder-scoped rules (folder_path query param)
```
- **Service**: `services/markdown_lint_rule.py` → Persistence layer with `get_hierarchical_rules()` for scope merging
- **Model**: `models/markdown_lint_rule.py` (rule config, scope type, enabled flag)

## Key Patterns
- Dictionary and lint rules both use three-tier scope hierarchy: user → category → folder
- PDF export uses gateway pattern: backend preprocesses content, export microservice renders
- Syntax highlighting is server-side via Pygments (separate from frontend Prism.js highlighting)

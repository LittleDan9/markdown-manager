# PDF Export Architecture Documentation

## Overview
The Markdown Manager PDF export system has been refactored to use a clean, maintainable architecture that separates concerns and leverages external resources for maximum flexibility and maintainability.

## Architecture

### 1. CSS Service (`app/services/css_service.py`)
- **Purpose**: Centralized CSS management for PDF generation
- **Features**:
  - Loads local CSS files from `app/static/css/`
  - Downloads Prism.js CSS themes from CDN at runtime
  - Caches all CSS content in memory for performance
  - Supports version updates for Prism.js
  - Provides fallback CSS if CDN fails

### 2. Static CSS Files
Located in `app/static/css/`:
- **`pdf-base.css`**: Base styles for all PDFs (layout, typography, code blocks)
- **`pdf-light.css`**: Light theme colors and styling
- **`pdf-dark.css`**: Dark theme colors and styling

### 3. PDF Export Endpoint (`app/api/v1/endpoints/pdf.py`)
- **Clean implementation**: No hardcoded CSS
- **Simple logic**: Combines CSS via service, generates PDF with WeasyPrint
- **Streaming response**: Efficient memory usage for large PDFs

## Benefits

### 1. Maintainability
- **External CSS files**: Easy to edit and version control
- **No hardcoded styles**: All styling is externalized
- **Separation of concerns**: CSS logic is isolated in the service

### 2. Flexibility
- **CDN-based Prism.js**: Automatic access to all supported languages
- **Version management**: Can update Prism.js version easily
- **Theme support**: Easy to add new themes by adding CSS files

### 3. Performance
- **CSS caching**: All CSS is loaded once at startup and cached
- **Async loading**: CDN downloads don't block startup
- **Fallback support**: System works even if CDN is unavailable

### 4. Robustness
- **Error handling**: Graceful fallback for CDN failures
- **Logging**: Proper logging for debugging and monitoring
- **Type safety**: Full type annotations

## Usage

### Basic PDF Export
```python
POST /api/v1/pdf/export
{
    "html_content": "<h1>Hello World</h1>",
    "document_name": "test-document",
    "is_dark_mode": false
}
```

### Debug Endpoints
```python
GET /api/v1/debug/css-status      # Check CSS service status
POST /api/v1/debug/refresh-prism  # Refresh Prism.js CSS from CDN
```

### Update Prism.js Version
The CSS service can be updated to use a different Prism.js version:
```python
await css_service.refresh_prism_css("1.30.0")
```

## CSS Structure

### Base CSS (`pdf-base.css`)
- Page layout and margins
- Typography (fonts, sizes, line heights)
- Code block structure and layout
- Tables, lists, blockquotes
- Print-specific optimizations

### Theme CSS (`pdf-light.css`, `pdf-dark.css`)
- Background and text colors
- Code block theming
- Syntax highlighting overrides (minimal, as Prism.js provides most)
- Border and accent colors

### Prism.js CSS (CDN)
- **Light theme**: `prism.min.css`
- **Dark theme**: `prism-tomorrow.min.css`
- **Full language support**: All languages supported by Prism.js
- **Automatic updates**: Can be refreshed without code changes

## Development Workflow

### 1. Styling Changes
1. Edit appropriate CSS file in `app/static/css/`
2. Restart server to reload CSS (or add hot-reload later)
3. Test PDF export

### 2. Adding New Themes
1. Create new CSS file (e.g., `pdf-high-contrast.css`)
2. Update CSS service to load the new file
3. Update PDF endpoint to support new theme parameter

### 3. Prism.js Updates
1. Use debug endpoint to refresh: `POST /api/v1/debug/refresh-prism`
2. Or restart server to get latest version

## Configuration

### Environment Variables (Future)
- `PRISM_VERSION`: Override default Prism.js version
- `CSS_CDN_TIMEOUT`: Timeout for CDN requests
- `CSS_CACHE_TTL`: How long to cache CDN CSS

### Settings
Current settings are in the CSS service constructor:
```python
self.prism_version = "1.29.0"  # Prism.js version
```

## Monitoring

### CSS Service Health
The debug endpoint provides insights:
- Prism.js version in use
- Which CSS files are cached
- File sizes (for debugging)

### Logging
The service logs:
- CSS file loading (local files)
- CDN download success/failure
- Version updates

## Future Enhancements

1. **Hot-reload**: CSS file watching for development
2. **Multi-theme support**: Support for custom user themes
3. **CSS minification**: Compress CSS for smaller PDFs
4. **CDN fallback**: Multiple CDN sources for reliability
5. **CSS validation**: Ensure CSS is valid before caching

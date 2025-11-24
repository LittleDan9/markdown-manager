# Export Service

The Export Service is a specialized microservice within the Markdown Manager ecosystem that handles the conversion and export of documents and diagrams to various formats. Built with FastAPI and Playwright, it provides high-quality rendering and conversion capabilities for both document generation and diagram transformation.

## Service Overview

This service operates as a standalone container that receives content from the main application and processes it through headless browser rendering or specialized conversion algorithms. It's designed to handle computationally intensive export operations without impacting the main application's performance.

**Key Capabilities:**
- PDF document generation with advanced styling
- SVG diagram extraction and optimization
- PNG diagram conversion with transparent backgrounds
- Draw.io XML format conversion with quality assessment
- Draw.io PNG format with embedded XML metadata for dual-purpose files
- Headless browser rendering for pixel-perfect output

## Architecture

The service follows a modular architecture with dedicated services for different conversion types:

- **CSS Service**: Manages styling for PDF and diagram rendering
- **Draw.io Service**: Handles Mermaid to Draw.io XML conversion with comprehensive quality scoring
- **Playwright Integration**: Provides headless Chromium rendering for high-fidelity output

## API Endpoints

### Health & Service Information

#### `GET /health`
Basic health check endpoint that confirms the service is operational.

**Response**: Service status and version information

#### `GET /`
Service information endpoint providing an overview of available endpoints and service capabilities.

**Response**: Complete endpoint listing and service metadata

---

### Document Export

#### `POST /document/pdf`
Converts HTML content to PDF format using headless browser rendering. This endpoint handles complex document layouts, embedded diagrams, and custom styling with proper page break control.

**Input**: HTML content, document name, and styling preferences (light/dark mode)
**Query Parameter**: `response_format` - "stream" (default) or "json"

**Output**:
- **Stream format**: Direct PDF file download (legacy behavior)
- **JSON format**: `ConversionResponse` with base64-encoded PDF and metadata

**Use Cases:**
- Export markdown documents as PDFs
- Generate reports with embedded diagrams
- Create printable versions of web content

---

### Diagram Export

#### `POST /diagram/svg`
Extracts and optimizes SVG content from rendered HTML diagrams. This endpoint ensures clean SVG output with proper namespacing and attributes for compatibility with various SVG viewers and editors.

**Input**: HTML content containing rendered diagrams

**Output**: `ConversionResponse` with base64-encoded SVG and metadata

**Use Cases:**

- Export Mermaid diagrams as vector graphics
- Generate scalable diagram files
- Prepare diagrams for further editing

#### `POST /diagram/png`
Converts SVG diagrams to PNG format with optional transparent backgrounds. This endpoint provides pixel-perfect rasterization with configurable dimensions and background handling.

**Input**: SVG content with optional dimension and transparency settings

**Output**: `ConversionResponse` with base64-encoded PNG and metadata

**Use Cases:**

- Create raster versions of diagrams for presentations
- Generate thumbnails or previews
- Export diagrams for platforms that don't support SVG

---

### Draw.io Integration

#### `POST /diagram/drawio/xml`
Converts Mermaid diagrams to Draw.io XML format with comprehensive quality assessment. This endpoint requires both Mermaid source code and rendered SVG content for optimal conversion quality.

**Input**: Mermaid source code and rendered SVG content with optional configuration
**Output**: Draw.io-compatible XML with detailed quality assessment metrics

#### `POST /diagram/drawio/png`
Converts Mermaid diagrams to PNG format with embedded Draw.io XML metadata. Creates dual-purpose files that function as both images and editable diagrams.

**Input**: Mermaid source code and rendered SVG content with optional dimensions and styling
**Output**: PNG image with embedded XML metadata for Draw.io compatibility

**Key Features:**

- **Enhanced Input Processing**: Utilizes both Mermaid source and rendered SVG for optimal conversion
- **Icon Service Integration**: Fetches and embeds SVG icons from configurable icon service
- **XML Metadata Embedding**: PNG files contain embedded XML data for full Draw.io compatibility
- **Comprehensive Quality Scoring**: Three-dimensional assessment of conversion fidelity (0-100%)
- **Positioning Accuracy**: Extracts precise positioning from rendered SVG content
- **Graceful Error Handling**: Fallbacks ensure conversion completion even with partial failures

**Quality Assessment Breakdown:**
- **Structural Fidelity (40%)**: Node and connection preservation
- **Visual Quality (30%)**: Color, styling, and layout accuracy
- **Icon Success Rate (30%)**: SVG icon embedding success

**Use Cases:**

- **XML Format**: Direct import to Draw.io for immediate editing and collaboration
- **PNG Format**: Visual sharing with hidden edit capability - appears as image but can be imported to Draw.io
- Convert Mermaid diagrams for collaborative editing in Draw.io
- Create dual-purpose files that serve as both visual previews and editable diagrams
- Migrate diagrams between different diagramming tools with high fidelity

#### `GET /diagram/drawio/health`
Health check specifically for the Draw.io conversion service, including functional testing with live conversion validation.

#### `GET /diagram/drawio/formats`
Information endpoint detailing supported Draw.io export formats, capabilities, and environment configuration.

---

## Quality Assessment System

The diagrams.net conversion endpoint includes a sophisticated quality assessment system that evaluates conversion success across multiple dimensions:

**Score Ranges:**
- **90-100%**: Excellent quality - Ready for immediate use
- **75-89%**: Good quality - Minor manual adjustments may be needed
- **60-74%**: Fair quality - Review and refinement recommended
- **Below 60%**: Poor quality - Consider alternative export formats

**Assessment Factors:**
- Element preservation and positioning accuracy
- Color and styling fidelity
- Icon and embedded content success rates
- Overall structural integrity

## Development & Testing

The service includes comprehensive test samples in the `test-samples/` directory:

- **Basic Flowchart**: Simple shapes and connections
- **Architecture Diagrams**: Complex layouts with embedded icons
- **Sequence Diagrams**: Line-based diagrams with text positioning

### Testing Examples

```bash
# Test basic health
curl http://localhost:8001/health

# Test Draw.io XML conversion
curl -X POST http://localhost:8001/diagram/drawio/xml \
  -H "Content-Type: application/json" \
  -d '{"mermaid_source": "graph TD\n  A[Start] --> B[End]", "svg_content": "<svg>...</svg>"}'

# Test Draw.io PNG conversion (with embedded XML)
curl -X POST http://localhost:8001/diagram/drawio/png \
  -H "Content-Type: application/json" \
  -d '{"mermaid_source": "graph TD\n  A[Start] --> B[End]", "svg_content": "<svg>...</svg>", "transparent_background": true}'

# Check Draw.io service health
curl http://localhost:8001/diagram/drawio/health

# Get supported formats
curl http://localhost:8001/diagram/drawio/formats
```

## Environment Variables

### Draw.io Export Configuration

- `ICON_SERVICE_URL` - Base URL for icon service (default: http://localhost:8000)
- `DRAWIO_VERSION` - Draw.io version compatibility (default: 24.7.5)
- `DRAWIO_QUALITY_THRESHOLD` - Minimum quality score threshold (default: 60.0)

**Environment Configuration Example:**

```yaml
# docker-compose.yml
environment:
  - ICON_SERVICE_URL=http://backend:8000
  - DRAWIO_VERSION=24.7.5
  - DRAWIO_QUALITY_THRESHOLD=60.0
```

## Integration Notes

This service is designed to be called by the main Markdown Manager application and operates on port 8001. All endpoints expect proper User-Agent headers and follow RESTful conventions.

**Dependencies:**

- Headless Chromium (via Playwright) - Primary PNG rendering engine
- CairoSVG - Fallback SVG to PNG conversion
- Python 3.11+ runtime
- Specialized parsing libraries (lxml, BeautifulSoup4, Pillow)

**Performance Considerations:**

- SVG parsing and XML generation are CPU-intensive
- Headless browser operations require significant memory
- PNG generation with Playwright adds rendering overhead
- Consider request queuing for high-volume scenarios

**Technical Details:**

The enhanced conversion process utilizes both Mermaid source code and rendered SVG content for optimal results. The PNG format with embedded XML uses PNG metadata chunks to store the Draw.io XML data. This allows the file to function as both a visual image and an editable diagram. The conversion process:

1. Parses Mermaid source to extract semantic information (nodes, edges, icons)
2. Extracts positioning data from rendered SVG content
3. Fetches and cleans SVG icons from configurable icon service
4. Generates Draw.io XML with proper mxGraphModel structure
5. Renders final PNG using Playwright with embedded XML metadata
6. Returns base64-encoded content with comprehensive quality assessment

## Migration Guide

### Breaking Changes from diagramsnet to Draw.io

**API Endpoint Changes:**

| Old Endpoint | New Endpoint | Status |
|-------------|-------------|---------|
| `POST /diagram/diagramsnet` | `POST /diagram/drawio/xml` | **BREAKING** |
| N/A | `POST /diagram/drawio/png` | **NEW** |
| `GET /diagram/health` | `GET /diagram/drawio/health` | **BREAKING** |
| `GET /diagram/formats` | `GET /diagram/drawio/formats` | **BREAKING** |

**Request Model Changes:**

The new Draw.io endpoints require both `mermaid_source` and `svg_content` fields:

```json
// Old diagramsnet request
{
  "svg_content": "<svg>...</svg>",
  "format": "xml"
}

// New drawio/xml request
{
  "mermaid_source": "graph TD\n  A[Start] --> B[End]",
  "svg_content": "<svg>...</svg>",
  "width": 1000,
  "height": 600,
  "is_dark_mode": false
}

// New drawio/png request
{
  "mermaid_source": "graph TD\n  A[Start] --> B[End]",
  "svg_content": "<svg>...</svg>",
  "transparent_background": true,
  "is_dark_mode": false
}
```

**Response Model Changes:**

- Enhanced quality assessment with three-dimensional scoring
- Detailed conversion metadata including icon success rates
- Improved error reporting with specific failure points

## Future Enhancements

**Planned Features:**

- Additional diagram format support (Visio, Lucidchart)
- Batch conversion capabilities for multiple diagrams
- Caching layer for improved performance
- Enhanced quality assessment with visual similarity analysis
- Support for custom Draw.io templates and themes

The service architecture is designed for easy extension, with modular conversion services and a common response format that can accommodate new export types.

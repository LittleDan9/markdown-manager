# Export Service

The Export Service is a specialized microservice within the Markdown Manager ecosystem that handles the conversion and export of documents and diagrams to various formats. Built with FastAPI and Playwright, it provides high-quality rendering and conversion capabilities for both document generation and diagram transformation.

## Service Overview

This service operates as a standalone container that receives content from the main application and processes it through headless browser rendering or specialized conversion algorithms. It's designed to handle computationally intensive export operations without impacting the main application's performance.

**Key Capabilities:**
- PDF document generation with advanced styling
- SVG diagram extraction and optimization
- PNG diagram conversion with transparent backgrounds
- diagrams.net XML format conversion with quality assessment
- **NEW**: diagrams.net PNG format with embedded XML metadata for dual-purpose files
- Headless browser rendering for pixel-perfect output

## Architecture

The service follows a modular architecture with dedicated services for different conversion types:

- **CSS Service**: Manages styling for PDF and diagram rendering
- **diagrams.net Service**: Handles SVG to diagrams.net XML conversion with quality scoring
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

### diagrams.net Integration

#### `POST /diagram/diagramsnet`
**NEW** - Converts Mermaid SVG diagrams to diagrams.net format, supporting both XML and PNG formats with embedded XML metadata. This endpoint features advanced SVG parsing, element extraction, and quality assessment.

**Input**: Raw SVG content from Mermaid diagrams
**Output**: diagrams.net-compatible XML or PNG with embedded XML and quality assessment metrics

**Supported Formats:**
- **XML Format** (`format: "xml"`): Traditional diagrams.net XML file for direct import
- **PNG Format** (`format: "png"`): Visual PNG image with embedded XML metadata for dual-purpose use

**Key Features:**

- **Dual Format Support**: Export to XML for editing or PNG for visual sharing with hidden edit capability
- **XML Metadata Embedding**: PNG files contain embedded XML data for full diagrams.net compatibility
- **SVG Icon Preservation**: Embedded SVG icons are retained as base64 data
- **Quality Scoring**: Comprehensive assessment of conversion fidelity (0-100%)
- **Structural Analysis**: Evaluates node/edge preservation and layout accuracy
- **Styling Conversion**: Maps SVG styling to diagrams.net equivalents

**Quality Assessment Breakdown:**
- **Structural Fidelity (40%)**: Node and connection preservation
- **Visual Quality (30%)**: Color, styling, and layout accuracy
- **Icon Success Rate (30%)**: SVG icon embedding success

**Use Cases:**

- **XML Format**: Direct import to diagrams.net for immediate editing and collaboration
- **PNG Format**: Visual sharing with hidden edit capability - appears as image but can be imported to diagrams.net
- Convert Mermaid diagrams for collaborative editing in diagrams.net
- Create dual-purpose files that serve as both visual previews and editable diagrams
- Migrate diagrams between different diagramming tools

#### `GET /diagram/health`
Health check specifically for the diagrams.net conversion service, including functional testing.

#### `GET /diagram/formats`
Information endpoint detailing current and planned diagrams.net export formats, including feature matrices and compatibility information.

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

# Test diagrams.net XML conversion
curl -X POST http://localhost:8001/diagram/diagramsnet \
  -H "Content-Type: application/json" \
  -d '{"svg_content": "<svg>...</svg>", "format": "xml"}'

# Test diagrams.net PNG conversion (with embedded XML)
curl -X POST http://localhost:8001/diagram/diagramsnet \
  -H "Content-Type: application/json" \
  -d '{"svg_content": "<svg>...</svg>", "format": "png"}'

# Get supported formats
curl http://localhost:8001/diagram/formats
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

The PNG format with embedded XML uses PNG metadata chunks to store the diagrams.net XML data. This allows the file to function as both a visual image and an editable diagram. The embedding process:

1. Converts SVG to diagrams.net XML format
2. Renders SVG to PNG using Playwright (primary) or CairoSVG (fallback)
3. Embeds XML in PNG metadata using the "mxGraphModel" text chunk
4. Returns base64-encoded PNG with embedded editing capability

## Future Enhancements

**Planned Features:**

- Additional diagram format support (Visio, Lucidchart)
- Batch conversion capabilities for multiple diagrams
- Caching layer for improved performance
- Enhanced quality assessment with visual similarity analysis
- Support for custom diagrams.net templates and themes

The service architecture is designed for easy extension, with modular conversion services and a common response format that can accommodate new export types.

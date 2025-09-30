# GitHub-Compatible Diagram Export Implementation Instructions

## Overview

This document provides comprehensive instructions for implementing automatic GitHub-compatible diagram export features in Markdown Manager. The system will detect advanced Mermaid diagrams (architecture-beta, custom icons) and automatically convert them to static images when saving to GitHub repositories.

## Core Requirements

### User Story
- Users with GitHub integration enabled can toggle a setting to auto-convert advanced diagrams for GitHub compatibility
- When saving to GitHub, advanced diagrams are automatically converted to SVG/PNG images with fallback source code
- Users can manually export individual diagrams via overlay controls in the renderer
- Each diagram gets expand/download controls for fullscreen viewing and manual expor5. Implement diagram detection and conversion logic
3. Add GitHub-compatible markdown generation
4. Integrate with export service for image generation## Architecture Components

### Frontend Components (React/JavaScript)

#### 1. MermaidExportService (`frontend/src/services/rendering/MermaidExportService.js`)

**Purpose**: Service for exporting Mermaid diagrams to SVG/PNG using the existing export service infrastructure

```javascript
import exportServiceApi from '@/api/exportServiceApi';

export class MermaidExportService {
  /**
   * Export diagram to image format using the export service for high-quality rendering
   * @param {HTMLElement} diagramElement - The rendered Mermaid diagram element
   * @param {string} format - 'svg' or 'png'
   * @returns {Promise<string|Blob>} - SVG string or PNG blob
   */
  static async exportDiagramToImage(diagramElement, format = 'svg') {
    const diagramHTML = this.prepareDiagramHTML(diagramElement);

    if (format === 'svg') {
      return await this.exportToSVG(diagramHTML);
    } else {
      return await this.exportToPNG(diagramHTML);
    }
  }

  /**
   * Prepare diagram HTML for export service rendering
   * @param {HTMLElement} diagramElement - The diagram element
   * @returns {string} - Isolated diagram HTML with rendered SVG
   */
  static prepareDiagramHTML(diagramElement) {
    // Extract the SVG content from the rendered Mermaid diagram
    const svgElement = diagramElement.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG found in diagram element');
    }

    // Clone the SVG to avoid DOM manipulation
    const svgClone = svgElement.cloneNode(true);

    // Wrap in a minimal HTML structure for export service
    return `
      <div class="diagram-export">
        ${svgClone.outerHTML}
      </div>
    `;
  }

  /**
   * Export to SVG using export service's Chromium rendering
   * @param {string} diagramHTML - The diagram HTML
   * @returns {Promise<string>} - SVG string
   */
  static async exportToSVG(diagramHTML) {
    const response = await exportServiceApi.renderDiagramToSVG({
      html_content: diagramHTML,
      format: 'svg'
    });

    return response.svg_content;
  }

  /**
   * Export to PNG using export service's Chromium rendering
   * @param {string} diagramHTML - The diagram HTML
   * @returns {Promise<Blob>} - PNG blob
   */
  static async exportToPNG(diagramHTML) {
    const response = await exportServiceApi.renderDiagramToImage({
      html_content: diagramHTML,
      format: 'png',
      width: 1200,
      height: 800
    });

    // Convert base64 response to blob
    const binaryString = atob(response.image_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/png' });
  }

  /**
   * Download diagram as file
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} filename - Target filename without extension
   * @param {string} format - 'svg' or 'png'
   */
  static async downloadDiagram(diagramElement, filename, format = 'svg') {
    try {
      const exportedData = await this.exportDiagramToImage(diagramElement, format);

      let blob, mimeType;
      if (format === 'svg') {
        blob = new Blob([exportedData], { type: 'image/svg+xml' });
        mimeType = 'image/svg+xml';
      } else {
        blob = exportedData; // Already a blob from PNG export
        mimeType = 'image/png';
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export diagram:', error);
      throw new Error(`Failed to export diagram as ${format.toUpperCase()}`);
    }
  }
}
```

**Key Implementation Details**:
- Leverages existing export service's Chromium rendering engine
- Uses the same CSS and styling as PDF exports for consistency
- High-quality SVG extraction and PNG rasterization
- Proper error handling and cleanup
- Maintains existing export service architecture patterns

#### 2. DiagramControls Component (`frontend/src/components/renderer/DiagramControls.jsx`)

**Purpose**: Overlay controls for each diagram providing expand/download functionality

```jsx
function DiagramControls({ diagramElement, diagramId, diagramSource }) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <>
      <div className="diagram-controls">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setShowFullscreen(true)}
          title="Expand to fullscreen"
        >
          <Expand />
        </Button>

        <DropdownButton
          variant="outline-secondary"
          size="sm"
          title={<Download />}
        >
          <Dropdown.Item onClick={() => handleDownload('svg')}>
            Download as SVG
          </Dropdown.Item>
          <Dropdown.Item onClick={() => handleDownload('png')}>
            Download as PNG
          </Dropdown.Item>
        </DropdownButton>
      </div>

      <DiagramFullscreenModal
        show={showFullscreen}
        onHide={() => setShowFullscreen(false)}
        diagramElement={diagramElement}
        diagramSource={diagramSource}
      />
    </>
  );
}
```

**Styling Requirements** (`frontend/src/styles/components/_diagram-controls.scss`):
```scss
.mermaid-container {
  position: relative;

  &:hover .diagram-controls {
    opacity: 1;
  }
}

.diagram-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;

  .btn {
    margin-left: 4px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }
}
```

#### 3. GitHub Integration Settings (`frontend/src/components/settings/GitHubIntegrationSettings.jsx`)

**Purpose**: User settings for auto-conversion preferences

```jsx
function GitHubIntegrationSettings() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="github-integration-settings">
      <Form.Check
        type="switch"
        id="auto-convert-diagrams"
        label="Auto-convert advanced diagrams for GitHub compatibility"
        checked={settings.github?.autoConvertDiagrams || false}
        onChange={(e) => updateSettings({
          github: {
            ...settings.github,
            autoConvertDiagrams: e.target.checked
          }
        })}
      />

      <Form.Group className="mt-3">
        <Form.Label>Diagram Export Format</Form.Label>
        <Form.Select
          value={settings.github?.diagramFormat || 'svg'}
          onChange={(e) => updateSettings({
            github: {
              ...settings.github,
              diagramFormat: e.target.value
            }
          })}
        >
          <option value="svg">SVG (Vector, smaller files)</option>
          <option value="png">PNG (Raster, better compatibility)</option>
        </Form.Select>
      </Form.Group>
    </div>
  );
}
```

#### 4. Enhanced Renderer Integration

**Modification Required**: Update `frontend/src/components/sections/RendererSection.jsx`

Add diagram controls to each rendered Mermaid diagram:

```jsx
// In Renderer.jsx, after diagram rendering
useEffect(() => {
  if (previewHTML) {
    const previewElement = previewScrollRef.current;
    const mermaidElements = previewElement?.querySelectorAll('.mermaid[data-processed="true"]');

    mermaidElements?.forEach((element, index) => {
      const diagramId = `diagram-${index}`;
      const diagramSource = element.getAttribute('data-mermaid-source');

      // Wrap diagram with container and add controls
      if (!element.closest('.mermaid-container')) {
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        element.parentNode.insertBefore(container, element);
        container.appendChild(element);

        // Add React controls via portal or direct DOM manipulation
        const controlsContainer = document.createElement('div');
        container.appendChild(controlsContainer);

        ReactDOM.render(
          <DiagramControls
            diagramElement={element}
            diagramId={diagramId}
            diagramSource={decodeURIComponent(diagramSource)}
          />,
          controlsContainer
        );
      }
    });
  }
}, [previewHTML]);
```

### Export Service Enhancement

#### 1. Diagram Export Endpoints (`export-service/app/main.py`)

**Enhancement Required**: Add diagram-specific export endpoints to the export service (formerly pdf-service)

```python
from pydantic import BaseModel
from fastapi.responses import Response
import base64

class DiagramExportRequest(BaseModel):
    """Diagram export request model."""
    html_content: str
    format: str = "svg"  # svg or png
    width: int = 1200
    height: int = 800
    is_dark_mode: bool = False

@app.post("/export-diagram-svg")
async def export_diagram_svg(request: DiagramExportRequest) -> dict:
    """Export diagram as SVG using Chromium rendering."""
    try:
        logger.info(f"Exporting diagram as SVG")

        # Get CSS styles optimized for diagrams
        css_styles = css_service.get_diagram_css(request.is_dark_mode)

        # Create minimal HTML for diagram
        diagram_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Diagram Export</title>
        </head>
        <body>
            {request.html_content}
        </body>
        </html>
        """

        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page()

            # Set viewport for consistent rendering
            await page.set_viewport_size({"width": request.width, "height": request.height})

            await page.set_content(f"<style>{css_styles}</style>{diagram_html}", wait_until="networkidle")

            # Find the SVG element and extract it
            svg_content = await page.evaluate("""
                () => {
                    const svg = document.querySelector('svg');
                    if (!svg) return null;

                    // Ensure proper SVG attributes
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                    return svg.outerHTML;
                }
            """)

            await browser.close()

            if not svg_content:
                raise HTTPException(status_code=400, detail="No SVG content found in diagram")

            return {"svg_content": svg_content}

    except Exception as e:
        logger.error(f"Failed to export diagram as SVG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export diagram: {str(e)}")

@app.post("/export-diagram-png")
async def export_diagram_png(request: DiagramExportRequest) -> dict:
    """Export diagram as PNG using Chromium rendering."""
    try:
        logger.info(f"Exporting diagram as PNG ({request.width}x{request.height})")

        css_styles = css_service.get_diagram_css(request.is_dark_mode)

        diagram_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Diagram Export</title>
        </head>
        <body>
            {request.html_content}
        </body>
        </html>
        """

        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page()

            await page.set_viewport_size({"width": request.width, "height": request.height})
            await page.set_content(f"<style>{css_styles}</style>{diagram_html}", wait_until="networkidle")

            # Take screenshot of the diagram area
            png_bytes = await page.screenshot(
                type="png",
                full_page=False,
                clip={
                    "x": 0,
                    "y": 0,
                    "width": request.width,
                    "height": request.height
                }
            )

            await browser.close()

            # Return base64 encoded image
            image_data = base64.b64encode(png_bytes).decode('utf-8')
            return {"image_data": image_data}

    except Exception as e:
        logger.error(f"Failed to export diagram as PNG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export diagram: {str(e)}")
```

#### 2. Enhanced CSS Service (`export-service/app/services/css_service.py`)

**Enhancement Required**: Add diagram-specific CSS method

```python
def get_diagram_css(self, is_dark_mode: bool = False) -> str:
    """Get optimized CSS for diagram export (no page breaks)."""
    css_parts: list[str] = [
        self.css_cache.get("base", ""),
        # Skip pagebreaks CSS for single diagram export
        self.css_cache.get("mermaid", ""),
        self.css_cache.get("dark" if is_dark_mode else "light", ""),
        self.css_cache.get("prism-dark" if is_dark_mode else "prism-light", ""),
        # Add diagram-specific styles
        """
        body { margin: 0; padding: 20px; }
        .diagram-export {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .mermaid {
            max-width: 100%;
            max-height: 100%;
            margin: 0;
        }
        """
    ]
    return "\n\n".join(filter(None, css_parts))
```

### Backend Integration

#### 1. Export Service API Client (`frontend/src/api/exportServiceApi.js`)

**Purpose**: API client for communicating with the enhanced export service (formerly PDF service)

```javascript
import { Api } from './Api';

class ExportServiceApi extends Api {
  constructor() {
    super(process.env.REACT_APP_EXPORT_SERVICE_URL || 'http://localhost:8001');
  }

  async generatePDF(pdfData) {
    const response = await this.apiCall('/generate-pdf', {
      method: 'POST',
      data: pdfData
    });
    return response.data;
  }

  async renderDiagramToSVG(diagramData) {
    const response = await this.apiCall('/export-diagram-svg', {
      method: 'POST',
      data: diagramData
    });
    return response.data;
  }

  async renderDiagramToImage(diagramData) {
    const response = await this.apiCall('/export-diagram-png', {
      method: 'POST',
      data: diagramData
    });
    return response.data;
  }

  async checkHealth() {
    const response = await this.apiCall('/health');
    return response.data;
  }
}

export default new ExportServiceApi();
```

#### 2. Enhanced GitHub Service (`backend/app/services/github/conversion.py`)

**Purpose**: Server-side diagram conversion logic

```python
from typing import Dict, List, Tuple, Optional
import re
import hashlib
from pathlib import Path

class GitHubDiagramConversionService:
    """Service for converting advanced Mermaid diagrams for GitHub compatibility."""

    def __init__(self):
        self.advanced_patterns = [
            r'architecture-beta',
            r'service\s+\w+\([^)]*:[^)]*\)',  # service with icons
            r'group\s+\w+\([^)]*:[^)]*\)',    # group with icons
            r'\b(awssvg|awsgrp|logos|devicon|flat-color-icons):', # icon references
        ]

    def has_advanced_features(self, diagram_source: str) -> bool:
        """Check if diagram uses advanced features incompatible with GitHub."""
        return any(re.search(pattern, diagram_source, re.IGNORECASE)
                  for pattern in self.advanced_patterns)

    def extract_mermaid_blocks(self, content: str) -> List[Dict]:
        """Extract Mermaid code blocks from markdown content."""
        pattern = r'```mermaid\n(.*?)\n```'
        blocks = []

        for match in re.finditer(pattern, content, re.DOTALL):
            diagram_source = match.group(1).strip()
            source_hash = hashlib.md5(diagram_source.encode()).hexdigest()[:8]

            blocks.append({
                'original': match.group(0),
                'code': diagram_source,
                'hash': source_hash,
                'start': match.start(),
                'end': match.end()
            })

        return blocks

    def create_github_compatible_block(self, image_path: str, original_code: str) -> str:
        """Create GitHub-compatible markdown with image and collapsible source."""
        return f"""![Diagram]({image_path})

<details>
<summary>📊 View diagram source (best viewed in Markdown Manager)</summary>

```mermaid
{original_code}
```
</details>"""

    async def convert_content_for_github(
        self,
        content: str,
        format: str = 'svg'
    ) -> Tuple[str, List[Dict]]:
        """
        Convert markdown content for GitHub compatibility.

        Returns:
            Tuple of (converted_content, image_files_to_upload)
        """
        mermaid_blocks = self.extract_mermaid_blocks(content)
        image_files = []
        converted_content = content

        for block in reversed(mermaid_blocks):  # Process in reverse to maintain positions
            if self.has_advanced_features(block['code']):
                # This would integrate with frontend rendering service
                # For now, placeholder for image generation
                filename = f"diagram-{block['hash']}.{format}"
                image_path = f"diagrams/{filename}"

                # Replace in content
                replacement = self.create_github_compatible_block(image_path, block['code'])
                converted_content = (
                    converted_content[:block['start']] +
                    replacement +
                    converted_content[block['end']:]
                )

                image_files.append({
                    'path': image_path,
                    'filename': filename,
                    'diagram_source': block['code'],
                    'format': format
                })

        return converted_content, image_files
```

#### 2. Enhanced GitHub API Service

**Modification Required**: Update `backend/app/services/github/api.py`

```python
async def commit_file_with_diagrams(
    self,
    access_token: str,
    owner: str,
    repo: str,
    file_path: str,
    content: str,
    message: str,
    branch: str,
    sha: Optional[str] = None,
    convert_diagrams: bool = False,
    diagram_format: str = 'svg'
) -> Dict[str, Any]:
    """Commit file with optional diagram conversion."""

    if convert_diagrams:
        from .conversion import GitHubDiagramConversionService
        converter = GitHubDiagramConversionService()

        # Convert content and get image files to upload
        converted_content, image_files = await converter.convert_content_for_github(
            content, diagram_format
        )

        # Upload diagram images first
        for image_file in image_files:
            # Use export service to render diagram to image
            image_data = await self._render_diagram_via_export_service(
                image_file['diagram_source'],
                image_file['format']
            )

            await self.create_or_update_file(
                access_token, owner, repo,
                image_file['path'],
                image_data,
                f"Add diagram: {image_file['filename']}",
                branch=branch
            )

    async def _render_diagram_via_export_service(self, diagram_source: str, format: str) -> str:
        """Render diagram using export service and return as base64."""
        import httpx
        import base64

        # Create minimal HTML for the diagram
        diagram_html = f"""
        <div class="mermaid" data-processed="true">
            {diagram_source}
        </div>
        """

        export_service_url = "http://export-service:8001"  # Docker service name

        async with httpx.AsyncClient() as client:
            if format == 'svg':
                response = await client.post(f"{export_service_url}/export-diagram-svg", json={
                    "html_content": diagram_html,
                    "format": "svg"
                })
                result = response.json()
                return base64.b64encode(result['svg_content'].encode()).decode()
            else:
                response = await client.post(f"{export_service_url}/export-diagram-png", json={
                    "html_content": diagram_html,
                    "format": "png",
                    "width": 1200,
                    "height": 800
                })
                result = response.json()
                return result['image_data']  # Already base64 encoded        # Use converted content for main file
        content = converted_content

    # Proceed with normal file commit
    return await self.create_or_update_file(
        access_token, owner, repo, file_path, content, message, sha, branch
    )
```

#### 3. Settings Schema Updates

**Modification Required**: Update `backend/app/schemas/settings.py`

```python
class GitHubSettings(BaseModel):
    """GitHub integration settings."""
    auto_convert_diagrams: bool = Field(False, description="Auto-convert advanced diagrams for GitHub")
    diagram_format: str = Field('svg', description="Export format for diagrams", regex='^(svg|png)$')
    fallback_to_standard: bool = Field(True, description="Convert architecture-beta to standard flowcharts")
```

### Frontend-Backend Integration

#### 1. Enhanced Document API

**Modification Required**: Update `frontend/src/api/documentsApi.js`

```javascript
export class DocumentsApi extends Api {
  async saveToGitHubWithDiagrams(documentId, options = {}) {
    const {
      commitMessage,
      branch = 'main',
      convertDiagrams = false,
      diagramFormat = 'svg',
      renderedDiagrams = []
    } = options;

    const response = await this.apiCall(`/documents/${documentId}/github/save`, {
      method: 'POST',
      data: {
        commit_message: commitMessage,
        branch,
        convert_diagrams: convertDiagrams,
        diagram_format: diagramFormat,
        rendered_diagrams: renderedDiagrams
      }
    });

    return response.data;
  }
}
```

#### 2. GitHub Save Modal Enhancement

**Modification Required**: Update `frontend/src/components/file/modals/GitHubSaveModal.jsx`

```jsx
function GitHubSaveModal({ show, onHide, document, onSaveSuccess }) {
  const { settings } = useSettings();
  const [commitMessage, setCommitMessage] = useState('');
  const [convertDiagrams, setConvertDiagrams] = useState(
    settings.github?.autoConvertDiagrams || false
  );

  const handleSave = async () => {
    let renderedDiagrams = [];

    if (convertDiagrams) {
      // Extract diagram data from rendered preview
      renderedDiagrams = await extractRenderedDiagrams();
    }

    const result = await documentsApi.saveToGitHubWithDiagrams(document.id, {
      commitMessage,
      convertDiagrams,
      diagramFormat: settings.github?.diagramFormat || 'svg',
      renderedDiagrams
    });

    onSaveSuccess(result);
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Save to GitHub</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Commit Message</Form.Label>
          <Form.Control
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Update documentation"
          />
        </Form.Group>

        <Form.Check
          type="switch"
          id="convert-diagrams-switch"
          label="Convert advanced diagrams for GitHub compatibility"
          checked={convertDiagrams}
          onChange={(e) => setConvertDiagrams(e.target.checked)}
        />

        {convertDiagrams && (
          <Alert variant="info" className="mt-2">
            Advanced Mermaid diagrams will be converted to images with collapsible source code.
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save to GitHub</Button>
      </Modal.Footer>
    </Modal>
  );
}
```

## Implementation Workflow

### Phase 1: Export Service Enhancement
1. Add diagram export endpoints to export service (`/export-diagram-svg`, `/export-diagram-png`)
2. Enhance CSS service with diagram-specific styling
3. Test export service diagram export functionality
4. Validate SVG and PNG output quality

### Phase 2: Frontend Export Service
1. Create `exportServiceApi.js` client for export service communication
2. Update `MermaidExportService.js` to use export service instead of browser APIs
3. Implement `DiagramControls.jsx` component with overlay controls
4. Add SCSS styles for diagram controls

### Phase 3: Settings Integration
1. Create `GitHubIntegrationSettings.jsx` component
2. Update settings schema and API endpoints
3. Integrate settings into main settings panel
4. Test settings persistence and retrieval

### Phase 4: Renderer Enhancement
1. Modify `RendererSection.jsx` to add diagram controls
2. Implement diagram container wrapping
3. Add fullscreen modal for diagram viewing
4. Test control visibility and interaction

### Phase 5: Backend Conversion Service
1. Create `GitHubDiagramConversionService` class
2. Implement diagram detection and conversion logic
3. Add GitHub-compatible markdown generation
4. Integrate with PDF service for image generation

### Phase 6: Frontend-Backend Integration
1. Update `GitHubSaveModal.jsx` with conversion options
2. Enhance document API with diagram conversion
3. Implement diagram data extraction from rendered preview
4. Test end-to-end conversion workflow

### Phase 7: GitHub API Enhancement
1. Update GitHub API service with diagram upload
2. Implement batch file upload for diagrams
3. Add proper error handling and rollback
4. Test GitHub repository integration

## Testing Strategy

### Unit Tests
- `MermaidExportService` SVG/PNG export functions
- Diagram detection regex patterns
- GitHub-compatible markdown generation
- Settings persistence and retrieval

### Integration Tests
- Complete save-to-GitHub workflow with diagram conversion
- Manual diagram export via controls
- Settings changes affecting auto-conversion
- Error handling for failed diagram conversion

### End-to-End Tests
- User enables auto-conversion in settings
- User creates document with advanced diagrams
- User saves to GitHub and verifies image generation
- GitHub repository shows images with collapsible source

## Error Handling

### Graceful Degradation
- If diagram export fails, continue with original diagram code
- Show user notification about conversion failures
- Provide option to retry or skip conversion
- Log detailed error information for debugging

### User Feedback
- Loading indicators during diagram conversion
- Progress messages for batch diagram processing
- Clear error messages with actionable steps
- Success confirmations with GitHub links

## Security Considerations

### Image Upload Safety
- Validate diagram source before rendering
- Sanitize generated SVG content
- Limit file sizes for uploaded images
- Proper GitHub API token usage

### User Data Protection
- Don't log diagram source content
- Secure storage of GitHub access tokens
- Proper cleanup of temporary files
- User consent for automatic conversion

## Performance Optimization

### Caching Strategy
- Cache rendered diagram images
- Avoid re-converting identical diagrams
- Use content hashing for cache keys
- Cleanup old cached images

### Batch Processing
- Process multiple diagrams efficiently
- Parallel image generation where possible
- Optimize GitHub API calls
- Show progress for long operations

## Documentation Requirements

### User Documentation
- How to enable auto-conversion
- Manual diagram export instructions
- GitHub compatibility explanations
- Troubleshooting common issues

### Developer Documentation
- API endpoint specifications
- Service integration patterns
- Extension points for new formats
- Testing procedures and examples

This implementation provides a comprehensive solution for GitHub-compatible diagram export while maintaining the full power of Markdown Manager's advanced Mermaid features for local use.
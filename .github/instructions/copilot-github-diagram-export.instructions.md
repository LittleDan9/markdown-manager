# GitHub-Compatible Diagram Export Implementation Instructions

## Overview

This document provides comprehensive instructions for implementing automatic GitHub-compatible diagram export features in Markdown Manager. The system will detect advanced Mermaid diagrams (architecture-beta, custom icons) and automatically convert them to static images when saving to GitHub repositories.

## Phase 2 Implementation Summary (COMPLETED)

**Phase 2: Frontend Export Service Implementation** has been successfully completed with the following key achievements:

### ✅ Export Service Architecture Refactor
- **App Factory Pattern**: Successfully refactored export service from monolithic structure to proper app factory pattern matching backend architecture
- **Modular Router Structure**:
  - `app/app_factory.py` - Central application factory with `create_app()` function and lifespan management
  - `app/routers/default.py` - Health check and root endpoints (`/health`, `/`)
  - `app/routers/pdf.py` - PDF export functionality (`/document/pdf`)
  - `app/routers/diagram.py` - SVG/PNG diagram export (`/diagram/svg`, `/diagram/png`)
- **Clean Endpoint Structure**: Removed redundant "export-" prefixes, using clean RESTful endpoints
- **Consistent Patterns**: Now follows the same architectural patterns as the backend service with proper dependency injection and error handling

### ✅ Frontend API Integration
- **exportServiceApi.js**: Complete API client for export service communication
  - Clean method names: `exportDiagramAsSVG()`, `exportDiagramAsPNG()`, `exportAsPDF()`
  - Nginx routing integration through `/api/export/` prefix
  - Proper error handling and blob management for binary data
  - Base64 to Blob conversion for PNG exports
  - Backward compatibility aliases for existing code
- **documentsApi.js**: Enhanced with diagram export methods
  - `exportDiagramAsSVG()` and `exportDiagramAsPNG()` methods added
  - `saveToGitHubWithDiagrams()` method prepared for GitHub integration
  - Dynamic import pattern maintains lazy loading of export service API
  - Enhanced documentation noting client-side vs server-side conversion options

### ✅ Infrastructure Integration
- **Nginx Routing**: Both development and production configurations updated
  - `nginx-dev.conf` and `littledan.com.conf` include `/api/export/` location blocks
  - Proper precedence handling with `/api/export/` before general `/api/` catch-all
  - Correct proxy settings with timeout and header configurations
- **Docker Integration**: Export service properly integrated with Docker Compose
  - App factory pattern works seamlessly in containerized environment
  - Volume mounts and environment configurations maintained
  - Health checks functional across all deployment methods

### ✅ Verified Functionality
All endpoints tested and confirmed working:
- **Health Check**: `GET /api/export/health` ✅
- **Diagram SVG Export**: `POST /api/export/diagram/svg` ✅
- **Diagram PNG Export**: `POST /api/export/diagram/png` ✅
- **PDF Export**: `POST /api/export/document/pdf` ✅
- **Nginx Routing**: All endpoints accessible through nginx proxy ✅
- **App Factory Pattern**: Proper initialization and lifespan management ✅

### ✅ Technical Implementation Details
- **CSS Service Enhancement**: `get_diagram_css()` method provides optimized styling for diagram exports (no page breaks, centered layout)
- **Chromium Rendering**: High-quality SVG extraction and PNG rasterization using Playwright
- **Error Handling**: Comprehensive error handling with structured logging and HTTP status codes
- **Performance**: Efficient viewport management and resource cleanup in browser automation
- **Security**: Proper SVG namespace handling and sanitization

### 📋 Architecture Consistency Achieved
The export service now properly follows the established patterns:
- **App Factory**: `create_app()` function with proper lifecycle management matching backend
- **Router Organization**: Separated concerns with domain-specific routers
- **Service Boundaries**: Clean separation between PDF and diagram export functionality
- **Dependency Injection**: Proper service initialization and dependency management
- **Logging**: Structured logging matching backend patterns

### 🔧 Ready for Phase 3
Phase 2 has established the foundation for Phase 3 implementation:
- Export service can handle diagram rendering with high quality
- Frontend APIs are prepared for GitHub integration features
- nginx routing supports the full export service functionality
- Architecture is consistent and maintainable for future enhancements

## Core Requirements

### User Story
- Users with GitHub integration enabled can toggle a setting to auto-convert advanced diagrams for GitHub compatibility
- When saving to GitHub, advanced diagrams are automatically converted to SVG/PNG images with fallback source code
- Users can manually export individual diagrams via overlay controls in the renderer
- Each diagram gets expand/download controls for fullscreen viewing and manual export

## Phase 3: Settings Integration & Diagram Controls (COMPLETED)

**Phase 3: Settings Integration & Diagram Controls** has been successfully completed with the following key achievements:

### ✅ Phase 3 Implementation Summary

Phase 3 built on the completed export service infrastructure to add user-facing features for diagram interaction and export:

### ✅ MermaidExportService Implementation
- **Location**: `frontend/src/services/rendering/MermaidExportService.js`
- **Purpose**: High-quality diagram export using Phase 2 export service APIs
- **Key Features**:
  - `exportAsSVG()` and `exportAsPNG()` methods using export service endpoints
  - `needsGitHubConversion()` method for detecting advanced Mermaid features
  - `generateFilename()` method for consistent file naming
  - `extractDiagramMetadata()` method for diagram information extraction
  - Integration with `exportServiceApi` for Chromium-based rendering
  - Proper error handling with user-friendly messages
  - Support for export options (width, height, dark mode)

### ✅ DiagramControls Component Implementation
- **Location**: `frontend/src/components/renderer/DiagramControls.jsx`
- **Purpose**: Overlay controls for individual diagrams with hover interaction
- **Key Features**:
  - Fullscreen button for enhanced diagram viewing
  - Export dropdown with SVG/PNG options
  - GitHub compatibility indicators for advanced diagrams
  - Hover-based visibility with smooth transitions
  - Context provider integration (Theme and Notification)
  - ReactDOM portal rendering for dynamic attachment to diagrams
  - Proper cleanup and memory management

### ✅ DiagramFullscreenModal Implementation
- **Location**: `frontend/src/components/renderer/DiagramFullscreenModal.jsx`
- **Purpose**: Enhanced fullscreen diagram viewing with export controls
- **Key Features**:
  - Modal-based fullscreen diagram display
  - Integrated export controls within modal
  - SVG content rendering with proper styling
  - Diagram metadata display
  - Export progress indicators
  - Responsive design for different screen sizes
  - Dark mode support

### ✅ CSS Styling System
- **Location**: `frontend/src/styles/components/_diagram-controls.scss`
- **Purpose**: Complete styling system for diagram controls and interactions
- **Key Features**:
  - Hover-based control visibility with opacity transitions
  - Responsive design for mobile and desktop
  - Dark mode support with theme-aware styling
  - Fullscreen modal styling with proper layout
  - Print-friendly styles (controls hidden in print)
  - Bootstrap 5.3 integration with custom overrides
  - Proper z-index management for overlay controls

### ✅ Renderer Integration Enhancement
- **Location**: `frontend/src/components/renderer/Renderer.jsx`
- **Purpose**: Automatic diagram controls integration with Mermaid rendering
- **Key Features**:
  - `addDiagramControls()` function using ReactDOM portals
  - Automatic detection of rendered Mermaid diagrams
  - Dynamic control attachment after diagram processing
  - Proper provider context wrapping for portal components
  - Cleanup functionality to prevent memory leaks
  - Integration with existing Mermaid rendering pipeline

### ✅ Provider Context Integration
- **ThemeProvider Enhancement**: Added `isDarkMode` property for easier theme detection
- **NotificationProvider Integration**: Proper context access for diagram export notifications
- **Context Fallback Handling**: Safe destructuring and fallback values for portal components
- **Provider Wrapping**: Explicit provider wrapping for ReactDOM portal components

### ✅ Technical Implementation Details
- **ReactDOM Portals**: Used for dynamic component rendering without DOM manipulation
- **Context Provider Access**: Solved portal context access issues with explicit wrapping
- **SVG Content Extraction**: Direct DOM querying for SVG elements from rendered diagrams
- **Export Service Integration**: Full integration with Phase 2 export service APIs
- **Error Handling**: Comprehensive error handling with user notifications
- **Memory Management**: Proper cleanup of portal components and event listeners

### ✅ Verified Functionality
All Phase 3 features tested and confirmed working:
- **Diagram Controls Overlay**: Controls appear on hover over Mermaid diagrams ✅
- **Export Functionality**: SVG and PNG export working via export service ✅
- **Fullscreen Modal**: Diagrams display properly in fullscreen modal ✅
- **GitHub Indicators**: Advanced diagrams show GitHub compatibility warnings ✅
- **CSS Styling**: Responsive design and dark mode support functional ✅
- **Context Integration**: Theme and notification providers working in portals ✅
- **ReactDOM Portals**: Dynamic component attachment successful ✅

### 🔧 Ready for Phase 4: Renderer Enhancement
Phase 3 has established the UI foundation for Phase 4 implementation:
- Diagram controls are functional and properly styled
- Export service integration is complete and tested
- Fullscreen modal provides enhanced viewing experience
- CSS framework supports responsive and accessible design
- Component architecture is ready for settings integration

## Phase 4: Renderer Enhancement (📋 NEXT)

**Phase 4 builds on the completed diagram controls to add settings integration and GitHub workflow preparation:**

### Phase 4 Goals
1. **GitHub Integration Settings**: User preferences for auto-conversion
2. **Settings Panel Integration**: Add diagram settings to main settings
3. **Settings Persistence**: Store user preferences for diagram export
4. **Workflow Preparation**: Prepare for Phase 5 backend integration

### Phase 4 Implementation Requirements
Based on completed Phase 3, the following components need implementation:

#### 1. ✅ MermaidExportService (COMPLETED)
**Location**: `frontend/src/services/rendering/MermaidExportService.js`
**Status**: Fully implemented in Phase 3
**Key Methods Implemented**:
- `exportAsSVG()` - Export diagrams as SVG using export service
- `exportAsPNG()` - Export diagrams as PNG using export service
- `needsGitHubConversion()` - Detect advanced Mermaid features
- `generateFilename()` - Generate consistent filenames
- `extractDiagramMetadata()` - Extract diagram information

#### 2. ✅ DiagramControls Component (COMPLETED)
**Location**: `frontend/src/components/renderer/DiagramControls.jsx`
**Status**: Fully implemented in Phase 3
**Features Implemented**:
- Overlay controls with hover interaction
- Export dropdown (SVG/PNG options)
- Fullscreen button integration
- GitHub compatibility indicators
- Context provider integration

#### 3. ✅ DiagramFullscreenModal Component (COMPLETED)
**Location**: `frontend/src/components/renderer/DiagramFullscreenModal.jsx`
**Status**: Fully implemented in Phase 3
**Features Implemented**:
- Modal-based fullscreen display
- Integrated export controls
- SVG content rendering
- Responsive design with dark mode support

#### 4. ✅ CSS Styling System (COMPLETED)
**Location**: `frontend/src/styles/components/_diagram-controls.scss`
**Status**: Fully implemented in Phase 3
**Features Implemented**:
- Hover-based control visibility
- Responsive design for all screen sizes
- Dark mode support
- Print-friendly styles

#### 5. ✅ Renderer Integration (COMPLETED)
**Location**: `frontend/src/components/renderer/Renderer.jsx`
**Status**: Enhanced in Phase 3
**Features Implemented**:
- Automatic diagram controls attachment via ReactDOM portals
- Provider context wrapping for portal components
- Cleanup functionality for memory management

### Phase 4 Required Components

#### 📋 GitHubIntegrationSettings Component (NEW - Phase 4)
**Purpose**: User settings for auto-conversion preferences
**Location**: `frontend/src/components/settings/GitHubIntegrationSettings.jsx`

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

#### 📋 Enhanced Settings Integration (NEW - Phase 4)
**Purpose**: Integrate GitHub diagram settings into main settings panel
**Modifications Required**:
1. Update main settings component to include GitHubIntegrationSettings
2. Add settings schema for GitHub diagram preferences
3. Implement settings persistence and retrieval

### Backend Components for Phase 5 Preparation

#### 📋 Settings Schema Updates (Phase 4 Backend)
**Purpose**: Backend support for GitHub diagram settings
**Location**: `backend/app/schemas/settings.py`

```python
class GitHubSettings(BaseModel):
    """GitHub integration settings."""
    auto_convert_diagrams: bool = Field(False, description="Auto-convert advanced diagrams for GitHub")
    diagram_format: str = Field('svg', description="Export format for diagrams", regex='^(svg|png)$')
    fallback_to_standard: bool = Field(True, description="Convert architecture-beta to standard flowcharts")
```

### Export Service Enhancement (✅ COMPLETED IN PHASE 2)

All export service components are fully implemented and tested:
- ✅ **Diagram Export Endpoints**: `/api/export/diagram/svg` and `/api/export/diagram/png`
- ✅ **CSS Service Enhancement**: Optimized styling for diagram exports
- ✅ **Chromium Rendering**: High-quality SVG and PNG generation
- ✅ **Frontend API Integration**: Complete `exportServiceApi.js` client

  /**
   * Download diagram as file
   * @param {HTMLElement} diagramElement - The diagram element
   * @param {string} filename - Target filename without extension
   * @param {string} format - 'svg' or 'png'
   * @param {Object} options - Export options
   */
  static async downloadDiagram(diagramElement, filename, format = 'svg', options = {}) {
    try {
      const exportedData = await this.exportDiagramToImage(diagramElement, format, options);

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
- ✅ **Updated for Phase 2**: Uses the implemented `exportServiceApi` with clean endpoint structure
- ✅ **Export Service Integration**: Leverages `/api/export/diagram/svg` and `/api/export/diagram/png` endpoints
- ✅ **High-Quality Rendering**: Uses export service's Chromium rendering for consistent quality
- ✅ **Proper Options Handling**: Supports width, height, and dark mode options
- ✅ **Error Handling**: Comprehensive error handling with user-friendly messages
- ✅ **Blob Management**: Proper handling of SVG strings and PNG blobs

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

### Export Service Enhancement (✅ COMPLETED IN PHASE 2)

#### 1. Diagram Export Endpoints (✅ IMPLEMENTED)

**Status**: Successfully implemented in `export-service/app/routers/diagram.py`

The export service now provides clean RESTful endpoints:

```python
# Implemented endpoints:
POST /diagram/svg     # Export diagram as SVG using Chromium rendering
POST /diagram/png     # Export diagram as PNG using Chromium rendering

# Router structure:
from fastapi import APIRouter
from app.services.css_service import css_service

router = APIRouter()

@router.post("/svg")
async def export_diagram_svg(request: DiagramExportRequest) -> dict:
    """Export diagram as SVG using Chromium rendering."""
    # Implementation uses Playwright for high-quality SVG extraction
    # Returns: {"svg_content": "<svg>...</svg>"}

@router.post("/png")
async def export_diagram_png(request: DiagramExportRequest) -> dict:
    """Export diagram as PNG using Chromium rendering."""
    # Implementation uses Playwright for high-quality PNG rasterization
    # Returns: {"image_data": "base64_encoded_png_data"}
```

**Key Features Implemented**:
- ✅ **Chromium Rendering**: High-quality diagram rendering using Playwright
- ✅ **CSS Integration**: Uses `css_service.get_diagram_css()` for consistent styling
- ✅ **Viewport Management**: Configurable width/height for export dimensions
- ✅ **SVG Namespace Handling**: Proper SVG attributes for compatibility
- ✅ **Error Handling**: Comprehensive error handling with structured logging
- ✅ **Base64 Encoding**: PNG exports properly encoded for frontend consumption

#### 2. Enhanced CSS Service (✅ IMPLEMENTED)

**Status**: Successfully implemented in `export-service/app/services/css_service.py`

The CSS service now includes diagram-specific styling:

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

**CSS Optimizations**:
- ✅ **No Page Breaks**: Removes PDF page break styles for single diagram export
- ✅ **Centered Layout**: Diagrams are centered for optimal presentation
- ✅ **Responsive Sizing**: Diagrams scale properly within viewport
- ✅ **Theme Support**: Supports both light and dark mode styling

### Backend Integration

#### 1. Export Service API Client (✅ COMPLETED IN PHASE 2)

**Status**: Successfully implemented in `frontend/src/api/exportServiceApi.js`

The API client provides clean access to the export service:

```javascript
class ExportServiceApi extends Api {
  constructor() {
    super();
    // Uses standard base URL - nginx routes /api/export/ to export service
  }

  /**
   * Export diagram as SVG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options (width, height, isDarkMode)
   * @returns {Promise<string>} - SVG content as string
   */
  async exportDiagramAsSVG(htmlContent, options = {}) {
    const requestData = {
      html_content: htmlContent,
      format: 'svg',
      width: options.width || 1200,
      height: options.height || 800,
      is_dark_mode: options.isDarkMode || false
    };

    const res = await this.apiCall('/export/diagram/svg', 'POST', requestData);
    return res.data.svg_content;
  }

  /**
   * Export diagram as PNG using the export service
   * @param {string} htmlContent - HTML content containing the rendered diagram
   * @param {Object} options - Export options (width, height, isDarkMode)
   * @returns {Promise<Blob>} - PNG blob
   */
  async exportDiagramAsPNG(htmlContent, options = {}) {
    const requestData = {
      html_content: htmlContent,
      format: 'png',
      width: options.width || 1200,
      height: options.height || 800,
      is_dark_mode: options.isDarkMode || false
    };

    const res = await this.apiCall('/export/diagram/png', 'POST', requestData);

    // Convert base64 response to blob
    const binaryString = atob(res.data.image_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'image/png' });
  }

  // Additional methods: exportAsPDF(), checkHealth(), renderDiagramToSVG(), renderDiagramToImage()
}

export default new ExportServiceApi();
```

**Key Features Implemented**:
- ✅ **Clean API Methods**: Intuitive method names with proper parameter handling
- ✅ **Nginx Routing**: Automatically routes through `/api/export/` prefix
- ✅ **Binary Data Handling**: Proper blob conversion for PNG exports
- ✅ **Error Handling**: Comprehensive error handling with structured responses
- ✅ **Backward Compatibility**: Includes alias methods for existing code

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

### Phase 1: Export Service Enhancement (✅ COMPLETED)
1. ✅ Add diagram export endpoints to export service (`/diagram/svg`, `/diagram/png`)
2. ✅ Enhance CSS service with diagram-specific styling
3. ✅ Test export service diagram export functionality
4. ✅ Validate SVG and PNG output quality

### Phase 2: Frontend Export Service (✅ COMPLETED)
1. ✅ Create `exportServiceApi.js` client for export service communication
2. ✅ Update `documentsApi.js` with diagram export methods
3. ✅ Establish nginx routing for `/api/export/` endpoints
4. ✅ Verify all endpoints working through nginx proxy

### Phase 3: Settings Integration & Diagram Controls (✅ COMPLETED)
1. ✅ Create `MermaidExportService.js` to use export service APIs
2. ✅ Implement `DiagramControls.jsx` component with overlay controls
3. ✅ Create `DiagramFullscreenModal.jsx` for enhanced viewing
4. ✅ Enhance `Renderer.jsx` to add diagram controls via ReactDOM portals
5. ✅ Add SCSS styles for diagram controls and fullscreen modal
6. ✅ Integrate with theme and notification providers
7. ✅ Test diagram controls, export functionality, and fullscreen modal

### Phase 4: GitHub Settings Integration (📋 CURRENT)
1. 📋 Create `GitHubIntegrationSettings.jsx` component
2. 📋 Update backend settings schema for GitHub diagram preferences
3. 📋 Integrate settings into main settings panel
4. 📋 Test settings persistence and retrieval
5. 📋 Prepare workflow for Phase 5 backend integration

### Phase 5: Backend Conversion Service (📋 NEXT)
1. Create `GitHubDiagramConversionService` class
2. Implement diagram detection and conversion logic
3. Add GitHub-compatible markdown generation
4. Integrate with export service for image generation

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
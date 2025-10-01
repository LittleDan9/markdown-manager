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

## Phase 4: GitHub Settings Integration (✅ COMPLETED)

**Phase 4: GitHub Settings Integration** has been successfully completed with comprehensive backend and frontend implementation:

### ✅ Phase 4 Goals Achieved
1. ✅ **GitHub Integration Settings**: User preferences for auto-conversion implemented
2. ✅ **Settings Panel Integration**: Settings tab added to GitHub modal
3. ✅ **Settings Persistence**: Full database model and API persistence implemented
4. ✅ **Workflow Preparation**: Foundation complete for Phase 5 backend integration

### ✅ Backend Implementation Complete
- **GitHubSettings Database Model**: `backend/app/models/github_settings.py`
  - Complete model with user relationships and diagram export preferences
  - Fields: `auto_convert_diagrams`, `diagram_format`, `fallback_to_standard`, `auto_sync_enabled`, etc.
  - Foreign key relationships to User and GitHubAccount models
- **Alembic Migration**: `backend/migrations/versions/25784be2625f_add_github_settings_table.py`
  - Successfully applied migration for github_settings table
  - Proper indexes and constraints implemented
- **CRUD Operations**: `backend/app/crud/github_settings.py`
  - Complete CRUD with `create_user_settings`, `get_by_user_id`, `update_settings`
  - Default settings handling with auto-creation
  - Proper error handling and validation
- **API Endpoints**: `backend/app/routers/github_settings.py`
  - RESTful endpoints at `/api/github/settings/`
  - GET, POST, PUT, PATCH, DELETE operations implemented
  - JWT authentication integration
  - Proper HTTP status codes and error responses
- **Pydantic Schemas**: `backend/app/schemas/github_settings.py`
  - `GitHubSettingsCreate`, `GitHubSettingsUpdate`, `GitHubSettingsResponse`
  - Proper validation and default values
  - DateTime handling for created_at/updated_at fields

### ✅ Frontend Implementation Complete
- **GitHubSettingsProvider**: `frontend/src/contexts/GitHubSettingsProvider.jsx`
  - React context for settings state management
  - `loadSettings`, `updateSettings`, `getOrCreateSettings` methods
  - Default settings fallback and error handling
  - Integration with API client
- **GitHubSettingsTab Component**: `frontend/src/components/github/tabs/GitHubSettingsTab.jsx`
  - Complete form UI with diagram export preferences
  - Auto-convert toggle, format dropdown, sync settings
  - Real-time save functionality with change detection
  - Responsive design with Bootstrap 5.3 styling
  - Error handling and user notifications
- **GitHub Modal Integration**: `frontend/src/components/github/modals/GitHubModal.jsx`
  - Settings tab added as second tab (after Accounts, before Repositories)
  - Proper tab navigation and state management
  - Settings tab always visible regardless of account status
- **API Integration**: `frontend/src/api/githubSettingsApi.js`
  - Complete API client extending base Api class
  - Methods: `getSettings`, `createSettings`, `updateSettings`, `patchSettings`
  - Proper error handling and response validation
- **Provider Integration**: Settings provider integrated into AppProviders chain

### ✅ CSS and Styling Complete
- **GitHub Modal Styles**: `frontend/src/styles/modals/_github.scss`
  - Proper modal height constraints and flexbox layout
  - Tab content scrolling within card body
  - Custom scrollbar styling for better visibility
  - Responsive design with dark mode support
  - Fixed header, scrollable body pattern implemented

### ✅ Infrastructure Integration Complete
- **Database**: PostgreSQL github_settings table with proper relationships
- **Authentication**: JWT Bearer token security implemented and tested
- **API Testing**: All endpoints verified working with proper authentication
- **Frontend Compilation**: All components successfully integrated and compiling
- **Docker Integration**: Full hot-reload development environment working

### ✅ Verified Functionality
All Phase 4 features tested and confirmed working:
- **API Endpoints**: CRUD operations tested with curl and authentication ✅
- **Settings Persistence**: Database storage and retrieval working ✅
- **Frontend UI**: Settings tab functional with form controls ✅
- **Modal Integration**: Settings tab properly integrated in GitHub modal ✅
- **Scrolling**: Card body scrolling working with visible scrollbar ✅
- **Responsive Design**: Layout working across different screen sizes ✅
- **Error Handling**: Proper validation and user feedback implemented ✅

### 🎯 Phase 4 Achievement Summary
**COMPLETE** - Full settings infrastructure implemented with:
- ✅ Database model and migrations
- ✅ Backend API with authentication
- ✅ Frontend UI components and state management
- ✅ Modal integration with proper UX
- ✅ Responsive styling and accessibility
- ✅ Error handling and validation
- ✅ Hot-reload development environment

### 🔧 Ready for Phase 5: Backend Conversion Service
Phase 4 has established the complete foundation for Phase 5 implementation:
- ✅ **Settings Infrastructure**: User preferences stored and accessible via API
- ✅ **Export Service**: Diagram rendering capabilities fully functional
- ✅ **Frontend Components**: UI ready for conversion workflow integration
- ✅ **Authentication**: Security and access control implemented
- ✅ **Database Schema**: All required models and relationships in place

## Phase 5: Backend Conversion Service (📋 NEXT PRIORITY)

**Phase 5 builds on the completed settings infrastructure to implement the core diagram conversion logic:**

### 🎯 Phase 5 Goals
1. **GitHubDiagramConversionService**: Server-side logic for detecting and converting advanced Mermaid diagrams
2. **Integration with Export Service**: Use existing export service to render diagrams as images
3. **GitHub-Compatible Markdown**: Generate markdown with image references and collapsible source
4. **Workflow Integration**: Connect user settings to actual conversion process

### 📋 Phase 5 Implementation Requirements

#### 1. **GitHubDiagramConversionService** (NEW - HIGH PRIORITY)
**Location**: `backend/app/services/github/conversion.py`
**Purpose**: Core service for detecting and converting advanced Mermaid diagrams

```python
from typing import Dict, List, Tuple, Optional
import re
import hashlib
import httpx
import base64
from pathlib import Path

class GitHubDiagramConversionService:
    """Service for converting advanced Mermaid diagrams for GitHub compatibility."""

    def __init__(self):
        # Patterns to detect advanced Mermaid features incompatible with GitHub
        self.advanced_patterns = [
            r'architecture-beta',                              # Architecture diagrams
            r'service\s+\w+\([^)]*:[^)]*\)',                  # Services with icons
            r'group\s+\w+\([^)]*:[^)]*\)',                    # Groups with icons
            r'\b(awssvg|awsgrp|logos|devicon|flat-color-icons):', # Icon references
            r'junction\s+\w+',                                # Architecture junctions
            r'database\s+\w+\([^)]*:[^)]*\)',                # Databases with icons
        ]

        # Export service configuration
        self.export_service_url = "http://export-service:8001"

    def has_advanced_features(self, diagram_source: str) -> bool:
        """Check if diagram uses advanced features incompatible with GitHub."""
        return any(re.search(pattern, diagram_source, re.IGNORECASE | re.MULTILINE)
                  for pattern in self.advanced_patterns)

    def extract_mermaid_blocks(self, content: str) -> List[Dict]:
        """Extract Mermaid code blocks from markdown content with metadata."""
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
                'end': match.end(),
                'needs_conversion': self.has_advanced_features(diagram_source),
                'line_number': content[:match.start()].count('\n') + 1
            })

        return blocks

    def create_github_compatible_block(self, image_path: str, original_code: str,
                                     diagram_hash: str) -> str:
        """Create GitHub-compatible markdown with image and collapsible source."""
        return f"""![Diagram {diagram_hash}]({image_path})

<details>
<summary>📊 View diagram source (best viewed in Markdown Manager)</summary>

```mermaid
{original_code}
```
</details>"""

    async def render_diagram_via_export_service(self, diagram_source: str,
                                               format: str = 'svg',
                                               options: Dict = None) -> str:
        """Render diagram using export service and return as base64."""
        if options is None:
            options = {'width': 1200, 'height': 800, 'is_dark_mode': False}

        # Create minimal HTML for the diagram
        diagram_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        </head>
        <body>
            <div class="mermaid">
{diagram_source}
            </div>
            <script>
                mermaid.initialize({{ startOnLoad: true }});
            </script>
        </body>
        </html>
        """

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                if format == 'svg':
                    response = await client.post(
                        f"{self.export_service_url}/diagram/svg",
                        json={
                            "html_content": diagram_html,
                            "format": "svg",
                            **options
                        }
                    )
                    response.raise_for_status()
                    result = response.json()
                    return base64.b64encode(result['svg_content'].encode()).decode()

                else:  # PNG format
                    response = await client.post(
                        f"{self.export_service_url}/diagram/png",
                        json={
                            "html_content": diagram_html,
                            "format": "png",
                            **options
                        }
                    )
                    response.raise_for_status()
                    result = response.json()
                    return result['image_data']  # Already base64 encoded

            except httpx.HTTPError as e:
                raise RuntimeError(f"Failed to render diagram via export service: {e}")
            except Exception as e:
                raise RuntimeError(f"Unexpected error rendering diagram: {e}")

    async def convert_content_for_github(
        self,
        content: str,
        format: str = 'svg',
        settings: Dict = None
    ) -> Tuple[str, List[Dict]]:
        """
        Convert markdown content for GitHub compatibility.

        Args:
            content: Original markdown content
            format: Export format ('svg' or 'png')
            settings: User GitHub settings (from Phase 4 implementation)

        Returns:
            Tuple of (converted_content, image_files_to_upload)
        """
        if settings is None:
            settings = {'auto_convert_diagrams': True, 'diagram_format': format}

        # Only convert if auto-conversion is enabled
        if not settings.get('auto_convert_diagrams', False):
            return content, []

        mermaid_blocks = self.extract_mermaid_blocks(content)
        image_files = []
        converted_content = content

        # Process blocks in reverse order to maintain string positions
        for block in reversed(mermaid_blocks):
            if block['needs_conversion']:
                try:
                    # Generate image via export service
                    image_data = await self.render_diagram_via_export_service(
                        block['code'],
                        settings.get('diagram_format', format)
                    )

                    # Create filename and path
                    filename = f"diagram-{block['hash']}.{settings.get('diagram_format', format)}"
                    image_path = f"diagrams/{filename}"

                    # Replace in content
                    replacement = self.create_github_compatible_block(
                        image_path, block['code'], block['hash']
                    )

                    converted_content = (
                        converted_content[:block['start']] +
                        replacement +
                        converted_content[block['end']:]
                    )

                    # Add to upload queue
                    image_files.append({
                        'path': image_path,
                        'filename': filename,
                        'diagram_source': block['code'],
                        'format': settings.get('diagram_format', format),
                        'image_data': image_data,
                        'hash': block['hash'],
                        'original_line': block['line_number']
                    })

                except Exception as e:
                    # Log error but continue with original diagram
                    print(f"Failed to convert diagram {block['hash']}: {e}")
                    continue

        return converted_content, image_files
```

#### 2. **Enhanced GitHub API Service** (MODIFY EXISTING)
**Location**: `backend/app/services/github/api.py`
**Purpose**: Add diagram upload capabilities to existing GitHub service

```python
# Add this method to existing GitHubApiService class

async def commit_file_with_diagrams(
    self,
    access_token: str,
    owner: str,
    repo: str,
    file_path: str,
    content: str,
    message: str,
    branch: str = 'main',
    sha: Optional[str] = None,
    user_settings: Optional[Dict] = None
) -> Dict[str, Any]:
    """Commit file with optional diagram conversion based on user settings."""

    if user_settings and user_settings.get('auto_convert_diagrams', False):
        from .conversion import GitHubDiagramConversionService

        converter = GitHubDiagramConversionService()

        try:
            # Convert content and get image files to upload
            converted_content, image_files = await converter.convert_content_for_github(
                content,
                user_settings.get('diagram_format', 'svg'),
                user_settings
            )

            # Upload diagram images first
            uploaded_files = []
            for image_file in image_files:
                try:
                    upload_result = await self.create_or_update_file(
                        access_token, owner, repo,
                        image_file['path'],
                        image_file['image_data'],
                        f"Add diagram: {image_file['filename']}",
                        branch=branch
                    )
                    uploaded_files.append({
                        'path': image_file['path'],
                        'filename': image_file['filename'],
                        'upload_result': upload_result
                    })
                except Exception as e:
                    # Log error but continue
                    print(f"Failed to upload diagram {image_file['filename']}: {e}")
                    continue

            # Use converted content for main file
            content = converted_content

            # Add upload summary to commit message
            if uploaded_files:
                diagram_count = len(uploaded_files)
                message = f"{message}\n\n📊 Auto-converted {diagram_count} diagram(s) for GitHub compatibility"

        except Exception as e:
            # Log error but proceed with original content
            print(f"Diagram conversion failed, proceeding with original content: {e}")

    # Proceed with normal file commit
    return await self.create_or_update_file(
        access_token, owner, repo, file_path, content, message, sha, branch
    )
```

#### 3. **Document API Enhancement** (MODIFY EXISTING)
**Location**: `backend/app/routers/documents.py`
**Purpose**: Add GitHub save endpoint with diagram conversion

```python
# Add this endpoint to existing documents router

@router.post("/{document_id}/github/save")
async def save_document_to_github(
    document_id: int,
    github_save_request: GitHubSaveRequest,  # New Pydantic model needed
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save document to GitHub with optional diagram conversion."""

    # Get document
    document = await documents_crud.get_by_id(db, document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get user's GitHub settings (from Phase 4 implementation)
    from app.crud.github_settings import github_settings_crud
    user_settings = await github_settings_crud.get_by_user_id(db, current_user.id)
    settings_dict = None
    if user_settings:
        settings_dict = {
            'auto_convert_diagrams': user_settings.auto_convert_diagrams,
            'diagram_format': user_settings.diagram_format,
            'fallback_to_standard': user_settings.fallback_to_standard
        }

    # Get GitHub API service
    github_service = GitHubApiService()

    try:
        # Commit with diagram conversion
        result = await github_service.commit_file_with_diagrams(
            access_token=github_save_request.access_token,
            owner=github_save_request.owner,
            repo=github_save_request.repo,
            file_path=github_save_request.file_path,
            content=document.content,
            message=github_save_request.commit_message,
            branch=github_save_request.branch,
            sha=github_save_request.sha,
            user_settings=settings_dict
        )

        return {
            "message": "Document saved to GitHub successfully",
            "github_result": result,
            "diagrams_converted": settings_dict.get('auto_convert_diagrams', False) if settings_dict else False
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save to GitHub: {str(e)}"
        )
```

#### 4. **New Pydantic Schemas** (NEW FILE)
**Location**: `backend/app/schemas/github_save.py`

```python
from pydantic import BaseModel, Field
from typing import Optional

class GitHubSaveRequest(BaseModel):
    """Request model for saving documents to GitHub."""
    access_token: str = Field(..., description="GitHub access token")
    owner: str = Field(..., description="Repository owner")
    repo: str = Field(..., description="Repository name")
    file_path: str = Field(..., description="File path in repository")
    commit_message: str = Field(..., description="Commit message")
    branch: str = Field(default="main", description="Target branch")
    sha: Optional[str] = Field(None, description="File SHA for updates")

class GitHubSaveResponse(BaseModel):
    """Response model for GitHub save operations."""
    message: str
    github_result: dict
    diagrams_converted: bool
    converted_diagrams: Optional[list] = None
```

### 🔧 Frontend Integration Requirements (Phase 5)

#### 1. **Enhanced Document API Client** (MODIFY EXISTING)
**Location**: `frontend/src/api/documentsApi.js`

```javascript
// Add this method to existing DocumentsApi class

async saveToGitHubWithDiagrams(documentId, options = {}) {
  const {
    accessToken,
    owner,
    repo,
    filePath,
    commitMessage,
    branch = 'main',
    sha = null
  } = options;

  const response = await this.apiCall(`/documents/${documentId}/github/save`, 'POST', {
    access_token: accessToken,
    owner,
    repo,
    file_path: filePath,
    commit_message: commitMessage,
    branch,
    sha
  });

  return response.data;
}
```

#### 2. **GitHub Save Modal Enhancement** (MODIFY EXISTING)
**Location**: `frontend/src/components/github/modals/GitHubSaveModal.jsx`
**Purpose**: Update existing modal to use new API with diagram conversion

```jsx
// Update existing handleSave method

const handleSave = async () => {
  try {
    setSaving(true);

    const result = await documentsApi.saveToGitHubWithDiagrams(document.id, {
      accessToken: selectedAccount.access_token,
      owner: selectedRepository.owner.login,
      repo: selectedRepository.name,
      filePath: `${document.title}.md`,
      commitMessage,
      branch: selectedBranch,
      sha: existingFile?.sha
    });

    // Show success with diagram conversion info
    if (result.diagrams_converted) {
      addNotification(
        `Document saved to GitHub with ${result.converted_diagrams?.length || 0} diagrams converted`,
        'success'
      );
    } else {
      addNotification('Document saved to GitHub successfully', 'success');
    }

    onSaveSuccess(result);

  } catch (error) {
    console.error('Failed to save to GitHub:', error);
    addNotification('Failed to save to GitHub', 'error');
  } finally {
    setSaving(false);
  }
};
```

### 🧪 Phase 5 Testing Strategy

#### **Unit Tests** (NEW FILES)
- `test_github_conversion_service.py`: Test diagram detection and conversion logic
- `test_github_api_enhancement.py`: Test enhanced GitHub API with diagram upload
- `test_document_github_save.py`: Test document save endpoint with conversion

#### **Integration Tests** (NEW FILES)
- Test complete save-to-GitHub workflow with diagram conversion
- Test settings integration affecting conversion behavior
- Test error handling for failed diagram conversion
- Test export service integration

#### **End-to-End Tests** (NEW FILES)
- User creates document with architecture-beta diagrams
- User saves to GitHub with auto-conversion enabled
- Verify GitHub repository contains converted images
- Verify markdown shows images with collapsible source

### 🚀 Phase 5 Implementation Order

1. **Create GitHubDiagramConversionService** (Day 1)
2. **Enhance GitHub API Service** (Day 1-2)
3. **Add Document GitHub Save Endpoint** (Day 2)
4. **Create Pydantic Schemas** (Day 2)
5. **Update Frontend API Client** (Day 3)
6. **Enhance GitHub Save Modal** (Day 3)
7. **Write Unit Tests** (Day 4)
8. **Integration Testing** (Day 4-5)
9. **End-to-End Testing** (Day 5)

### ⚠️ Critical Dependencies for Phase 5

1. **Phase 4 Settings**: User settings must be accessible via API ✅ COMPLETE
2. **Export Service**: Diagram rendering endpoints must be functional ✅ COMPLETE
3. **GitHub API**: Existing GitHub integration must work ✅ COMPLETE
4. **Authentication**: JWT token system must be working ✅ COMPLETE
5. **Database**: All models and relationships must be in place ✅ COMPLETE

### 🎯 Phase 5 Success Criteria

- [📋] GitHubDiagramConversionService detects advanced diagrams correctly
- [📋] Export service integration renders diagrams as base64 images
- [📋] GitHub API uploads diagram images to repositories
- [📋] Document save endpoint converts content based on user settings
- [📋] Frontend modal shows conversion status and results
- [📋] End-to-end workflow: create → save → verify on GitHub
- [📋] Error handling gracefully degrades to original content
- [📋] Performance acceptable for documents with multiple diagrams

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

### Phase 4: GitHub Settings Integration (✅ COMPLETED)
1. ✅ Create GitHubSettings database model and migration
2. ✅ Implement CRUD operations and API endpoints
3. ✅ Create GitHubSettingsProvider React context
4. ✅ Implement GitHubSettingsTab UI component
5. ✅ Integrate settings tab into GitHub modal
6. ✅ Add responsive CSS and scrolling fix
7. ✅ Test settings persistence and API functionality
8. ✅ Verify authentication and error handling

### Phase 5: Backend Conversion Service (📋 CURRENT PRIORITY)
1. 📋 Create `GitHubDiagramConversionService` class
2. 📋 Implement diagram detection and conversion logic
3. 📋 Add GitHub-compatible markdown generation
4. 📋 Integrate with export service for image generation
5. 📋 Enhance GitHub API service with diagram upload
6. 📋 Add document save endpoint with conversion
7. 📋 Create required Pydantic schemas
8. 📋 Write comprehensive unit tests
9. 📋 Perform integration testing

### Phase 6: Frontend-Backend Integration (📋 NEXT)
1. 📋 Update `documentsApi.js` with new GitHub save method
2. 📋 Enhance `GitHubSaveModal.jsx` with conversion status
3. 📋 Add conversion progress indicators
4. 📋 Implement error handling and user feedback
5. 📋 Test end-to-end workflow

### Phase 7: GitHub API Enhancement & Testing (📋 FINAL)
1. 📋 Complete GitHub repository integration testing
2. 📋 Implement batch file upload optimization
3. 📋 Add comprehensive error handling and rollback
4. 📋 Perform end-to-end testing with real GitHub repositories
5. 📋 Validate diagram conversion quality and GitHub compatibility

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

---

## 🎯 CRITICAL INFORMATION FOR PHASE 5 IMPLEMENTATION

### 📋 Current Project Status (September 30, 2025)
- **Branch**: `github-mermaid`
- **Last Commit**: `efd6dc6` - "feat: Implement Phase 4 GitHub Settings Integration for Diagram Export"
- **Files Changed**: 37 files, 3,182+ lines added
- **Environment**: Docker Compose hybrid development with hot-reload
- **Status**: All Phase 1-4 components tested and functional

### 🔑 Key Architecture Decisions Made

#### **Backend Architecture**:
- **FastAPI + SQLAlchemy**: Async patterns with dependency injection
- **App Factory Pattern**: Both backend and export-service use `create_app()` pattern
- **Database**: PostgreSQL with Alembic migrations, `github_settings` table implemented
- **Authentication**: JWT Bearer tokens with proper validation
- **Service Communication**: HTTP between services using Docker service names

#### **Frontend Architecture**:
- **React + Bootstrap 5.3**: Component-based with context providers
- **State Management**: GitHubSettingsProvider for settings, DocumentProvider for documents
- **Styling**: SCSS modules with responsive design and dark mode support
- **Export Integration**: exportServiceApi client with nginx routing

#### **Export Service Architecture**:
- **Playwright + Chromium**: High-quality rendering for diagrams
- **Endpoints**: `/diagram/svg`, `/diagram/png` with clean RESTful design
- **CSS Service**: Optimized styling for different export formats
- **Error Handling**: Comprehensive logging and structured responses

### 🗂️ Key Files & Locations

#### **Phase 4 Completed Files**:
```
backend/app/models/github_settings.py          # Database model
backend/app/crud/github_settings.py            # CRUD operations
backend/app/routers/github_settings.py         # API endpoints
backend/app/schemas/github_settings.py         # Pydantic schemas
backend/migrations/versions/25784be2625f_*.py  # Database migration

frontend/src/contexts/GitHubSettingsProvider.jsx     # React context
frontend/src/components/github/tabs/GitHubSettingsTab.jsx  # UI component
frontend/src/api/githubSettingsApi.js                # API client
frontend/src/styles/modals/_github.scss              # Responsive styling
```

#### **Export Service Files** (Phase 2):
```
export-service/app/app_factory.py              # App factory pattern
export-service/app/routers/diagram.py          # SVG/PNG endpoints
export-service/app/services/css_service.py     # Enhanced CSS service
```

#### **Diagram Controls Files** (Phase 3):
```
frontend/src/services/rendering/MermaidExportService.js  # Export logic
frontend/src/components/renderer/DiagramControls.jsx    # Overlay controls
frontend/src/components/renderer/DiagramFullscreenModal.jsx  # Modal viewer
frontend/src/styles/components/_diagram-controls.scss   # Control styling
```

### 🔧 Development Environment Setup

#### **Required Services Running**:
```bash
# Backend + Database + Nginx
docker compose up -d backend db nginx

# Frontend (separate terminal for logs)
docker compose up frontend

# Verify services
curl http://localhost:80/api/health                    # Backend health
curl http://localhost:80/api/export/health            # Export service health
curl http://localhost:80/                             # Frontend accessible
```

#### **Database State**:
- **Migration Applied**: `25784be2625f_add_github_settings_table.py`
- **Tables**: `github_settings` with proper relationships to `users`
- **Test Data**: Settings can be created via API endpoints

#### **Authentication Testing**:
```bash
# Get JWT token (test user: dan@littledan.com)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYW5AbGl0dGxlZGFuLmNvbSIsImV4cCI6MTc1OTI1MDMwOX0.kgDzICxlVLCgoVzyvW1WyPnDK7pmEwbZJv3PAqprVqI"

# Test settings API
curl -H "Authorization: Bearer $TOKEN" http://localhost:80/api/github/settings/
```

### 🎯 Phase 5 Implementation Priorities

#### **Day 1**: Core Service Implementation
1. **Create `GitHubDiagramConversionService`** - Pattern detection and content processing
2. **Implement pattern detection** - Architecture-beta, custom icons, advanced features
3. **Add export service integration** - HTTP calls to render diagrams as images

#### **Day 2**: GitHub Integration
1. **Enhance GitHub API service** - Add diagram upload capabilities
2. **Create document save endpoint** - Integrate conversion with user settings
3. **Add Pydantic schemas** - Request/response models for GitHub save

#### **Day 3**: Frontend Integration
1. **Update documents API client** - New GitHub save method
2. **Enhance GitHub save modal** - Show conversion status and progress
3. **Add user feedback** - Notifications for conversion success/failure

#### **Day 4-5**: Testing & Validation
1. **Unit tests** - Conversion service, API endpoints, frontend components
2. **Integration tests** - End-to-end workflow with real GitHub repositories
3. **Performance testing** - Multiple diagrams, large documents

### ⚠️ Critical Implementation Notes

#### **Export Service Integration**:
- **Service URL**: `http://export-service:8001` (Docker internal)
- **Endpoints**: `/diagram/svg`, `/diagram/png` (already implemented)
- **Authentication**: No auth required for internal service calls
- **Timeout**: Use 60+ second timeout for complex diagrams

#### **GitHub API Patterns**:
- **Existing Service**: `backend/app/services/github/api.py` has base GitHub functionality
- **File Upload**: Use `create_or_update_file` method for images
- **Base64 Encoding**: All file content must be base64 encoded
- **Batch Operations**: Upload diagrams first, then main file

#### **User Settings Integration**:
- **Settings Access**: Use `github_settings_crud.get_by_user_id(db, user_id)`
- **Default Behavior**: If no settings, assume `auto_convert_diagrams: False`
- **Settings Fields**: `auto_convert_diagrams`, `diagram_format`, `fallback_to_standard`

#### **Error Handling Strategy**:
- **Graceful Degradation**: If conversion fails, save original content
- **User Feedback**: Clear notifications about conversion status
- **Logging**: Comprehensive logging for debugging conversion issues
- **Rollback**: No rollback needed - diagrams are additive to repositories

### 🧪 Testing Strategy for Phase 5

#### **Unit Tests Required**:
```python
# backend/tests/test_github_conversion_service.py
test_pattern_detection()
test_mermaid_block_extraction()
test_github_compatible_markdown_generation()
test_export_service_integration()

# backend/tests/test_document_github_save.py
test_save_with_conversion_enabled()
test_save_with_conversion_disabled()
test_conversion_failure_handling()
```

#### **Integration Tests Required**:
- Settings retrieval and application during conversion
- Export service communication and image generation
- GitHub API file upload with proper authentication
- End-to-end document save with diagram conversion

#### **Manual Testing Checklist**:
- [ ] Create document with architecture-beta diagrams
- [ ] Enable auto-conversion in GitHub settings
- [ ] Save document to GitHub repository
- [ ] Verify images uploaded to `diagrams/` folder
- [ ] Verify markdown shows images with collapsible source
- [ ] Test with both SVG and PNG formats
- [ ] Test error handling when conversion fails

### 🚀 Success Criteria for Phase 5

1. **✅ Service Implementation**: GitHubDiagramConversionService detects and converts advanced diagrams
2. **✅ Export Integration**: Successfully renders diagrams via export service
3. **✅ GitHub Upload**: Images uploaded to repository with proper paths
4. **✅ Content Conversion**: Markdown properly converted with image references
5. **✅ Settings Integration**: User preferences properly applied during conversion
6. **✅ Error Handling**: Graceful degradation when conversion fails
7. **✅ Performance**: Acceptable performance for documents with multiple diagrams
8. **✅ User Experience**: Clear feedback about conversion status and results

**Target Completion**: Phase 5 backend conversion service fully functional and tested, ready for Phase 6 frontend-backend integration.
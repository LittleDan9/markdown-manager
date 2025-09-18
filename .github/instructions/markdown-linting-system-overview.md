---
applyTo: "**/*"
description: "System overview for Markdown Linting implementation - architectural patterns and integration points"
---

# Markdown Linting System Overview

## 🎯 **Project Goal**

Implement a comprehensive markdown linting system that mirrors the existing spell checker architecture, providing real-time markdown syntax validation with configurable rules per category/folder.

## 🏗️ **Architecture Overview**

### **Core Design Principles**

1. **Simplified Service Architecture**: Use simple Node.js Express server instead of complex FastAPI layers
2. **API-First Design**: Frontend makes HTTP requests to backend services for processing
3. **Performance-First**: Direct library access eliminates subprocess overhead
4. **Configurable Rules**: Per-category and per-folder rule customization with database persistence
5. **Monaco Integration**: Native VS Code-like experience with markers and quick fixes

### **System Components**

```text
Frontend (React/Monaco)
├── Services Layer
│   ├── MarkdownLintService      # API client for linting requests
│   ├── MarkdownLintMarkers      # Monaco marker management
│   ├── MarkdownLintMarkerAdapter # Issue to marker conversion
│   ├── MarkdownLintActions      # Quick fixes and commands
│   └── MarkdownLintRulesService # Rule configuration & API client
├── UI Components
│   ├── MarkdownLintTab          # Settings interface
│   └── Toolbar integration      # Editor controls
└── Editor Integration
    ├── useEditor hook updates   # Linting lifecycle
    └── Monaco marker display    # Visual feedback

Backend Services
├── markdown-lint-service (Port 8002)
│   ├── Node.js Express server      # Simple HTTP server
│   ├── markdownlint library        # Direct library integration
│   ├── /lint endpoint            # Process text chunks with rules
│   └── /rules/definitions         # Available rule definitions
├── markdown-manager API (Port 8000)
│   ├── Rule persistence endpoints
│   │   ├── /markdown-lint/categories/{id}/rules
│   │   ├── /markdown-lint/folders/{path}/rules
│   │   └── /markdown-lint/user/defaults
│   ├── Proxy endpoints to lint service
│   │   └── /markdown-lint/process
│   ├── Hot reload enabled for development
│   └── Database Schema
│       └── markdown_lint_rules table
└── nginx (Port 80)
    ├── Route /api/markdown-lint/* → markdown-manager API
    └── Proxy linting requests to markdown-lint-service
```

### **Technology Stack**

**Frontend**:
- **HTTP API Client**: Communicates with backend markdown-lint-service
- **Monaco Editor**: Marker display and quick fixes
- **Chunked Processing**: Efficient handling of large documents via API
- **React Bootstrap**: UI components for settings

**Backend**:
- **markdown-lint-service**: Simple Node.js Express server with direct markdownlint library integration
- **markdownlint library**: Direct Node.js library access (no CLI subprocess calls)
- **Main API**: FastAPI endpoints for rule management and proxying
- **SQLAlchemy**: Async database operations
- **PostgreSQL**: Rule storage with JSONB configuration
- **Hot Reload**: Development environment supports live code updates

### **Integration Points**

1. **Spell Checker Coexistence**: Both systems operate independently with separate marker owners ('spell' vs 'markdownlint')
2. **Document Context**: Integrates with DocumentContextProvider for category/folder awareness
3. **Auth Provider**: Rule access based on user permissions
4. **Theme Provider**: Consistent styling with editor themes

## 📋 **Markdownlint Rules Integration**

### **Rule Categories**
Based on davidanson.vscode-markdownlint (59 rules total):

- **Headings** (11 rules): MD001, MD003, MD018-MD026
- **Lists** (6 rules): MD004, MD005, MD007, MD029, MD030, MD032
- **Spacing** (4 rules): MD009, MD010, MD012, MD027
- **Links & Images** (8 rules): MD011, MD034, MD039, MD042, MD045, MD051-MD053
- **Code** (4 rules): MD031, MD040, MD046, MD048
- **Style** (10 rules): MD013, MD033, MD035-MD038, MD047, MD049-MD050

### **Default Configuration**
```javascript
{
  MD013: false,           // line-length - often too restrictive
  MD001: true,            // heading-increment
  MD003: { style: 'atx' }, // heading-style
  MD007: { indent: 2 },   // ul-indent
  MD009: true,            // no-trailing-spaces
  MD040: true,            // fenced-code-language
  MD047: true             // single-trailing-newline
  // ... additional defaults
}
```

### **Auto-fixable Rules** (33 rules)
Rules that can be automatically corrected via quick fixes:
MD004, MD005, MD007, MD009, MD010, MD011, MD012, MD014, MD018-MD023, MD026-MD027, MD030-MD032, MD034, MD037-MD039, MD044, MD047, MD049-MD051, MD053-MD054, MD058

## 🔄 **Data Flow**

### **Linting Process**

1. **Trigger**: Content change in Monaco editor (debounced 1000ms)
2. **Chunking**: Text split into manageable chunks (2000 chars) on frontend
3. **Rule Resolution**: Get applicable rules for current category/folder from cache/API
4. **API Request**: Send chunks + rules to `/api/markdown-lint/process` endpoint
5. **Backend Processing**: markdown-lint-service processes chunks with markdownlint library
6. **Response Processing**: Convert API response to Monaco markers
7. **Display**: Show markers with tooltips and quick fixes

### **Rule Configuration Flow**

1. **UI**: User modifies rules in MarkdownLintTab
2. **API**: POST to `/api/markdown-lint/categories/{id}/rules` via main backend
3. **Storage**: Rules saved to PostgreSQL database with JSONB config
4. **Cache**: Local storage cache updated for immediate use
5. **Application**: Rules applied to next linting cycle

### **Backend Service Communication**

1. **Frontend** → **Main Backend**: Rule management and user data
2. **Main Backend** → **markdown-lint-service**: HTTP requests to Node.js Express server
3. **markdown-lint-service**: Direct markdownlint library integration (no subprocess calls)
4. **nginx**: Routes and load balances between services

**Architecture Benefits:**
- **Simplified**: Node.js Express server instead of FastAPI → subprocess → CLI
- **Performance**: Direct library access eliminates subprocess overhead
- **Debugging**: Direct Node.js console logs and error handling
- **Development**: Hot reload for faster iteration cycles

## 🎛️ **Configuration Hierarchy**

Rule precedence (highest to lowest):
1. **Folder-specific rules**: `/path/to/folder` configuration
2. **Category-specific rules**: Category-level configuration
3. **User defaults**: Personal rule preferences
4. **System defaults**: Built-in sensible defaults

## 🚀 **Performance Considerations**

- **Incremental Processing**: Only lint changed regions when possible
- **HTTP Request Optimization**: Efficient batching and concurrent processing  
- **Debounced Updates**: 1000ms delay to avoid excessive processing
- **Marker Reuse**: Preserve existing markers outside changed regions
- **Chunk Size**: 2000 character chunks for optimal API utilization

## 🧪 **Testing Strategy**

- **Unit Tests**: Individual service components
- **Integration Tests**: Full editor workflow
- **Performance Tests**: Large document handling
- **Rule Tests**: Verify markdownlint rule detection
- **UI Tests**: Settings interface functionality

## 📁 **File Structure**

```
frontend/src/
├── services/editor/
│   ├── MarkdownLintService.js        # API client for linting requests
│   ├── MarkdownLintMarkers.js        # Monaco marker management
│   ├── MarkdownLintMarkerAdapter.js  # Issue to marker conversion
│   └── MarkdownLintActions.js        # Quick fixes and commands
├── services/linting/
│   └── MarkdownLintRulesService.js   # Rule configuration & API client
├── components/linting/modals/
│   └── MarkdownLintTab.jsx           # Settings interface
├── api/
│   └── markdownLintApi.js            # API client for rule management
└── hooks/
    └── useMarkdownLint.js            # React integration hook

backend/app/
├── routers/
│   └── markdown_lint.py              # Rule persistence endpoints
├── crud/
│   └── markdown_lint.py              # Database operations
├── models/
│   └── markdown_lint.py              # SQLAlchemy models
└── schemas/
    └── markdown_lint.py              # Pydantic schemas

markdown-lint-service/                # Simple Node.js service  
├── server.js                         # Express.js HTTP server
├── package.json                      # Node.js dependencies and scripts
├── Dockerfile                        # Service containerization
└── README.md                         # Service documentation
```

## 🔗 **Dependencies**

**Frontend Dependencies**:

- No additional dependencies (removes markdownlint from frontend bundle)
- Uses existing React Bootstrap for UI components

**Backend Dependencies**:

**markdown-lint-service**:

- `markdownlint`: Core linting library (Node.js)
- `express`: HTTP server framework  
- `cors`: Cross-origin request support

**main backend**:

- No additional dependencies (uses existing FastAPI/SQLAlchemy stack)

## 🎯 **Implementation Phases**

### **✅ Phase 1: Backend Service Foundation**

**Status**: ✅ Design Complete
**Implementation Guide**: `.github/instructions/markdown-linting-phase-1-backend-service.md`

- **Objective**: Create simple Node.js Express server for markdown linting
- **Key Components**:
  - Express.js HTTP server with direct markdownlint library integration
  - Docker containerization with Node.js runtime  
  - `/lint` endpoint for text processing with rule configuration
  - `/rules/definitions` endpoint for available rules metadata
  - Hot reload support for development
- **Dependencies**: markdownlint, express, cors, Docker, nginx routing
- **Docker Integration**: New service on port 8002, volume mount for development
- **Architecture**: Eliminates FastAPI → subprocess → CLI complexity

### **✅ Phase 2: API-Based Frontend Service**

**Status**: ✅ Design Complete
**Implementation Guide**: `.github/instructions/markdown-linting-phase-2-api-frontend.md`

- **Objective**: Replace worker-based implementation with HTTP API client
- **Key Components**:
  - Updated MarkdownLintService with HTTP API communication
  - Chunked processing via backend API calls
  - Error handling and graceful degradation
  - Concurrent request management with semaphore pattern
- **Breaking Changes**: Remove worker pool, update service imports
- **Performance**: Maintain real-time editing experience with optimized API calls


### **🔄 Phase 3: Rules Configuration Service**

**Status**: Ready for Implementation
**Estimated Timeline**: Week 2

- **Objective**: Configurable rules per category/folder with UI
- **Frontend**: MarkdownLintRulesService, settings components
- **Backend**: Rule persistence endpoints, database schema
- **UI**: MarkdownLintTab with rule toggles and customization


### **🔄 Phase 4: Enhanced Editor Integration**
**Status**: Pending Phase 3
**Estimated Timeline**: Week 3

- **Objective**: Advanced Monaco integration with quick fixes
- **Components**: Enhanced marker adapter, action system
- **Features**: Quick fixes, rule suggestions, batch operations
- **UX**: Seamless editing experience with contextual help


### **🔄 Phase 5: Performance Optimization**
**Status**: Pending Core Implementation
**Estimated Timeline**: Week 4

- **Objective**: Optimize for large documents and real-time editing
- **Features**: Caching, debouncing, incremental processing
- **Monitoring**: Performance metrics and optimization


### **🔄 Phase 6: Advanced Features**
**Status**: Future Enhancement
**Estimated Timeline**: Week 5

- **Objective**: Advanced linting capabilities
- **Features**: Custom rules, templates, batch processing
- **Integration**: CI/CD, GitHub sync, export features


### **🔄 Phase 7: Documentation & Testing**
**Status**: Future Enhancement
**Estimated Timeline**: Week 6

- **Objective**: Comprehensive testing and documentation
- **Components**: Unit tests, integration tests, user guides
- **Quality**: Code coverage, performance benchmarks

## 🔧 **Key Success Metrics**

- **Performance**: Linting completes within 500ms for 10KB documents
- **Accuracy**: All 59 markdownlint rules properly detected
- **Usability**: Intuitive rule configuration interface
- **Integration**: Seamless coexistence with spell checker
- **Reliability**: No performance degradation or memory leaks

## 📚 **Reference Materials**

- **Existing Architecture**: `frontend/src/services/editor/` (spell checker patterns)
- **Markdownlint Rules**: [Official Rules Documentation](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)
- **Monaco Integration**: `frontend/src/hooks/useEditor.js`
- **Backend Patterns**: `backend/app/routers/` (API structure)

---

This system overview provides the foundation for implementing a comprehensive markdown linting solution that maintains consistency with existing architecture while providing powerful new functionality for document quality assurance.

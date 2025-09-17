---
applyTo: "**/*"
description: "System overview for Markdown Linting implementation - architectural patterns and integration points"
---

# Markdown Linting System Overview

## 🎯 **Project Goal**

Implement a comprehensive markdown linting system that mirrors the existing spell checker architecture, providing real-time markdown syntax validation with configurable rules per category/folder.

## 🏗️ **Architecture Overview**

### **Core Design Principles**

1. **Mirror Spell Checker Patterns**: Follow the proven architecture of SpellCheckService, SpellCheckWorkerPool, SpellCheckMarkers
2. **Modular Service Design**: Each component has single responsibility and clear interfaces
3. **Performance-First**: Worker pools for parallel processing, incremental checking
4. **Configurable Rules**: Per-category and per-folder rule customization
5. **Monaco Integration**: Native VS Code-like experience with markers and quick fixes

### **System Components**

```text
Frontend (React/Monaco)
├── Services Layer
│   ├── MarkdownLintService      # Core linting logic
│   ├── MarkdownLintWorkerPool   # Parallel processing
│   ├── MarkdownLintMarkers      # Monaco marker management
│   ├── MarkdownLintMarkerAdapter # Issue to marker conversion
│   ├── MarkdownLintActions      # Quick fixes and commands
│   └── MarkdownLintRulesService # Rule configuration
├── Workers
│   └── markdownLint.worker.js   # Background linting processing
├── UI Components
│   ├── MarkdownLintTab          # Settings interface
│   └── Toolbar integration      # Editor controls
└── Editor Integration
    ├── useEditor hook updates   # Linting lifecycle
    └── Monaco marker display    # Visual feedback

Backend (FastAPI/SQLAlchemy)
├── API Endpoints
│   ├── /markdown-lint/categories/{id}/rules
│   ├── /markdown-lint/folders/{path}/rules
│   └── /markdown-lint/global/rules
├── Database Schema
│   └── markdown_lint_rules table
└── CRUD Operations
    └── Rule persistence and retrieval
```

### **Technology Stack**

**Frontend**:
- **markdownlint library**: Core linting engine (same as VSCode extension)
- **Monaco Editor**: Marker display and quick fixes
- **Web Workers**: Background processing for performance
- **React Bootstrap**: UI components for settings

**Backend**:
- **FastAPI**: REST API endpoints for rule management
- **SQLAlchemy**: Async database operations
- **PostgreSQL**: Rule storage with JSONB configuration

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
2. **Chunking**: Text split into manageable chunks (2000 chars)
3. **Rule Resolution**: Get applicable rules for current category/folder
4. **Worker Processing**: Parallel linting via worker pool
5. **Marker Creation**: Convert issues to Monaco markers
6. **Display**: Show markers with tooltips and quick fixes

### **Rule Configuration Flow**
1. **UI**: User modifies rules in MarkdownLintTab
2. **API**: POST to /markdown-lint/categories/{id}/rules
3. **Storage**: Rules saved to database with JSONB config
4. **Cache**: Local storage cache for immediate use
5. **Application**: Rules applied to next linting cycle

### **Editor Integration Flow**
1. **Hook**: useEditor integrates linting lifecycle
2. **Triggers**: Content change, save, manual lint command
3. **Markers**: Display issues with severity styling
4. **Actions**: Quick fixes via Monaco code actions
5. **Toolbar**: Manual lint controls and status display

## 🎛️ **Configuration Hierarchy**

Rule precedence (highest to lowest):
1. **Folder-specific rules**: `/path/to/folder` configuration
2. **Category-specific rules**: Category-level configuration
3. **User defaults**: Personal rule preferences
4. **System defaults**: Built-in sensible defaults

## 🚀 **Performance Considerations**

- **Incremental Processing**: Only lint changed regions when possible
- **Worker Pools**: 2-4 workers based on hardware concurrency
- **Debounced Updates**: 1000ms delay to avoid excessive processing
- **Marker Reuse**: Preserve existing markers outside changed regions
- **Chunk Size**: 2000 character chunks for optimal worker utilization

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
│   ├── MarkdownLintService.js
│   ├── MarkdownLintWorkerPool.js
│   ├── MarkdownLintMarkers.js
│   ├── MarkdownLintMarkerAdapter.js
│   └── MarkdownLintActions.js
├── services/linting/
│   └── MarkdownLintRulesService.js
├── workers/
│   └── markdownLint.worker.js
├── components/linting/modals/
│   └── MarkdownLintTab.jsx
├── api/
│   └── markdownLintApi.js
└── hooks/
    └── useMarkdownLint.js (new)

backend/app/
├── routers/
│   └── markdown_lint.py
├── crud/
│   └── markdown_lint.py
├── models/
│   └── markdown_lint.py
└── schemas/
    └── markdown_lint.py
```

## 🔗 **Dependencies**

**New Frontend Dependencies**:
- `markdownlint`: Core linting library
- No additional UI dependencies (uses existing React Bootstrap)

**Backend Dependencies**:
- No additional dependencies (uses existing FastAPI/SQLAlchemy stack)

## 🎯 **Implementation Phases**

1. **Phase 1**: Core Service Architecture (Week 1)
2. **Phase 2**: Worker Implementation (Week 1)
3. **Phase 3**: Rules Configuration System (Week 2)
4. **Phase 4**: UserSettingsModal Integration (Week 3)
5. **Phase 5**: Editor Integration (Week 3)
6. **Phase 6**: Backend Implementation (Week 4)
7. **Phase 7**: Testing & Polish (Week 5)

## 🔧 **Key Success Metrics**

- **Performance**: Linting completes within 500ms for 10KB documents
- **Accuracy**: All 59 markdownlint rules properly detected
- **Usability**: Intuitive rule configuration interface
- **Integration**: Seamless coexistence with spell checker
- **Reliability**: No performance degradation or memory leaks

## 📚 **Reference Materials**

- **Existing Architecture**: `frontend/src/services/editor/` (spell checker patterns)
- **Markdownlint Rules**: https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md
- **Monaco Integration**: `frontend/src/hooks/useEditor.js`
- **Backend Patterns**: `backend/app/routers/` (API structure)

---

This system overview provides the foundation for implementing a comprehensive markdown linting solution that maintains consistency with existing architecture while providing powerful new functionality for document quality assurance.
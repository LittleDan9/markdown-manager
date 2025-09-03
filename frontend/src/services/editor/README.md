# Editor Services Refactoring

This document describes the refactoring of the monolithic `editorHelpers.js` file into focused, modular services.

## Overview

The original `editorHelpers.js` file had grown to over 400 lines and contained multiple functional areas that were difficult to maintain and test. It has been split into four focused services:

## New Service Modules

### 1. `SpellCheckMarkers.js`

**Purpose**: Managing spell check markers in Monaco editor

**Key Methods**:

- `clearMarkers(editor, suggestionsMap)` - Clear all spell check markers
- `getExistingMarkers(model)` - Get current spell check markers
- `filterMarkersOutsideRegion(markers, model, startOffset, endOffset)` - Filter markers by region
- `applyMarkers(model, markers)` - Apply markers to editor

### 2. `TextRegionAnalyzer.js`

**Purpose**: Analyzing text changes and determining regions for spell checking

**Key Methods**:

- `getChangedRegion(editor, prevValue, newValue, fullTextThreshold)` - Compute changed text regions
- `calculateRegionEndOffset(startOffset, issues)` - Calculate region boundaries
- `_expandRegionAroundCursor(editor, currentStart, currentEnd)` - Expand region around cursor

### 3. `MonacoMarkerAdapter.js`

**Purpose**: Converting spell check issues to Monaco markers

**Key Methods**:

- `toMonacoMarkers(editor, issues, startOffset, prevSuggestionsMap)` - Convert issues to markers
- `_createMarkersFromIssues(model, issues, startOffset, suggestionsMap)` - Create markers from issues
- `_preserveExistingSuggestions(existingMarkers, prevSuggestionsMap, newSuggestionsMap)` - Preserve suggestions

### 4. `SpellCheckActions.js`

**Purpose**: Managing quick fix actions and commands for spell check

**Key Methods**:

- `registerQuickFixActions(editor, suggestionsMapRef, getCategoryId, getFolderPath)` - Register quick fix actions
- `_registerCodeActionProvider(suggestionsMapRef, getCategoryId, getFolderPath)` - Register code actions
- `_registerGlobalCommands(getCategoryId, getFolderPath)` - Register Monaco commands

## Migration Guide

### For New Code

Import the specific services you need:

```javascript
import { 
  SpellCheckMarkers, 
  TextRegionAnalyzer, 
  MonacoMarkerAdapter, 
  SpellCheckActions 
} from '@/services/editor';

// Use the specific service methods
SpellCheckMarkers.clearMarkers(editor, suggestionsMap);
const region = TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue);
const suggestions = MonacoMarkerAdapter.toMonacoMarkers(editor, issues, startOffset);
const cleanup = SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef);
```

### For Existing Code

The original `editorHelpers.js` functions are still available for backward compatibility:

```javascript
import { 
  clearSpellCheckMarkers,
  getChangedRegion,
  toMonacoMarkers,
  registerQuickFixActions
} from '@/utils/editorHelpers';

// These still work but are deprecated
clearSpellCheckMarkers(editor, suggestionsMap);
const region = getChangedRegion(editor, prevValue, newValue);
// ... etc
```

### Deprecation Timeline

1. **Phase 1** (Current): New modular services available, legacy functions maintained
2. **Phase 2** (Next release): Update all existing code to use new services
3. **Phase 3** (Future release): Remove legacy compatibility layer

## Benefits of the Refactoring

### 1. **Single Responsibility Principle**

Each service has a clear, focused purpose:

- Marker management
- Text analysis
- Monaco integration
- User actions

### 2. **Improved Testability**

Smaller, focused modules are easier to:

- Unit test in isolation
- Mock for integration tests
- Debug and troubleshoot

### 3. **Better Maintainability**

- Clear separation of concerns
- Easier to locate specific functionality
- Reduced cognitive load when making changes

### 4. **Enhanced Reusability**

Services can be:

- Used independently
- Composed for different use cases
- Extended without affecting other functionality

### 5. **Better TypeScript Support** (Future)

Smaller modules will make it easier to:

- Add comprehensive type definitions
- Provide better IDE support
- Catch type errors early

## File Structure

```text
frontend/src/services/editor/
├── index.js                    # Export all services
├── SpellCheckMarkers.js        # Marker management
├── TextRegionAnalyzer.js       # Text change analysis
├── MonacoMarkerAdapter.js      # Monaco integration
├── SpellCheckActions.js        # Quick fix actions
├── SpellCheckService.js        # Core spell check logic
├── SpellCheckWorkerPool.js     # Worker management
├── EditorService.js            # Main editor service
├── CommentService.js           # Comment functionality
├── HighlightService.js         # Syntax highlighting
└── PerformanceOptimizer.js     # Performance utilities
```

## Testing Strategy

Each service should have:

1. **Unit tests** for public methods
2. **Integration tests** for Monaco interactions
3. **Performance tests** for text processing functions

## Future Improvements

1. **TypeScript Conversion**: Add comprehensive type definitions
2. **Service Composition**: Create higher-level services that compose these utilities
3. **Configuration**: Make services more configurable and extensible
4. **Plugin System**: Allow custom spell check behaviors
5. **Caching**: Implement better caching strategies for performance

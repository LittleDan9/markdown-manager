# Editor Services# Editor Services# Editor Services



This document describes the modular structure of editor services organized by domain.



## OverviewThis document describes the modular structure of editor services organized by domain.This document describes the modular structure of editor services organized by domain.



The editor services are organized into focused, domain-specific modules to improve maintainability, testability, and code organization.



## Service Structure## Overview## Overview



### Core Editor Services



Located in `/services/editor/`:The editor services are organized into focused, domain-specific modules to improve maintainability, testability, and code organization.The editor services are organized into focused, domain-specific modules to improve maintainability, testability, and code organization.



- **EditorService.js** - Core Monaco editor setup and configuration

- **CommentService.js** - Comment toggling and management

- **HighlightService.js** - Text highlighting functionality  ## Service Structure## Service Structure

- **PerformanceOptimizer.js** - Performance optimizations for large files



### Spell Check Domain (`/spellCheck/`)

### Core Editor Services### Core Editor Services

Dedicated subfolder for all spell checking functionality:



- **SpellCheckService.js** - Main spell checking service

- **SpellCheckMarkers.js** - Marker management for spell checkLocated in `/services/editor/`:Located in `/services/editor/`:

- **SpellCheckActions.js** - Quick fix actions and commands

- **SpellCheckWorkerPool.js** - Worker pool for performance

- **TextRegionAnalyzer.js** - Text change analysis for performance optimization

- **EditorService.js** - Core Monaco editor setup and configuration- **EditorService.js** - Core Monaco editor setup and configuration

### Markdown Lint Domain (`/markdownLint/`)

- **CommentService.js** - Comment toggling and management- **CommentService.js** - Comment toggling and management

Dedicated subfolder for markdown linting functionality:

- **HighlightService.js** - Text highlighting functionality  - **HighlightService.js** - Text highlighting functionality

- **MarkdownLintService.js** - Main markdown linting service

- **MarkdownLintMarkers.js** - Marker management for markdown lint- **PerformanceOptimizer.js** - Performance optimizations for large files- **PerformanceOptimizer.js** - Performance optimizations for large files

- **MarkdownLintMarkerAdapter.js** - Issue-to-marker conversion utilities

- **MarkdownLintActions.js** - Quick fix actions and commands



### Shared Utilities### Spell Check Domain (`/spellCheck/`)### Spell Check Domain (`/spellCheck/`)



Common utilities used across domains:



- **MonacoMarkerAdapter.js** - Generic Monaco marker utilitiesDedicated subfolder for all spell checking functionality:Dedicated subfolder for all spell checking functionality:

- **MarkdownParser.js** - Markdown parsing utilities



## Usage Examples

- **SpellCheckService.js** - Main spell checking service- **SpellCheckService.js** - Main spell checking service

### Importing Services

- **SpellCheckMarkers.js** - Marker management for spell check- **SpellCheckMarkers.js** - Marker management for spell check

```javascript

// Import specific services from main barrel- **SpellCheckActions.js** - Quick fix actions and commands- **SpellCheckActions.js** - Quick fix actions and commands

import {

  EditorService,- **SpellCheckWorkerPool.js** - Worker pool for performance- **SpellCheckWorkerPool.js** - Worker pool for performance

  SpellCheckService,

  MarkdownLintService,

  TextRegionAnalyzer

} from '@/services/editor';### Markdown Lint Domain (`/markdownLint/`)### Markdown Lint Domain (`/markdownLint/`)



// Or import from specific domains

import { SpellCheckActions } from '@/services/editor';

import { MarkdownLintMarkerAdapter } from '@/services/editor';Dedicated subfolder for markdown linting functionality:Dedicated subfolder for markdown linting functionality:

```



### Basic Usage

- **MarkdownLintService.js** - Main markdown linting service- **MarkdownLintService.js** - Main markdown linting service

```javascript

// Initialize services- **MarkdownLintMarkers.js** - Marker management for markdown lint- **MarkdownLintMarkers.js** - Marker management for markdown lint

await SpellCheckService.init();

await MarkdownLintService.init();- **MarkdownLintMarkerAdapter.js** - Issue-to-marker conversion utilities- **MarkdownLintMarkerAdapter.js** - Issue-to-marker conversion utilities



// Analyze text regions for spell checking- **MarkdownLintActions.js** - Quick fix actions and commands- **MarkdownLintActions.js** - Quick fix actions and commands

const region = TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue);



// Register editor actions

SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef);### Shared Utilities### Shared Utilities

MarkdownLintActions.registerQuickFixActions(editor, markersMapRef);

```



## File StructureCommon utilities used across domains:Common utilities used across domains:



```text

frontend/src/services/editor/

├── index.js                    # Main barrel export- **TextRegionAnalyzer.js** - Text change analysis and region detection- **TextRegionAnalyzer.js** - Text change analysis and region detection

├── EditorService.js            # Core editor functionality

├── CommentService.js           # Comment management- **MonacoMarkerAdapter.js** - Generic Monaco marker utilities- **MonacoMarkerAdapter.js** - Generic Monaco marker utilities

├── HighlightService.js         # Text highlighting

├── PerformanceOptimizer.js     # Performance utilities- **MarkdownParser.js** - Markdown parsing utilities- **MarkdownParser.js** - Markdown parsing utilities

├── MonacoMarkerAdapter.js      # Monaco marker utilities

├── MarkdownParser.js           # Markdown parsing

├── spellCheck/                 # Spell check domain

│   ├── index.js               # Spell check barrel## Usage Examples## Migration Guide

│   ├── SpellCheckService.js   # Main service

│   ├── SpellCheckMarkers.js   # Marker management

│   ├── SpellCheckActions.js   # Quick fix actions

│   ├── SpellCheckWorkerPool.js # Worker pool### Importing Services### For New Code

│   └── TextRegionAnalyzer.js  # Text analysis

└── markdownLint/              # Markdown lint domain

    ├── index.js               # Markdown lint barrel

    ├── MarkdownLintService.js # Main service```javascript# Editor Services

    ├── MarkdownLintMarkers.js # Marker management

    ├── MarkdownLintMarkerAdapter.js # Issue conversion// Import specific services from main barrel

    └── MarkdownLintActions.js # Quick fix actions

```import { This document describes the modular structure of editor services organized by domain.



## Benefits  EditorService,



### Domain Organization  SpellCheckService,## Overview



Services are grouped by functionality (spell check, markdown lint) making the codebase more navigable.  MarkdownLintService,



### Single Responsibility  TextRegionAnalyzerThe editor services are organized into focused, domain-specific modules to improve maintainability, testability, and code organization.



Each service has a clear, focused purpose with well-defined boundaries.} from '@/services/editor';



### Better Testability## Service Structure



Smaller, focused modules are easier to unit test and mock for integration tests.// Or import from specific domains



### Improved Maintainabilityimport { SpellCheckActions } from '@/services/editor';### Core Editor Services



Clear separation of concerns reduces cognitive load and makes changes easier to implement.import { MarkdownLintMarkerAdapter } from '@/services/editor';



### Enhanced Reusability```Located in `/services/editor/`:



Services can be used independently or composed for different use cases.



## Testing Strategy### Basic Usage- **EditorService.js** - Core Monaco editor setup and configuration



Each service should have:- **CommentService.js** - Comment toggling and management



1. **Unit tests** for public methods```javascript- **HighlightService.js** - Text highlighting functionality

2. **Integration tests** for Monaco editor interactions

3. **Performance tests** for text processing functions// Initialize services- **PerformanceOptimizer.js** - Performance optimizations for large files

4. **Mock implementations** in `__mocks__` directory

await SpellCheckService.init();

## Development Guidelines

await MarkdownLintService.init();### Spell Check Domain (`/spellCheck/`)

1. **Keep services focused** - Each service should have a single responsibility

2. **Use barrel exports** - Export services through domain-specific index files

3. **Maintain compatibility** - Ensure existing imports continue to work

4. **Document changes** - Update this README when adding new services// Analyze text regionsDedicated subfolder for all spell checking functionality:

5. **Test thoroughly** - Add tests for new functionality
const region = TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue);

- **SpellCheckService.js** - Main spell checking service

// Register editor actions- **SpellCheckMarkers.js** - Marker management for spell check

SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef);- **SpellCheckActions.js** - Quick fix actions and commands

MarkdownLintActions.registerQuickFixActions(editor, markersMapRef);- **SpellCheckWorkerPool.js** - Worker pool for performance

```

### Markdown Lint Domain (`/markdownLint/`)

## File Structure

Dedicated subfolder for markdown linting functionality:

```text

frontend/src/services/editor/- **MarkdownLintService.js** - Main markdown linting service

├── index.js                    # Main barrel export- **MarkdownLintMarkers.js** - Marker management for markdown lint

├── EditorService.js            # Core editor functionality- **MarkdownLintMarkerAdapter.js** - Issue-to-marker conversion utilities

├── CommentService.js           # Comment management- **MarkdownLintActions.js** - Quick fix actions and commands

├── HighlightService.js         # Text highlighting

├── PerformanceOptimizer.js     # Performance utilities### Shared Utilities

├── TextRegionAnalyzer.js       # Text analysis utilities

├── MonacoMarkerAdapter.js      # Monaco marker utilitiesCommon utilities used across domains:

├── MarkdownParser.js           # Markdown parsing

├── spellCheck/                 # Spell check domain- **TextRegionAnalyzer.js** - Text change analysis and region detection

│   ├── index.js               # Spell check barrel- **MonacoMarkerAdapter.js** - Generic Monaco marker utilities

│   ├── SpellCheckService.js   # Main service- **MarkdownParser.js** - Markdown parsing utilities

│   ├── SpellCheckMarkers.js   # Marker management

│   ├── SpellCheckActions.js   # Quick fix actions## Usage Examples

│   └── SpellCheckWorkerPool.js # Worker pool

└── markdownLint/              # Markdown lint domain### Importing Services

    ├── index.js               # Markdown lint barrel

    ├── MarkdownLintService.js # Main service```javascript

    ├── MarkdownLintMarkers.js # Marker management// Import specific services from main barrel

    ├── MarkdownLintMarkerAdapter.js # Issue conversionimport {

    └── MarkdownLintActions.js # Quick fix actions  EditorService,

```  SpellCheckService,

  MarkdownLintService,

## Benefits  TextRegionAnalyzer

} from '@/services/editor';

### Domain Organization

// Or import from specific domains

Services are grouped by functionality (spell check, markdown lint) making the codebase more navigable.import { SpellCheckActions } from '@/services/editor';

import { MarkdownLintMarkerAdapter } from '@/services/editor';

### Single Responsibility```



Each service has a clear, focused purpose with well-defined boundaries.### Basic Usage



### Better Testability```javascript

// Initialize services

Smaller, focused modules are easier to unit test and mock for integration tests.await SpellCheckService.init();

await MarkdownLintService.init();

### Improved Maintainability

// Analyze text regions

Clear separation of concerns reduces cognitive load and makes changes easier to implement.const region = TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue);



### Enhanced Reusability// Register editor actions

SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef);

Services can be used independently or composed for different use cases.MarkdownLintActions.registerQuickFixActions(editor, markersMapRef);

```

## Testing Strategy

## File Structure

Each service should have:

```text

1. **Unit tests** for public methodsfrontend/src/services/editor/

2. **Integration tests** for Monaco editor interactions  ├── index.js                    # Main barrel export

3. **Performance tests** for text processing functions├── EditorService.js            # Core editor functionality

4. **Mock implementations** in `__mocks__` directory├── CommentService.js           # Comment management

├── HighlightService.js         # Text highlighting

## Development Guidelines├── PerformanceOptimizer.js     # Performance utilities

├── TextRegionAnalyzer.js       # Text analysis utilities

1. **Keep services focused** - Each service should have a single responsibility├── MonacoMarkerAdapter.js      # Monaco marker utilities

2. **Use barrel exports** - Export services through domain-specific index files├── MarkdownParser.js           # Markdown parsing

3. **Maintain compatibility** - Ensure existing imports continue to work├── spellCheck/                 # Spell check domain

4. **Document changes** - Update this README when adding new services│   ├── index.js               # Spell check barrel

5. **Test thoroughly** - Add tests for new functionality│   ├── SpellCheckService.js   # Main service
│   ├── SpellCheckMarkers.js   # Marker management
│   ├── SpellCheckActions.js   # Quick fix actions
│   └── SpellCheckWorkerPool.js # Worker pool
└── markdownLint/              # Markdown lint domain
    ├── index.js               # Markdown lint barrel
    ├── MarkdownLintService.js # Main service
    ├── MarkdownLintMarkers.js # Marker management
    ├── MarkdownLintMarkerAdapter.js # Issue conversion
    └── MarkdownLintActions.js # Quick fix actions
```

## Benefits

### 1. **Domain Organization**
Services are grouped by functionality (spell check, markdown lint) making the codebase more navigable.

### 2. **Single Responsibility**
Each service has a clear, focused purpose with well-defined boundaries.

### 3. **Better Testability**
Smaller, focused modules are easier to unit test and mock for integration tests.

### 4. **Improved Maintainability**
Clear separation of concerns reduces cognitive load and makes changes easier to implement.

### 5. **Enhanced Reusability**
Services can be used independently or composed for different use cases.

## Testing Strategy

Each service should have:

1. **Unit tests** for public methods
2. **Integration tests** for Monaco editor interactions
3. **Performance tests** for text processing functions
4. **Mock implementations** in `__mocks__` directory

## Development Guidelines

1. **Keep services focused** - Each service should have a single responsibility
2. **Use barrel exports** - Export services through domain-specific index files
3. **Maintain compatibility** - Ensure existing imports continue to work
4. **Document changes** - Update this README when adding new services
5. **Test thoroughly** - Add tests for new functionality

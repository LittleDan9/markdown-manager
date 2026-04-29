# Mermaid Service Architecture

The Mermaid service uses a modular architecture with a **shared singleton instance** to ensure all consumers (MarkdownRenderer, Renderer.jsx, documentsApi) share one cache, one theme state, and one `mermaid.initialize()` call.

## Architecture Overview

### Singleton Pattern

All access to MermaidRenderer goes through `singleton.js`:

```javascript
// singleton.js — the ONE instance
import MermaidRenderer from './MermaidRenderer.js';
export default new MermaidRenderer();
```

**Never create `new MermaidRenderer()` directly.** Use one of:

- `useMermaid` hook (React components)
- `import mermaidSingleton from './singleton.js'` (non-React code)
- `import { Mermaid } from '@/services/rendering'` (barrel export)

### Core Services

#### `MermaidRenderer`

- **Purpose**: Main orchestrator for Mermaid diagram rendering
- **Responsibilities**: Coordinates all other services to render diagrams
- **Usage**: Primary entry point for diagram rendering operations

#### `MermaidCache`

- **Purpose**: Manages caching of rendered diagrams
- **Responsibilities**: Store, retrieve, and manage cached SVG content
- **Benefits**: Improves performance by avoiding re-rendering of identical diagrams

#### `MermaidThemeManager`

- **Purpose**: Handles theme configuration and updates
- **Responsibilities**: Theme switching, configuration management
- **Features**: Automatic cache clearing on theme changes, `architecture.randomize: true` by default

#### `MermaidValidator`

- **Purpose**: Validation and error handling
- **Responsibilities**: Source validation, error detection, error display
- **Features**: SVG content analysis, error message formatting

#### `MermaidIconLoader`

- **Purpose**: Icon management and loading
- **Responsibilities**: Extract icon references, load icons, register with Mermaid
- **Features**: Bulk icon loading, pack-based organization

### React Integration

#### `useMermaid` Hook

- **Purpose**: React hook for easy component integration
- **Returns**: Stateful interface with loading states and methods
- **Implementation**: Delegates to the shared singleton — does NOT create its own instance

```javascript
import { useMermaid } from '@/services/rendering';

function DiagramComponent() {
  const {
    renderDiagrams,
    updateTheme,
    isLoading,
    currentTheme
  } = useMermaid('light');

  // Renders via the shared singleton — cache is shared with MarkdownRenderer
}
```

## Migration Guide

### For Existing Code

The original `MermaidService` remains available as a compatibility layer:

```javascript
// This still works (legacy)
import { MermaidService } from '@/services/rendering';
await MermaidService.render(htmlContent, theme);
```

### For New Code

Use the singleton or React hook:

```javascript
// Option 1: Use the React hook (recommended for components)
import { useMermaid } from '@/services/rendering';
const { renderDiagrams } = useMermaid();

// Option 2: Import the singleton directly (for non-React code)
import mermaidSingleton from '@/services/rendering/mermaid/singleton.js';
await mermaidSingleton.render(htmlContent, theme);
mermaidSingleton.cache.delete(diagramSource); // bust cache for refresh
```

### For Advanced Use Cases

Access individual services via the singleton:

```javascript
import mermaidSingleton from '@/services/rendering/mermaid/singleton.js';

// Access sub-services on the shared instance
mermaidSingleton.cache.has(diagramSource);
mermaidSingleton.cache.delete(diagramSource);
mermaidSingleton.clearCache(); // clear all
```

## Benefits of the New Architecture

1. **Single Responsibility**: Each service has one clear purpose
2. **Testability**: Individual services can be tested in isolation
3. **Maintainability**: Smaller, focused modules are easier to maintain
4. **Reusability**: Services can be used independently
5. **React Idioms**: Follows React patterns with hooks and functional design
6. **Performance**: Better caching and icon loading strategies
7. **Backward Compatibility**: Existing code continues to work

## File Structure

```text
frontend/src/services/rendering/
├── mermaid/
│   ├── MermaidRenderer.js      # Main orchestrator (class)
│   ├── singleton.js            # Shared singleton instance (import this, not the class)
│   ├── MermaidCache.js         # Caching service
│   ├── MermaidThemeManager.js  # Theme management (architecture.randomize: true)
│   ├── MermaidValidator.js     # Validation & errors
│   ├── MermaidIconLoader.js    # Icon management
│   ├── useMermaid.js          # React hook (delegates to singleton)
│   └── index.js               # Barrel exports (re-exports singleton as default)
├── MermaidService.js          # Legacy compatibility layer
└── index.js                   # Main exports
```

## Best Practices

1. **Never create `new MermaidRenderer()`** — always use the singleton or `useMermaid` hook
2. **Use the React hook** for component-based rendering
3. **Import singleton directly** for non-React code (e.g., documentsApi)
4. **Use `cache.delete(source)`** to bust cache for a single diagram (refresh button pattern)
5. **Leverage shared caching** — MarkdownRenderer, Renderer.jsx, and documentsApi all read/write the same cache
6. **Architecture diagrams** use `randomize: true` by default — use the refresh button to re-roll layout

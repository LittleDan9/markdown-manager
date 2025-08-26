# Mermaid Service Architecture

The Mermaid service has been refactored into a modular architecture following React idioms and single responsibility principles.

## Architecture Overview

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
- **Features**: Automatic cache clearing on theme changes

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
- **Benefits**: Clean React patterns, automatic state management

```javascript
import { useMermaid } from '@/services/rendering';

function DiagramComponent() {
  const {
    renderDiagrams,
    updateTheme,
    isLoading,
    currentTheme
  } = useMermaid('light');

  // Use the hook methods...
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

Use the modular services or React hook:

```javascript
// Option 1: Use the main renderer directly
import { MermaidRenderer } from '@/services/rendering';
const renderer = new MermaidRenderer();
await renderer.render(htmlContent, theme);

// Option 2: Use the React hook (recommended for components)
import { useMermaid } from '@/services/rendering';
const { renderDiagrams } = useMermaid();
```

### For Advanced Use Cases

Access individual services:

```javascript
import {
  MermaidCache,
  MermaidValidator,
  MermaidIconLoader
} from '@/services/rendering';

// Use specific services as needed
const cache = new MermaidCache();
const validator = new MermaidValidator();
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
│   ├── MermaidRenderer.js      # Main orchestrator
│   ├── MermaidCache.js         # Caching service
│   ├── MermaidThemeManager.js  # Theme management
│   ├── MermaidValidator.js     # Validation & errors
│   ├── MermaidIconLoader.js    # Icon management
│   ├── useMermaid.js          # React hook
│   └── index.js               # Module exports
├── MermaidService.js          # Legacy compatibility layer
└── index.js                   # Main exports
```

## Best Practices

1. **Use the React hook** for component-based rendering
2. **Use MermaidRenderer directly** for service-based rendering
3. **Keep the legacy service** for gradual migration
4. **Test individual services** for better coverage
5. **Leverage caching** for performance optimization

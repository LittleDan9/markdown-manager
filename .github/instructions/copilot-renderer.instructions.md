---
description: "Use when working on the markdown preview renderer, Mermaid diagram rendering, syntax highlighting pipeline, morphdom DOM updates, or rendering orchestrator."
applyTo: "services/ui/src/components/renderer/**,services/ui/src/hooks/renderer/**,services/ui/src/services/rendering/**"
---
# Renderer Component Instructions - Markdown Manager

## Renderer Overview

The Renderer is the preview component that transforms markdown content into HTML with advanced features including Mermaid diagram support and syntax highlighting. It's the visual counterpart to the Editor and a core component defining the application's purpose.

## Core Architecture

### Main Renderer Component (`Renderer.jsx`)
Primary rendering pipeline:
```
Markdown Content → HTML Conversion → Syntax Highlighting → Mermaid Diagrams → Final Display
```

Component composition:
```jsx
<div id="previewContainer">
  <div id="preview">
    <div className="preview-scroll" dangerouslySetInnerHTML={{ __html: previewHTML }} />
    {showLoadingOverlay && <LoadingOverlay />}
  </div>
</div>
```

### Rendering Pipeline
1. **Markdown-to-HTML**: Uses `MarkdownRenderer` service to convert markdown
2. **Syntax Highlighting**: `HighlightService` processes code blocks with Prism.js
3. **Mermaid Integration**: `useMermaid` hook handles diagram rendering
4. **Icon Loading**: On-demand icon loading for Mermaid architecture diagrams
5. **Diagram Controls**: `DiagramControls` overlays added via ReactDOM portals
6. **Image Caching**: `ImageCacheService` optimizes authenticated image loading

### Rendering Orchestrator (`useRenderingOrchestrator`)
Coordinates the full rendering pipeline:
- Manages render scheduling and debouncing
- Coordinates syntax highlighting with Mermaid processing
- Handles loading states across all rendering phases
- Prevents render cascades from content + theme changes

## Mermaid Integration (architecture-beta)

### Modern useMermaid Hook
```javascript
const { renderDiagrams, updateTheme, currentTheme } = useMermaid(theme);

// Automatic theme synchronization
useEffect(() => {
  if (theme !== mermaidTheme) {
    updateTheme(theme);
  }
}, [theme, mermaidTheme, updateTheme]);

// Diagram rendering with icon support
const updatedHtml = await renderDiagrams(html, theme);
```

### Mermaid Service Architecture
Modular services for diagram rendering, all sharing a **single singleton instance** (`singleton.js`):

- **MermaidRenderer**: Main orchestrator for diagram rendering (singleton via `singleton.js`)
- **MermaidCache**: Caching of rendered diagrams for performance (shared across all consumers)
- **MermaidThemeManager**: Theme configuration and updates (includes `architecture.randomize: true`)
- **MermaidValidator**: Validation and error handling
- **MermaidIconLoader**: On-demand icon loading and registration

**CRITICAL**: Never create `new MermaidRenderer()` directly. Always import the singleton:
```javascript
// For React components — use the hook (delegates to singleton internally)
import { useMermaid } from '@/services/rendering/mermaid/useMermaid';
const { renderDiagrams } = useMermaid(theme);

// For non-React code — import the singleton directly
import mermaidSingleton from '@/services/rendering/mermaid/singleton.js';
mermaidSingleton.cache.has(diagramSource);
```

The singleton ensures MarkdownRenderer (fence rule cache reads), Renderer.jsx (diagram rendering), and documentsApi (GitHub save cache reads) all share one cache and one `mermaid.initialize()` call.

### Icon Integration System
Critical feature for architecture diagrams:
```javascript
// Icon loading pattern
const icons = await MermaidIconLoader.loadIcons(iconReferences, packName);
await MermaidIconLoader.registerIcons(icons);

// Architecture diagram with icons
service myec2(awssvg:ec2)[My EC2 Instance]
group myvpc(awsgrp:vpc)[My VPC Group]
service mylogo(logos:aws)[AWS Logo]
```

### Supported Icon Packs
On-demand loading from multiple sources:
- **awssvg**: AWS service icons
- **awsgrp**: AWS group/container icons
- **logos**: Technology logos
- **devicon**: Development tool icons
- **flat-color-icons**: Flat design icons

## Syntax Highlighting System

### HighlightService Integration
```javascript
// Code block processing
const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
const blocksToHighlight = [];

// Efficient highlighting with caching
HighlightService.highlightBlocks(blocksToHighlight).then(results => {
  // Apply highlighted code to blocks
  setHighlightedBlocks(prev => ({ ...prev, ...newHighlights }));
});
```

### Performance Optimizations
- **Incremental highlighting**: Only highlight new/changed code blocks
- **Caching strategy**: Store highlighted results to avoid re-processing
- **Placeholder system**: Use data attributes to track highlight state
- **Background processing**: Syntax highlighting doesn't block rendering

## Theme Integration

### Automatic Theme Propagation
```javascript
// Theme updates cascade through all systems
useEffect(() => {
  if (theme !== mermaidTheme) {
    updateTheme(theme);  // Updates Mermaid diagrams
  }
}, [theme, mermaidTheme, updateTheme]);
```

### Supported Themes
- Light/dark mode switching
- Mermaid diagram theme synchronization
- Syntax highlighting theme updates
- Bootstrap theme integration

## Content Processing Flow

### Markdown Rendering
```javascript
// Primary content transformation
let htmlString = render(content);  // markdown-it based rendering

// Code block preprocessing
const tempDiv = document.createElement("div");
tempDiv.innerHTML = htmlString;
const codeBlocks = Array.from(tempDiv.querySelectorAll("[data-syntax-placeholder]"));
```

### Mermaid Processing
```javascript
// Diagram detection and rendering
if (html.includes("data-mermaid-source")) {
  const updatedHtml = await renderDiagrams(html, theme);
  setPreviewHTML(updatedHtml);
}
```

### Icon Loading Pipeline
1. **Detection**: Scan Mermaid diagrams for icon references
2. **Resolution**: Map icon names to pack sources
3. **Loading**: Fetch icon data from backend API
4. **Registration**: Register icons with Mermaid for diagram use
5. **Rendering**: Generate final diagram with embedded icons

## Scroll Synchronization

### Editor-Preview Sync
```javascript
// Scroll to specific line in preview
useEffect(() => {
  if (scrollToLine && previewScrollRef.current) {
    const el = previewScrollRef.current.querySelector(`[data-line='${scrollToLine}']`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}, [scrollToLine, previewHTML]);
```

### Line Mapping
- Data attributes track source line numbers
- Smooth scrolling behavior
- Center alignment for optimal viewing

## Performance Considerations

### Rendering Optimization
- **State management**: Separate rendering state from display state
- **Effect batching**: Group related updates to avoid cascading renders
- **Loading states**: Show progress during long rendering operations
- **Memory management**: Clean up resources and cancel pending operations

### Caching Strategy
```javascript
// Multi-level caching approach (all via shared singleton)
- Syntax highlighting cache (by language + code hash)
- Mermaid diagram cache (by source + theme) — shared singleton.js instance
- Icon cache (by pack + icon name)
```

### Diagram Controls
Overlay controls on rendered Mermaid diagrams (via `DiagramControls.jsx`):
- **Refresh**: Re-render diagram (busts cache, re-randomizes architecture layout)
- **Fullscreen**: View diagram in modal
- **Export**: SVG, PNG, Draw.io XML/PNG download
- **GitHub indicator**: Shows when diagram needs conversion for GitHub

## Error Handling

### Graceful Degradation
- **Mermaid errors**: Show error message instead of crashing
- **Icon loading failures**: Continue without icons
- **Syntax highlighting failures**: Fall back to plain code
- **Network errors**: Retry with exponential backoff

### User Feedback
```javascript
// Loading states and error messages
{showLoadingOverlay && (
  <LoadingOverlay message={loadingMessage || "Loading..."} />
)}
```

## Diagram Controls & Export

### DiagramControls Component
Hover overlay for individual Mermaid diagrams, rendered via ReactDOM portals:
```javascript
// Dynamic attachment after diagram rendering
addDiagramControls(containerEl); // Scans for .mermaid elements, attaches portals
```
- **Fullscreen button**: Opens `DiagramFullscreenModal` for enhanced viewing
- **Export dropdown**: SVG/PNG export via export service
- **GitHub indicators**: Warns about advanced diagrams needing conversion
- **Portal rendering**: Wraps in ThemeProvider + NotificationProvider for context access

### DiagramFullscreenModal
Modal-based fullscreen diagram viewing with integrated export controls and dark mode support.

### MermaidExportService
Server-side diagram export using the export microservice:
```javascript
MermaidExportService.exportAsSVG(mermaidSource, options);  // Chromium-rendered SVG
MermaidExportService.exportAsPNG(mermaidSource, options);  // Rasterized PNG
MermaidExportService.needsGitHubConversion(source);        // Advanced feature detection
```

### Diagram Controls Styling
```scss
// _diagram-controls.scss
.diagram-controls { /* Hover-based opacity transitions */ }
.diagram-fullscreen-modal { /* Responsive fullscreen layout */ }
```

## Icon Browser Integration

### On-Demand Icon Discovery
The renderer integrates with the Icon Browser component for icon selection:

- **IconBrowser.jsx**: Main icon browsing interface
- **Server-side search**: Paginated icon search with filters
- **Usage examples**: Generate proper Mermaid syntax
- **Copy functionality**: Direct integration with editor

### Icon Pack Management
```javascript
// Icon pack structure for on-demand loading
{
  name: "awssvg",
  display_name: "AWS Services",
  category: "cloud",
  icon_count: 200+
}
```

## Development Patterns

### Adding New Diagram Types
1. Extend MermaidRenderer for new diagram support
2. Add icon loading logic if needed
3. Update theme configuration
4. Test with various icon combinations

### Icon Pack Integration
1. Add pack configuration to backend
2. Update IconService for new pack support
3. Test icon loading in architecture diagrams
4. Verify theme compatibility

### Performance Optimization
1. Profile rendering pipeline with large documents
2. Optimize caching strategies
3. Minimize DOM manipulations
4. Use React profiling tools

## CSS Classes and Styling

### Renderer Layout
```scss
#previewContainer { /* Main preview container */ }
#preview { /* Preview content area */ }
.preview-scroll { /* Scrollable content */ }
.fullscreen-preview { /* Fullscreen mode */ }
```

### Mermaid Diagrams
```scss
.mermaid { /* Mermaid diagram container */ }
.mermaid svg { /* SVG diagram styling */ }
.mermaid-error { /* Error state styling */ }
```

## Integration Points

### Document Context
- **Content synchronization**: Reactive to content changes
- **Highlighted blocks**: Shared syntax highlighting cache
- **Preview HTML**: Final rendered output state

### Theme Provider
- **Automatic updates**: Theme changes propagate immediately
- **Mermaid synchronization**: Diagrams update with theme
- **Syntax highlighting**: Code themes match application theme

### Editor Coordination
- **Scroll sync**: Preview follows editor cursor
- **Live updates**: Real-time rendering as user types
- **Performance balance**: Debounced updates to avoid lag
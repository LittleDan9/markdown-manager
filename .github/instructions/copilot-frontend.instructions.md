# Frontend Instructions - Markdown Manager

## Architecture
React SPA with provider-component-hook pattern:
- `src/providers/`: Context providers (Auth, Documents, Logger, Theme, Notifications)
- `src/components/`: UI components by domain (auth, document, editor, icons, layout, sections)
- `src/hooks/`: Custom hooks organized by concern, barrel exports via `@/hooks`
- `src/services/`: Business logic and API integrations
- `src/api/`: HTTP clients extending base `Api` class

## Development Environment
CRITICAL: Use Docker only, never npm directly
```bash
docker compose up frontend  # Runs on http://localhost/ (NOT :3000)
docker compose logs frontend  # Check for HMR heap issues
docker compose restart frontend  # Restart if AI agents cause memory overflow
```

## Component Patterns
Keep components ≤300 lines. Example structure:
function ComponentName({ prop1, prop2 }) {
  const { state } = useCustomHook();
  return <div className="component-class">...</div>;
}
ComponentName.propTypes = { prop1: PropTypes.string.isRequired };
```

Provider hierarchy: LoggerProvider → ErrorBoundary → ThemeProvider → NotificationProvider → AuthProvider → DocumentContextProvider

Hook imports: `import { useDocumentState, useEditor } from '@/hooks';`

## Styling
- SCSS only in `src/styles/` (never inline styles)
- Bootstrap 5.3 + React Bootstrap first
- Bootstrap Icons for iconography
- Variables in `_variables.scss`

## File Organization
- `components/auth/` - Authentication UI
- `components/document/` - Document management
- `components/editor/` - Monaco editor integration
- `components/icons/` - Icon browser
- `components/layout/` - Layout containers
- `components/sections/` - EditorSection, RendererSection

## API Pattern
```javascript
export class DocumentsApi extends Api {
  async getDocument(id) {
    const response = await this.apiCall(`/documents/${id}`);
    return response.data;
  }
}
```

## Performance
- Development: Memory cache, minimal splitting for fast HMR
- Production: Filesystem cache, chunk splitting (critical-vendors, monaco-editor, mermaid-libs, icon-packs)
- esbuild-loader for transpilation

## Workflows
```bash
docker compose up frontend  # Development with HMR
npm run build              # Production build
npm run build:analyze      # Debug webpack bundle
```

## Core Components

### Editor (See `.github/copilot-editor-instructions.md`)
Primary markdown editing interface with:
- Monaco Editor integration with syntax highlighting
- Real-time spell check system with custom dictionaries
- Markdown toolbar with formatting actions
- GitHub integration status bar
- Keyboard shortcuts and auto-save

### Renderer (See `.github/copilot-renderer-instructions.md`)
Preview component for markdown with:
- Mermaid diagram support (architecture-beta)
- On-demand icon loading for diagrams
- Syntax highlighting with Prism.js
- Theme synchronization
- Scroll synchronization with editor

## Code Conventions
- Direct imports only (no dynamic imports)
- PropTypes validation required
- Bootstrap components first
- SCSS files for all styling
- Functional components with hooks
- Absolute imports via `@/` alias

## Common Issues
1. HMR memory overflow from AI agents - restart container
2. Use http://localhost/ not :3000 - nginx routing
3. Never inline styles - use SCSS
4. Refactor components >300 lines
5. Use direct imports - webpack handles optimization
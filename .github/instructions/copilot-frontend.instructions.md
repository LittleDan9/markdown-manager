---
description: "Use when working on the React frontend: components, providers, hooks, services, API clients, styles, webpack, or general UI architecture."
applyTo: "services/ui/**/*"
---
# Frontend Instructions - Markdown Manager

## Architecture
React SPA with provider-component-hook pattern:
- `src/providers/`: Context providers (AppProviders, Auth, Documents, GitHubSettings, Logger, Theme, UserSettings)
- `src/components/`: UI components by domain (admin, auth, chat, dictionary, document, editor, file, git, github, icons, image, images, layout, linting, renderer, sections, security, settings, shared, storage, system, toolbar, ui, user)
- `src/hooks/`: Custom hooks organized by concern, barrel exports via `@/hooks` (dictionary, document, editor, fileBrowser, github, icons, image, markdown, performance, renderer, ui)
- `src/services/`: Business logic (core, dictionary, editor, features, fileBrowser, icons, image, rendering, ui, utilities)
- `src/api/`: HTTP clients extending base `Api` class (apiKeysApi, categoriesApi, customDictionaryApi, documentsApi, exportServiceApi, gitHubApi, gitHubRepositorySelectionApi, githubSettingsApi, highlightingApi, iconsApi, imageApi, lintingApi, searchApi, spellCheckApi, systemHealthApi, userApi, admin/*)

## Development Environment
CRITICAL: Use Docker only, never npm directly
```bash
docker compose up frontend  # Runs on http://localhost/ (NOT :3000)
docker compose logs frontend  # Check for HMR heap issues
docker compose restart frontend  # Restart if AI agents cause memory overflow
```

## Test Account (dev only)
Use this account to get a fresh JWT for API testing:
- **Email:** `copilot@markdown-test.com`
- **Password:** `CopilotTest123!`

```bash
# Get a fresh token (valid ~30 min)
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"copilot@markdown-test.com","password":"CopilotTest123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token: $TOKEN"
```

## Component Patterns
Keep components ≤300 lines. Example structure:
function ComponentName({ prop1, prop2 }) {
  const { state } = useCustomHook();
  return <div className="component-class">...</div>;
}
ComponentName.propTypes = { prop1: PropTypes.string.isRequired };
```

Provider hierarchy: LoggerProvider → ErrorBoundary → ThemeProvider → NotificationProvider → AuthProvider → UserSettingsProvider → DocumentContextProvider → GitHubSettingsProvider

Hook imports: `import { useDocumentState, useEditor } from '@/hooks';`

## Styling & Design System

### Core Rules
- **SCSS only** in `src/styles/` — never inline styles, never CSS-in-JS
- **Bootstrap 5.3 + React Bootstrap** as foundation
- **Bootstrap Icons** for iconography
- **`@use "variables"` and `@use "mixins"`** at top of every SCSS partial

### Design Tokens (`_variables.scss`)

All visual values come from the token system. **Never hard-code colors, spacing, shadows, or radii.**

**Colors** — Use the `$color-*` palette, not raw hex values:
- Brand: `$color-primary` (#4f6df5), `$color-primary-hover`, `$color-primary-subtle`, `$color-accent` (#10b981)
- Neutrals: `$color-gray-50` through `$color-gray-900` (10-step ramp)
- Semantic: `$color-success`, `$color-warning`, `$color-danger`, `$color-info`
- Surfaces: `$color-bg-light`, `$color-bg-surface-light`, `$color-bg-elevated-light` (and `-dark` variants)
- Text: `$color-text-light`, `$color-text-secondary-light` (and `-dark` variants)
- Borders: `$color-border`, `$color-border-light`, `$color-border-emphasis-light` (and `-dark` variants)

**Spacing** — 4px base unit scale, use `$space-*` tokens:
- `$space-1` (4px) → `$space-2` (8px) → `$space-3` (12px) → `$space-4` (16px) → `$space-6` (24px) → `$space-8` (32px) → `$space-12` (48px)
- Legacy aliases exist (`$spacing-base`, `$spacing-sm`, `$spacing-xs`) — prefer `$space-*` in new code

**Typography** — Use `$font-size-*` and `$font-weight-*` tokens:
- Sizes: `$font-size-xs` (12px), `$font-size-sm` (13px), `$font-size-base` (14px), `$font-size-md` (16px), `$font-size-lg` (18px), `$font-size-xl` (20px), `$font-size-2xl` (24px)
- Weights: `$font-weight-normal` (400), `$font-weight-medium` (500), `$font-weight-semibold` (600), `$font-weight-bold` (700)
- Families: `$font-mono`, `$font-sans`

**Border Radius** — `$radius-sm`, `$radius-md`, `$radius-lg`, `$radius-xl`, `$radius-full`

**Shadows** — Light: `$shadow-xs` through `$shadow-xl`. Dark: `$shadow-sm-dark`, `$shadow-md-dark`, `$shadow-lg-dark`

**Transitions** — `$transition-fast`, `$transition-base`, `$transition-slow`, `$transition-theme`

### CSS Custom Properties (`--mm-*` namespace)

Runtime tokens defined in `_base.scss` that auto-switch between light/dark themes:

```scss
// Use these in SCSS for theme-aware values:
var(--mm-primary)          // Brand primary color
var(--mm-bg)               // Page background
var(--mm-bg-surface)       // Cards, panels, secondary surfaces
var(--mm-bg-elevated)      // Modals, dropdowns, popovers
var(--mm-text)             // Primary text
var(--mm-text-secondary)   // Muted/secondary text
var(--mm-border)           // Default border
var(--mm-border-subtle)    // Lighter border
var(--mm-shadow-sm)        // Small shadow
var(--mm-shadow-md)        // Medium shadow
var(--mm-transition-base)  // Standard transition duration
```

**Prefer `var(--mm-*)` for any property that should auto-switch with theme.** Use SCSS `$color-*` variables for compile-time values that don't need runtime switching.

### Mixins (`_mixins.scss`)

**Theme:**
- `@include mixins.dark { ... }` — Styles inside `[data-bs-theme="dark"]`
- `@include mixins.light { ... }` — Styles inside `[data-bs-theme="light"]`

**Surfaces & Depth:**
- `@include mixins.elevation("xs"|"sm"|"md"|"lg"|"xl")` — Applies shadow + theme-aware dark variant
- `@include mixins.surface($light-bg, $dark-bg)` — Sets background for both themes
- `@include mixins.themed-border($light, $dark)` — Sets border color for both themes

**Transitions:**
- `@include mixins.interactive-transition(property1, property2, ...)` — Standard transition for interactive elements

**Responsive:**
- `@include mixins.mobile { ... }` — Below `$breakpoint-sm`
- `@include mixins.tablet { ... }` — Between sm and lg
- `@include mixins.tablet-down { ... }` — Below `$breakpoint-lg`
- `@include mixins.desktop { ... }` — Above `$breakpoint-lg`

### Design Principles (from UI Refresh)

1. **Shadows for depth, borders for separation** — Don't use both on the same element
2. **Theme transitions are global** — `html[data-bs-theme]` applies smooth color transitions; opt out with `.no-theme-transition` class (Monaco, Mermaid auto-excluded)
3. **No hard-coded dark colors** — Use `@include mixins.dark` with token values, or prefer `var(--mm-*)` properties that auto-switch
4. **Consistent hover feedback** — Use `@include mixins.interactive-transition()` for buttons/links; toolbar buttons scale down on `:active`
5. **Dropdown animations** — Menus use `dropdown-enter` keyframe (fade + slide)

### Responsive Design

The app is fully responsive across mobile, tablet, and desktop. Breakpoints are defined as SCSS tokens in `_variables.scss` and mirrored in a JS hook for runtime behavior.

**Breakpoints:**

| Name | SCSS Token | Width | Mixin |
|------|-----------|-------|-------|
| Mobile | `$breakpoint-sm` | ≤576px | `@include mixins.mobile` |
| Tablet | — | 577–768px | `@include mixins.tablet` |
| Tablet-down | `$breakpoint-md` | ≤768px | `@include mixins.tablet-down` |
| Desktop | — | ≥769px | `@include mixins.desktop` |

**JS Hook:** `useViewport()` from `@/hooks` mirrors the SCSS breakpoints, returns `{ isMobile, isTablet, isDesktop, width }`. Use this for conditional rendering — never duplicate breakpoint values in components.

**Layout Behavior By Device:**

| Aspect | Desktop (≥769) | Tablet (577–768) | Mobile (≤576) |
|--------|---------------|-----------------|---------------|
| Editor/Preview | 40/60 split, drag-resizable | 50/50 forced, no resize | Single pane, toggle between |
| Panel switching | N/A | N/A | Edit/Preview segmented control in toolbar |
| Resizer | Visible drag handle | Hidden | Hidden |
| Toolbar | Full utility controls inline | Condensed | Hamburger + offcanvas menus |
| File menu | Full dropdown | Medium density | Offcanvas with touch targets |
| User menu | Dropdown | Dropdown | Offcanvas |

**Mobile Panel Toggle:**
- State lives in `DocumentContextProvider` as `mobileViewMode` (`'editor'` or `'preview'`)
- `AppLayout` sets `data-mobile-view` attribute on `#main`
- CSS uses `[data-mobile-view="editor"]` / `[data-mobile-view="preview"]` selectors to show/hide panels
- Both panels remain in the DOM (not conditionally rendered) — CSS controls visibility

**Mobile UI Components:**
- `MobileToolbarMenu.jsx` — Offcanvas menu replacing toolbar controls
- `MobileUserMenu.jsx` — Offcanvas user/account menu
- `FileDropdown.jsx` — Renders offcanvas file menu on mobile, dropdown on desktop
- `useResponsiveMenu()` — Height-based density hook (`full`/`medium`/`compact`) for file menu item sizing

**Touch Targets:**
- Minimum touch target: `$touch-target-min` (44px) — enforced on all mobile buttons and menu items
- Mobile menu items use `min-height: 44px` with appropriate padding
- Enable `-webkit-overflow-scrolling: touch` on scrollable mobile menus

**Key Conventions:**
1. **Hide/remap, don't shrink** — Mobile simplifies by hiding controls and moving them to offcanvas menus, not by making everything smaller
2. **SCSS-first** — Layout responsive behavior is driven by SCSS mixins and `_responsive.scss`, not React conditional rendering of layout structure
3. **`_responsive.scss` imports last** in `main.scss` so overrides cascade correctly
4. **Toolbar has its own responsive** — `toolbar/_responsive.scss` handles toolbar-specific breakpoints separately from global layout
5. **No Bootstrap responsive utilities** — Don't use `d-none d-md-block` patterns; use the project's mixin system instead

### SCSS File Organization

```
src/styles/
├── _variables.scss       # Design tokens (import first)
├── _mixins.scss          # Theme, elevation, responsive mixins
├── _base.scss            # CSS custom properties, global resets, theme transition
├── _layout.scss          # Main layout (#container, panels, resizer)
├── _preview.scss         # Markdown preview content styling
├── _responsive.scss      # Global media queries (imported last)
├── main.scss             # Import orchestrator
├── toolbar/              # Header, navigation, buttons, dropdowns
├── code/                 # Code blocks, syntax, copy actions, language badges
├── modals/               # Modal base and variants
├── chat/                 # Chat drawer
├── github/               # GitHub integration styles
├── editor/               # Editor-specific styles
├── fileBrowser/          # File browser styles
├── components/           # Shared component styles (diagram controls, etc.)
├── storage/              # Storage management styles
└── admin                 # Admin panel styles
```

## File Organization
- `components/admin/` - Admin panel (user/storage/AI management tabs)
- `components/auth/` - Authentication UI
- `components/chat/` - AI chat drawer with SSE streaming
- `components/dictionary/` - Custom dictionary management (scope-aware)
- `components/document/` - Document management
- `components/editor/` - Monaco editor integration
- `components/file/` - File operations (open/save/import/export/recent)
- `components/git/` - Git management modal and diff viewer
- `components/github/` - GitHub integration (accounts, repos, settings, cache/sync, PR, conflict)
- `components/icons/` - Icon browser and management
- `components/image/` - Image display and crop overlays
- `components/images/` - Image browser/upload
- `components/layout/` - App layout, resizer, mobile toggle, shared view
- `components/linting/` - Markdown lint rule config/import-export
- `components/renderer/` - Markdown preview with Mermaid/syntax highlighting
- `components/sections/` - EditorSection, RendererSection
- `components/security/` - MFA setup/verify/disable, backup codes
- `components/settings/` - GitHub integration settings
- `components/shared/` - Reusable components and FileBrowser
- `components/storage/` - Storage management tab
- `components/system/` - System health monitoring
- `components/toolbar/` - App toolbar, document controls, user menus, search
- `components/user/` - User settings/profile

## Domain-Specific Instructions
See these files for detailed guidance per domain:
- `copilot-editor.instructions.md` - Monaco editor, spell check, markdown toolbar
- `copilot-renderer.instructions.md` - Preview, Mermaid, syntax highlighting
- `copilot-ui-github.instructions.md` - GitHub integration UI
- `copilot-ui-toolbar-layout.instructions.md` - Toolbar, layout, chat, sections
- `copilot-ui-document-management.instructions.md` - Documents, file browser, providers
- `copilot-ui-icons.instructions.md` - Icon browser and service stack
- `copilot-ui-admin-security.instructions.md` - Admin, MFA, user settings
- `copilot-ui-linting-dictionary.instructions.md` - Linting rules, dictionary management

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
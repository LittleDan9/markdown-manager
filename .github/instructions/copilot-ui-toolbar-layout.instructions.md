---
description: "Use when working on the app toolbar, layout containers, chat drawer, sections, mobile menus, semantic search, theme toggle, or responsive layout behavior."
applyTo: "services/ui/src/components/toolbar/**,services/ui/src/components/layout/**,services/ui/src/components/chat/**,services/ui/src/components/sections/**,services/ui/src/hooks/ui/**,services/ui/src/styles/toolbar/**,services/ui/src/styles/chat/**,services/ui/src/api/searchApi*"
---
# Toolbar, Layout & Chat UI

## Toolbar Architecture

### Composition (`Toolbar.jsx`)
The toolbar is the app-shell header with responsive behavior:
- **Left side**: FileDropdown + Document component (non-mobile, non-shared view)
- **Center (mobile)**: Edit/Preview segmented toggle bound to `mobileViewMode`
- **Right side (desktop)**: SemanticSearch, ShareButton, Icon Browser button, Chat button, Fullscreen toggle, UserToolbar
- **Right side (mobile)**: User menu trigger + overflow toolbar trigger
- **Mobile overlays**: `MobileUserMenu` and `MobileToolbarMenu` offcanvas menus

### Key Components
- `Document.jsx` → Category management, rename, save behavior, last-saved display
- `User.jsx` / `UserMenuLoggedIn.jsx` / `UserMenuLoggedOut.jsx` → Account actions, settings access
- `SemanticSearch.jsx` → RAG-powered document search via `searchApi.semanticSearch()`
- `ThemeToggle.jsx` → Light/dark mode switch
- `ToolbarSeparator.jsx` → Visual divider between groups
- `MobileToolbarMenu.jsx` → Offcanvas overflow menu for small screens
- `MobileUserMenu.jsx` → Offcanvas user menu for small screens

### Toolbar Groups
Legacy formatting groups (`TextFormattingGroup`, `HeadingGroup`, `ListGroup`, `MediaGroup`) exist under `toolbar/` but formatting actions have moved to the markdown toolbar within the editor component. These are separate from the app-level toolbar.

## Layout Architecture

### AppLayout
Primary container with split-view (editor + renderer) or preview-full mode:
- Split-view applies flex layout with editor and renderer sections
- `InvisibleResizer` → Desktop split-size persistence via user settings, flex/width application, mobile/fullscreen reset
- `MobileViewToggle` → Bottom toggle between editor/preview on mobile (hidden in shared/fullscreen)

### SharedViewLayout
Simplified layout for shared document viewing (no editor, read-only renderer + toolbar).

### Sections
- `EditorSection` → Wraps Editor component with section-level concerns
- `RendererSection` → Wraps Renderer component with section-level concerns

## Chat Drawer (`ChatDrawer.jsx`)

### Architecture
React Bootstrap Offcanvas drawer with local message state and SSE streaming.

### Features
- **Scope toggle**: All documents vs current document mode
- **Deep Think toggle**: Enhanced analysis mode for current-document scope
- **Intent detection**: `detectOpenIntent()` catches "open/show/go to <doc>" commands locally without AI roundtrip
- **SSE streaming**: `searchApi.askQuestion()` streams tokens via callback, appending to current assistant message
- **Markdown rendering**: Assistant messages rendered through markdown-it (HTML disabled)
- **Document links**: Completed assistant messages get clickable doc references injected; click opens action menu (Open Document / Chat About)
- **Timing display**: Records start/end/duration per response, displays formatted timing + server metrics

### API: searchApi
- `semanticSearch(query, limit)` → GET semantic search endpoint
- `askQuestion(question, onToken, options)` → POST /api/chat/ask with SSE parsing
- `getChatHealth()` → Chat health check

## UI Hooks
- `useResponsiveMenu` → Maps window height to full/medium/compact menu states
- `useViewport` → Breakpoints at 576/768px, returns isMobile/isTablet/isDesktop/width
- `useConfirmModal` → Reusable confirmation dialog hook
- `useFileModal` → File operation modal state management
- `usePreviewHTMLState` → Preview HTML content state
- `useRenderingState` → Rendering pipeline state tracking
- `useContentChangeTrigger` → Triggers re-renders on content changes
- `useSharedViewState` / `useSharedViewEffects` → Shared document view management
- `useCodeCopy` → Code block copy-to-clipboard functionality

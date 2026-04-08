---
description: "Use when working on the app toolbar, layout containers, chat drawer, chat history, sections, mobile menus, semantic search, theme toggle, or responsive layout behavior."
applyTo: "services/ui/src/components/toolbar/**,services/ui/src/components/layout/**,services/ui/src/components/chat/**,services/ui/src/components/sections/**,services/ui/src/hooks/ui/**,services/ui/src/hooks/chat/**,services/ui/src/styles/toolbar/**,services/ui/src/styles/chat/**,services/ui/src/api/searchApi*,services/ui/src/api/chatHistoryApi*"
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
React Bootstrap Offcanvas drawer with local message state, SSE streaming, and multi-provider LLM support.

### Features
- **Provider selector**: Dropdown in header for choosing LLM provider (Ollama local, OpenAI, xAI Grok). Fetches user's configured providers via `apiKeysApi.getKeys()` on drawer open, merges with always-available Ollama. Grouped into Local/Remote sections.
- **Scope toggle**: All documents vs current document mode
- **Deep Think toggle**: Enhanced analysis mode for current-document scope
- **Selection context**: Auto-detects `editorSelection` from `DocumentContextProvider`. Shows pill with selected text preview above input; can be dismissed/restored. Passed as `selectionContext` to `searchApi.askQuestion()`.
- **Quick actions**: Pill bar with preset prompts (Summarize, Expand Shorthand, Improve Structure, Fix Grammar). Clicking sets scope to Current Doc and sends the prompt.
- **Intent detection**: `detectOpenIntent()` catches "open/show/go to <doc>" commands locally without AI roundtrip
- **SSE streaming**: `searchApi.askQuestion()` streams tokens via callback, passing `provider` and `selectionContext` params
- **Markdown rendering**: Assistant messages rendered through markdown-it (HTML disabled)
- **Document links**: Completed assistant messages get clickable doc references injected; click opens action menu (Open Document / Chat About)
- **Response action buttons**: Compact icon bar below completed assistant messages — Insert at Cursor, Replace Selection, Replace Document (with confirmation), Append to Document, Copy to Clipboard. Uses `useChatEditorActions` hook.
- **Timing display**: Records start/end/duration per response, displays formatted timing + server metrics

### Chat History & Persistence
Conversations are persisted to the backend database via `chatHistoryApi` and managed through `useChatHistory` hook.

**Header buttons** (replaced the old trash/clear button):
- `bi-clock-history` → Toggles the `ChatHistoryPanel` sliding overlay
- `bi-plus-lg` → Creates a new conversation (clears messages, resets active conversation)

**Auto-save flow** (integrated into `handleSend`):
1. On first send with no active conversation → `history.createConversation(provider, scope, documentId)`
2. User message saved immediately → `history.saveMessage(convId, "user", content)`
3. Assistant message saved after streaming completes → `history.saveMessage(convId, "assistant", content, metadataJson)`
4. After first assistant response → `history.generateTitle(convId, provider)` triggers async LLM title generation

### Chat History Panel (`ChatHistoryPanel.jsx`)
Sliding overlay panel within the Offcanvas body, toggled by `showHistory` state:
- Lists conversations sorted by most recent (title, message count, relative date, provider icon)
- Click loads conversation → restores messages, scope, and provider into ChatDrawer state
- Per-item delete button (visible on hover)
- Empty state when no history exists
- Active conversation highlighted with left border accent

### Chat History Hook (`hooks/chat/useChatHistory.js`)
Manages conversation list state and active conversation tracking:
- `conversations` / `activeConversationId` / `loading` — state
- `loadConversations()` — fetch summaries on drawer open
- `createConversation(provider, scope, documentId)` — create and set active
- `loadConversation(conversationId)` — fetch full detail with messages
- `saveMessage(convId, role, content, metadataJson)` — persist message, update local list
- `deleteConversation(conversationId)` — delete and reset if active
- `renameConversation(conversationId, title)` — update title
- `generateTitle(conversationId, provider)` — LLM title generation (deduplicated via ref)
- `clearActive()` — reset active conversation (used by New Chat)

### API: chatHistoryApi
- `createConversation(provider, scope, documentId)` → POST /api/chat/conversations/
- `getConversations(limit, offset)` → GET /api/chat/conversations/
- `getConversation(conversationId)` → GET /api/chat/conversations/{id}
- `updateConversation(conversationId, { title })` → PUT /api/chat/conversations/{id}
- `deleteConversation(conversationId)` → DELETE /api/chat/conversations/{id}
- `addMessage(conversationId, role, content, metadataJson)` → POST /api/chat/conversations/{id}/messages
- `generateTitle(conversationId, provider)` → POST /api/chat/conversations/{id}/generate-title

### Chat Editor Actions (`hooks/chat/useChatEditorActions.js`)
Hook providing editor injection functions via `window.editorInstance`:
- `insertAtCursor(text)` → Insert at current cursor position
- `replaceSelection(text)` → Replace currently selected text
- `replaceDocument(text)` → Replace entire document content
- `appendToDocument(text)` → Append at end of document
- `copyToClipboard(text)` → Copy to system clipboard
- `hasEditor()` → Check if editor is available
Uses `editor.executeEdits()` pattern matching existing `useTextFormatting.js`.

### API: searchApi
- `semanticSearch(query, limit)` → GET semantic search endpoint
- `askQuestion(question, onToken, options)` → POST /api/chat/ask with SSE parsing. Accepts `provider` (string) and `selectionContext` (string) as additional parameters.
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

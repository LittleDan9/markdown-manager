# Editor Component Instructions - Markdown Manager

## Editor Overview

The Editor is the primary content creation interface built on Monaco Editor with advanced markdown-specific features. It's composed of three main layers:

- **Monaco Editor Integration**: Core text editing with syntax highlighting
- **Spell Check System**: Real-time spell checking with custom dictionary support
- **GitHub Integration**: Status bar showing sync state and git operations

## Core Architecture

### Main Editor Component (`Editor.jsx`)
```jsx
// Primary composition pattern
<div id="editorContainer">
  <MarkdownToolbar />
  <div id="editor" className={editorClassName}>
    <div ref={containerRef} className="monaco-container" />
    <GitHubStatusBar />
  </div>
</div>
```

### Hook-Based Integration (`useEditor`)
The editor uses a consolidated `useEditor` hook that orchestrates:
- Monaco editor lifecycle
- Spell check integration
- Keyboard shortcuts
- List behavior (auto-indentation)
- Content change handling

## Spell Check System

### Architecture
The spell check system is built on modular services:

- **SpellCheckService**: Core logic for processing text
- **SpellCheckWorkerPool**: Background workers for performance
- **SpellCheckMarkers**: Monaco marker management
- **TextRegionAnalyzer**: Incremental checking of changed regions
- **MonacoMarkerAdapter**: Converting issues to Monaco markers
- **SpellCheckActions**: Quick fix actions and commands

### Key Features
```javascript
// Incremental spell checking - only checks changed regions
const region = TextRegionAnalyzer.getChangedRegion(editor, prevValue, newValue);

// Custom dictionary integration per category/folder
SpellCheckActions.registerQuickFixActions(editor, suggestionsMapRef, getCategoryId, getFolderPath);

// Performance optimized with workers
const issues = await SpellCheckService.checkText(text, { useWorkers: true });
```

### Quick Fix Actions
- Add to custom dictionary (per category/folder)
- Accept suggestions from hunspell
- Ignore word for session
- Replace with suggestion

## Markdown Toolbar

### Component Structure
```jsx
// Modular toolbar with grouped functionality
<MarkdownToolbar>
  <TextFormattingGroup />    // Bold, italic, strikethrough
  <HeadingGroup />          // H1-H6 headers
  <ListGroup />             // Ordered/unordered lists
  <MediaGroup />            // Links, images, horizontal rules
  <SpellCheckGroup />       // Spell check controls
</MarkdownToolbar>
```

### Formatting Actions
Uses `useMarkdownActions` hook for consistent text manipulation:
```javascript
const { insertMarkdown, insertHeading, insertList } = useMarkdownActions(editorRef);

// Insert bold text around selection
insertMarkdown('**', '**', 'bold text');

// Insert heading at cursor
insertHeading(2); // ## Heading

// Convert selection to list
insertList('ordered'); // 1. Item
```

## GitHub Integration

### Status Bar (`GitHubStatusBar.jsx`)
Displays real-time sync status:
- Repository connection state
- Uncommitted changes count
- Last sync timestamp
- Sync operation progress

### Git Operations
- Auto-commit on save (configurable)
- Manual push/pull operations
- Conflict detection and resolution
- Branch status monitoring

### Document Updates
```javascript
// Handle document updates from GitHub operations
const handleDocumentUpdate = (updatedDocument) => {
  setCurrentDocument(updatedDocument);
  setContent(updatedDocument.content || '');
  onChange(updatedDocument.content || '');
};
```

## Key Development Patterns

### Monaco Editor Lifecycle
```javascript
// Editor initialization with spell check
const { editor, spellCheck, runSpellCheck } = useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck: true,
  enableKeyboardShortcuts: true,
  categoryId,
  getCategoryId: () => categoryIdRef.current
});
```

### Content Change Handling
- Debounced cursor line changes (300ms)
- Incremental spell checking on content changes
- Auto-save integration with document context
- Real-time GitHub status updates

### Keyboard Shortcuts
Global shortcuts managed through `useGlobalKeyboardShortcuts`:
- Ctrl+S: Save document
- Ctrl+B: Bold text
- Ctrl+I: Italic text
- F7: Run spell check

## Performance Optimizations

### Spell Check Optimization
- Web Workers for background processing
- Incremental checking of changed regions only
- Marker reuse to avoid DOM thrashing
- Debounced suggestions to reduce API calls

### Monaco Integration
- Lazy loading of language features
- Minimal Monaco features enabled
- Efficient marker management
- Optimized theme switching

## Custom Dictionary System

### Per-Category Dictionaries
Each document category can have its own custom dictionary:
```javascript
// Dictionary stored per category/folder path
const dictionaryKey = `${categoryId}/${folderPath}`;
await CustomDictionaryApi.addWord(word, dictionaryKey);
```

### Dictionary Management
- Words added via quick fix actions
- Category-specific word lists
- Import/export functionality
- Merge conflicts handled gracefully

## CSS Classes and Styling

### Editor Layout Classes
```scss
.has-toolbar { /* Editor with toolbar spacing */ }
.has-github-status { /* Editor with status bar */ }
.no-github-status { /* Editor without status bar */ }
.monaco-container { /* Monaco editor container */ }
```

### Spell Check Styling
```scss
.spell-error { /* Red underline for errors */ }
.spell-suggestion { /* Blue underline for suggestions */ }
.spell-ignore { /* Grayed out ignored words */ }
```

## Integration Points

### Document Context
Editor integrates with DocumentContextProvider for:
- Current document state
- Content synchronization
- Save operations
- GitHub status updates

### Auth Provider
Authentication state affects:
- GitHub integration availability
- Custom dictionary access
- Editor permissions

### Theme Provider
Theme changes propagate to:
- Monaco editor theme
- Spell check marker colors
- Toolbar styling

## Common Development Tasks

### Adding New Formatting Actions
1. Add action to appropriate toolbar group component
2. Implement action in `useMarkdownActions` hook
3. Add keyboard shortcut if needed
4. Test with various text selections

### Extending Spell Check
1. Modify SpellCheckService for new logic
2. Add new quick fix actions in SpellCheckActions
3. Update marker types in MonacoMarkerAdapter
4. Test performance with large documents

### GitHub Integration Changes
1. Update GitHubStatusBar for new status types
2. Modify document update handlers
3. Test with various repository states
4. Ensure conflict resolution works
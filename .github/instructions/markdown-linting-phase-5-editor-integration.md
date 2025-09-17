---
applyTo: "frontend/src/hooks/**/* frontend/src/components/editor/**/*"
description: "Phase 5: Editor Integration - useEditor hook updates, toolbar controls, Monaco markers"
---

# Phase 5: Editor Integration

## 🎯 **Phase Objective**
Integrate markdown linting into the Monaco editor environment, including useEditor hook updates, toolbar controls, marker display, and real-time linting functionality. This phase makes linting visible and actionable within the editor.

## 📋 **Requirements Analysis**

### **Integration Points**
- **useEditor Hook**: Add linting lifecycle management
- **Monaco Markers**: Display linting issues with appropriate styling
- **Toolbar Controls**: Add linting toggle and manual lint buttons
- **Quick Fixes**: Enable code actions for auto-fixable rules
- **Performance**: Debounced linting to prevent excessive processing

### **User Experience Goals**
- **Real-time Feedback**: Show linting issues as user types (debounced)
- **Visual Clarity**: Distinguish linting markers from spell check markers
- **Quick Actions**: Easy access to rule documentation and fixes
- **Performance**: No noticeable lag during editing

## 🔧 **Implementation Tasks**

### **Task 5.1: Update useEditor Hook**
**File**: `frontend/src/hooks/useEditor.js`

Add markdown linting integration to the existing useEditor hook:

```javascript
// Add these imports to existing imports
import {
  MarkdownLintService,
  MarkdownLintMarkers,
  MarkdownLintMarkerAdapter,
  MarkdownLintActions
} from '@/services/editor';

// Add to hook parameters (around line 20)
export function useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck = true,
  enableMarkdownLint = true, // New parameter
  categoryId,
  getCategoryId,
  getFolderPath = () => '/',
  // ... existing parameters
}) {

// Add state for markdown linting (around line 50)
const [markdownLintEnabled, setMarkdownLintEnabled] = useState(enableMarkdownLint);

// Add markdown linting setup effect (around line 150)
useEffect(() => {
  if (!editor || !markdownLintEnabled) return;

  // Register quick fix actions
  MarkdownLintActions.registerQuickFixActions(editor, getCategoryId, getFolderPath);

  // Initial lint run
  const runInitialLint = async () => {
    try {
      const text = editor.getValue();
      const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
      const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

      const issues = await MarkdownLintService.scan(text, () => {}, currentCategoryId, currentFolderPath);
      const markers = MarkdownLintMarkerAdapter.toMonacoMarkers(editor, issues, 0);
      MarkdownLintMarkers.applyMarkers(editor.getModel(), markers);
    } catch (error) {
      console.error('Initial markdown lint failed:', error);
    }
  };

  runInitialLint();
}, [editor, markdownLintEnabled, getCategoryId, getFolderPath]);

// Add content change linting effect (around line 180)
useEffect(() => {
  if (!editor || !markdownLintEnabled) return;

  const runMarkdownLint = async () => {
    try {
      const text = editor.getValue();
      const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
      const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

      const issues = await MarkdownLintService.scan(text, () => {}, currentCategoryId, currentFolderPath);
      const markers = MarkdownLintMarkerAdapter.toMonacoMarkers(editor, issues, 0);
      MarkdownLintMarkers.applyMarkers(editor.getModel(), markers);
    } catch (error) {
      console.error('Markdown lint failed:', error);
    }
  };

  // Debounced linting on content change (longer delay than spell check)
  const debouncedMarkdownLint = debounce(runMarkdownLint, 1500);

  const disposable = editor.onDidChangeModelContent(debouncedMarkdownLint);

  return () => disposable.dispose();
}, [editor, value, markdownLintEnabled, getCategoryId, getFolderPath]);

// Add manual lint function
const runMarkdownLint = useCallback(async () => {
  if (!editor || !markdownLintEnabled) return;

  try {
    const text = editor.getValue();
    const currentCategoryId = typeof getCategoryId === 'function' ? getCategoryId() : getCategoryId;
    const currentFolderPath = typeof getFolderPath === 'function' ? getFolderPath() : getFolderPath;

    const issues = await MarkdownLintService.scan(text, () => {}, currentCategoryId, currentFolderPath);
    const markers = MarkdownLintMarkerAdapter.toMonacoMarkers(editor, issues, 0);
    MarkdownLintMarkers.applyMarkers(editor.getModel(), markers);
  } catch (error) {
    console.error('Manual markdown lint failed:', error);
  }
}, [editor, markdownLintEnabled, getCategoryId, getFolderPath]);

// Add markdown lint toggle function
const toggleMarkdownLint = useCallback(() => {
  if (!editor) return;

  const newEnabled = !markdownLintEnabled;
  setMarkdownLintEnabled(newEnabled);

  if (!newEnabled) {
    // Clear markers when disabled
    MarkdownLintMarkers.clearMarkers(editor);
  } else {
    // Run lint when enabled
    runMarkdownLint();
  }
}, [editor, markdownLintEnabled, runMarkdownLint]);

// Update return object (around line 300)
return {
  editor,
  spellCheck,
  runSpellCheck,
  markdownLint: markdownLintEnabled, // New return value
  runMarkdownLint,                   // New return value
  toggleMarkdownLint,               // New return value
  // ... existing return values
};
```

### **Task 5.2: Update MarkdownToolbar**
**File**: `frontend/src/components/editor/MarkdownToolbar.jsx`

Add markdown linting controls to the toolbar:

```javascript
// Add import
import { Button, ButtonGroup } from 'react-bootstrap';

// Add linting control group (around line 100, near other tool groups)
<ButtonGroup className="linting-controls">
  <Button
    variant={markdownLintEnabled ? "primary" : "outline-secondary"}
    size="sm"
    onClick={toggleMarkdownLint}
    title={markdownLintEnabled ? "Disable Markdown Linting" : "Enable Markdown Linting"}
    className="toolbar-button"
  >
    <i className={`bi ${markdownLintEnabled ? "bi-check2-square-fill" : "bi-check2-square"}`}></i>
  </Button>

  <Button
    variant="outline-secondary"
    size="sm"
    onClick={runMarkdownLint}
    disabled={!markdownLintEnabled}
    title="Run Markdown Lint"
    className="toolbar-button"
  >
    <i className="bi bi-arrow-clockwise"></i>
  </Button>
</ButtonGroup>

// Update props to include markdown lint functions (around line 20)
function MarkdownToolbar({
  // ... existing props
  markdownLintEnabled,
  runMarkdownLint,
  toggleMarkdownLint,
}) {
```

### **Task 5.3: Update Editor Component**
**File**: `frontend/src/components/editor/Editor.jsx`

Pass markdown linting props to toolbar:

```javascript
// Update useEditor call (around line 80)
const {
  editor,
  spellCheck,
  runSpellCheck,
  markdownLint,
  runMarkdownLint,
  toggleMarkdownLint,
  // ... existing destructured values
} = useEditor({
  containerRef,
  value,
  onChange,
  onCursorLineChange,
  enableSpellCheck: true,
  enableMarkdownLint: true, // Enable by default
  categoryId,
  getCategoryId: () => categoryIdRef.current,
  getFolderPath: () => folderPath,
  // ... existing parameters
});

// Update MarkdownToolbar props (around line 120)
<MarkdownToolbar
  // ... existing props
  markdownLintEnabled={markdownLint}
  runMarkdownLint={runMarkdownLint}
  toggleMarkdownLint={toggleMarkdownLint}
/>
```

### **Task 5.4: Create Markdown Lint Status Component**
**File**: `frontend/src/components/editor/MarkdownLintStatus.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';

/**
 * Status indicator for markdown linting
 * Shows number of issues and linting status
 */
function MarkdownLintStatus({ editor, enabled }) {
  const [issueCount, setIssueCount] = useState(0);
  const [lastLintTime, setLastLintTime] = useState(null);
  const [isLinting, setIsLinting] = useState(false);

  useEffect(() => {
    if (!editor || !enabled) {
      setIssueCount(0);
      return;
    }

    const updateIssueCount = () => {
      const model = editor.getModel();
      if (!model) return;

      const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        .filter(m => m.owner === 'markdownlint');

      setIssueCount(markers.length);
      setLastLintTime(new Date());
      setIsLinting(false);
    };

    // Monitor marker changes
    const disposable = monaco.editor.onDidChangeMarkers(() => {
      updateIssueCount();
    });

    // Initial count
    updateIssueCount();

    return () => disposable.dispose();
  }, [editor, enabled]);

  // Monitor for linting activity
  useEffect(() => {
    if (!editor || !enabled) return;

    const contentDisposable = editor.onDidChangeModelContent(() => {
      setIsLinting(true);
      // Reset after timeout if no marker update
      const timeout = setTimeout(() => setIsLinting(false), 2000);
      return () => clearTimeout(timeout);
    });

    return () => contentDisposable.dispose();
  }, [editor, enabled]);

  if (!enabled) {
    return (
      <Badge bg="secondary" className="ms-2">
        Lint: Off
      </Badge>
    );
  }

  const variant = issueCount === 0 ? 'success' : issueCount < 5 ? 'warning' : 'danger';
  const tooltipText = `${issueCount} markdown linting issue${issueCount !== 1 ? 's' : ''}${
    lastLintTime ? ` (last check: ${lastLintTime.toLocaleTimeString()})` : ''
  }`;

  return (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip>{tooltipText}</Tooltip>}
    >
      <Badge bg={variant} className="ms-2">
        {isLinting ? (
          <>
            <i className="bi bi-arrow-clockwise spinner-border-sm me-1"></i>
            Linting...
          </>
        ) : (
          <>
            Lint: {issueCount}
          </>
        )}
      </Badge>
    </OverlayTrigger>
  );
}

export default MarkdownLintStatus;
```

### **Task 5.5: Update Global Keyboard Shortcuts**
**File**: `frontend/src/hooks/useGlobalKeyboardShortcuts.js`

Add keyboard shortcuts for markdown linting:

```javascript
// Add to existing shortcuts (around line 50)
useEffect(() => {
  const handleKeyDown = (event) => {
    // ... existing shortcuts

    // F8 - Run Markdown Lint
    if (event.key === 'F8' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (runMarkdownLint) {
        runMarkdownLint();
      }
    }

    // Ctrl+Shift+L - Toggle Markdown Lint
    if (event.key === 'L' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      if (toggleMarkdownLint) {
        toggleMarkdownLint();
      }
    }
  };

  // ... rest of existing code
}, [
  // ... existing dependencies
  runMarkdownLint,
  toggleMarkdownLint,
]);
```

### **Task 5.6: Create CSS Styles for Linting Markers**
**File**: `frontend/src/styles/editor.scss`

Add styles for markdown linting markers:

```scss
// Markdown linting marker styles
.monaco-editor {
  // Markdown lint markers (distinct from spell check)
  .squiggly-warning.markdownlint {
    border-bottom: 2px dotted #ff6b6b; // Red dotted underline
  }

  .squiggly-error.markdownlint {
    border-bottom: 2px solid #dc3545; // Red solid underline
  }

  .squiggly-info.markdownlint {
    border-bottom: 2px dotted #17a2b8; // Blue dotted underline
  }

  // Hover tooltip styling
  .monaco-hover .hover-contents {
    .markdown-lint-message {
      .rule-code {
        font-weight: bold;
        color: #007bff;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
          cursor: pointer;
        }
      }

      .rule-description {
        color: #6c757d;
        font-style: italic;
      }
    }
  }

  // Code action lightbulb styling
  .contentWidgets .codicon-lightbulb {
    &.markdownlint-action {
      color: #28a745; // Green for auto-fixable rules
    }
  }
}

// Toolbar linting controls
.toolbar-button {
  &.linting-enabled {
    background-color: #28a745;
    border-color: #28a745;
    color: white;
  }

  &.linting-disabled {
    background-color: #6c757d;
    border-color: #6c757d;
    color: white;
  }
}

// Status badge animations
.spinner-border-sm {
  width: 0.75rem;
  height: 0.75rem;
  animation: spinner-border 0.75s linear infinite;
}

@keyframes spinner-border {
  to {
    transform: rotate(360deg);
  }
}
```

### **Task 5.7: Integrate Status Display**
**File**: `frontend/src/components/editor/Editor.jsx`

Add markdown lint status to the editor:

```javascript
// Add import
import MarkdownLintStatus from './MarkdownLintStatus';

// Add status display to editor layout (around line 200)
<div className={editorClassName}>
  <div ref={containerRef} className="monaco-container" />

  {/* Status bar with both spell check and markdown lint status */}
  <div className="editor-status-bar">
    <div className="status-left">
      {/* Existing spell check status */}
    </div>

    <div className="status-right">
      <MarkdownLintStatus
        editor={editor}
        enabled={markdownLint}
      />
      {/* Existing GitHub status */}
    </div>
  </div>
</div>
```

### **Task 5.8: Add Linting Context Menu**
**File**: `frontend/src/services/editor/MarkdownLintActions.js`

Add context menu integration:

```javascript
// Add to registerQuickFixActions method
static registerQuickFixActions(editor, getCategoryId, getFolderPath) {
  // ... existing code

  // Register context menu actions
  editor.addAction({
    id: 'markdownlint.runLint',
    label: 'Run Markdown Lint',
    keybindings: [monaco.KeyCode.F8],
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.5,
    run: () => this._triggerFullLint(editor, getCategoryId, getFolderPath)
  });

  editor.addAction({
    id: 'markdownlint.toggleLint',
    label: 'Toggle Markdown Linting',
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL
    ],
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.6,
    run: () => {
      // This would need access to the toggle function
      // Implementation depends on how we pass the toggle function
      console.log('Toggle markdown linting from context menu');
    }
  });
}
```

## ✅ **Verification Steps**

1. **Hook Integration**: Verify useEditor properly initializes markdown linting
2. **Marker Display**: Confirm linting issues appear with appropriate styling
3. **Toolbar Controls**: Test enable/disable and manual lint buttons
4. **Performance**: Verify debounced linting doesn't impact typing performance
5. **Quick Fixes**: Confirm code actions work for auto-fixable rules
6. **Status Display**: Verify issue count updates correctly
7. **Keyboard Shortcuts**: Test F8 and Ctrl+Shift+L shortcuts

## 🔗 **Integration Points**

- **Previous Phase**: Uses UI components from Phase 4
- **Next Phase**: Phase 6 will provide backend persistence
- **Monaco Editor**: Deep integration with marker system
- **Spell Checker**: Coexists without conflicts
- **Document Context**: Uses category/folder for rule resolution

## 🎯 **Performance Targets**

- **Linting Delay**: 1500ms debounce to balance responsiveness and performance
- **Marker Update**: < 100ms for marker application
- **Memory Usage**: < 5MB additional memory for linting state
- **Startup Impact**: < 200ms additional editor initialization time

## 🐛 **Common Issues & Solutions**

### **Issue**: Markers overlap with spell check
**Solution**: Use different marker owners and ensure proper z-index

### **Issue**: Performance degradation with large documents
**Solution**: Implement chunk-based processing and marker batching

### **Issue**: Quick fixes not working
**Solution**: Verify code action provider registration and marker diagnostics

This phase brings markdown linting into the active editing experience, providing real-time feedback while maintaining editor performance and usability.
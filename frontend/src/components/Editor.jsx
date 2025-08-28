
import React, { useRef } from 'react';
import MarkdownToolbar from './editor/MarkdownToolbar';
import ProgressIndicator from './ProgressIndicator';
import { GitHubStatusBar } from './editor';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, onChange, onCursorLineChange }) {
  const containerRef = useRef(null);
  const { currentDocument } = useDocumentContext();
  const { isAuthenticated } = useAuth();

  // Get the category from the current document (string name, not ID)
  const categoryId = currentDocument?.category;

  // Create a ref to track current categoryId for dynamic access
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  // Debug: Log the document structure to understand what we have

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange(onCursorLineChange, 300);


  // Use consolidated editor hook
  const { editor, spellCheck } = useEditor({
    containerRef,
    value,
    onChange,
    onCursorLineChange: debouncedLineChange,
    enableSpellCheck: true,
    enableKeyboardShortcuts: true,
    enableListBehavior: true,
    categoryId,
    getCategoryId: () => categoryIdRef.current
  });

  const progress = spellCheck?.progress;

  // Generate CSS class based on whether status bar will be shown
  const editorClassName = `has-toolbar ${isAuthenticated ? 'has-github-status' : 'no-github-status'}`;

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      <MarkdownToolbar editorRef={{ current: editor }} />
      <div id="editor" className={editorClassName} style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
        <div ref={containerRef} className="monaco-container" style={{ flex: 1, width: "100%" }} />
        <GitHubStatusBar
          documentId={currentDocument?.id}
          document={currentDocument}
          onStatusChange={(status) => {
            // Optional: handle status changes globally
            console.log('GitHub status updated:', status);
          }}
        />
      </div>
      <ProgressIndicator progress={progress} />
    </div>
  );
}

import React, { useRef } from 'react';
import MarkdownToolbar from './editor/MarkdownToolbar';
import ProgressIndicator from './ProgressIndicator';
import { GitHubStatusBar } from './editor';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useAuth } from '@/providers/AuthProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, onChange, onCursorLineChange, fullscreenPreview = false }) {
  const containerRef = useRef(null);
  const { currentDocument, setCurrentDocument, setContent } = useDocumentContext();
  const { isAuthenticated } = useAuth();

  // Get the category from the current document (string name, not ID)
  const categoryId = currentDocument?.category;

  // Create a ref to track current categoryId for dynamic access
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  // Create a ref to track current folder path for dynamic access
  const folderPathRef = useRef(currentDocument?.folder_path);
  folderPathRef.current = currentDocument?.folder_path;

  // Debug: Log the document structure to understand what we have

  // Handle document updates from GitHub operations
  const handleDocumentUpdate = (updatedDocument) => {
    if (updatedDocument) {
      setCurrentDocument(updatedDocument);
      setContent(updatedDocument.content || '');
      if (onChange) {
        onChange(updatedDocument.content || '');
      }
    }
  };

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange(onCursorLineChange, 300);


  // Use consolidated editor hook
  const { editor, spellCheck, markdownLint, runSpellCheck, runMarkdownLint } = useEditor({
    containerRef,
    value,
    onChange,
    onCursorLineChange: debouncedLineChange,
    enableSpellCheck: true,
    enableMarkdownLint: true,
    enableKeyboardShortcuts: true,
    enableListBehavior: true,
    categoryId,
    getCategoryId: () => categoryIdRef.current,
    getFolderPath: () => folderPathRef.current
  });

  const progress = spellCheck?.progress;
  const lintProgress = markdownLint?.lintProgress;

  // Generate CSS class based on whether status bar will be shown
  const editorClassName = `has-toolbar ${isAuthenticated ? 'has-github-status' : 'no-github-status'}`;

  return (
    <div style={{
      height: "100%",
      width: "100%",
      position: "relative",
      display: fullscreenPreview ? "none" : "flex",
      flexDirection: "column"
    }}>
      <MarkdownToolbar
        editorRef={{ current: editor }}
        onSpellCheck={runSpellCheck}
        spellCheckProgress={progress}
        onMarkdownLint={runMarkdownLint}
        markdownLintProgress={lintProgress}
      />
      <div id="editor" className={editorClassName} style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
        <div ref={containerRef} className="monaco-container" style={{ flex: 1, width: "100%" }} />
        <GitHubStatusBar
          documentId={currentDocument?.id}
          document={currentDocument}
          onStatusChange={(status) => {
            // Optional: handle status changes globally
            console.log('GitHub status updated:', status);
          }}
          onDocumentUpdate={handleDocumentUpdate}
        />
      </div>
    </div>
  );
}
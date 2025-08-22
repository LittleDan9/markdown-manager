
import React, { useRef } from 'react';
import MarkdownToolbar from '@/components/MarkdownToolbar';
import ProgressIndicator from '@/components/ProgressIndicator';
import { useDocumentContext } from '@/providers/DocumentContextProvider.jsx';
import { useEditor, useDebouncedCursorChange } from '@/hooks/editor';

export default function Editor({ value, onChange, onCursorLineChange }) {
  const containerRef = useRef(null);
  const { currentDocument } = useDocumentContext();

  // Get the category ID from the current document
  const categoryId = currentDocument?.category_id;

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

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      <MarkdownToolbar editorRef={{ current: editor }} />
      <div id="editor" ref={containerRef} className="has-toolbar" style={{ flex: 1, width: "100%" }} />
      <ProgressIndicator progress={progress} />
    </div>
  );
}
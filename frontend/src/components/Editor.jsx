
import React, { useRef } from 'react';
import MarkdownToolbar from './MarkdownToolbar';
import ProgressIndicator from './ProgressIndicator';
import { useDocument } from '@/context/DocumentProvider';
import useMonacoEditor from '../hooks/useMonacoEditor';
import useSpellCheck from '../hooks/useSpellCheck';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import useListBehavior from '../hooks/useListBehavior';
import useDebouncedCursorChange from '../hooks/useDebouncedCursorChange';

export default function Editor({ value, onChange, onCursorLineChange }) {
  const containerRef = useRef(null);
  const { currentDocument } = useDocument();

  // Get the category ID from the current document
  const categoryId = currentDocument?.category_id;

  // Create a ref to track current categoryId for dynamic access
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  // Debug: Log the document structure to understand what we have
  console.log('Editor - currentDocument:', currentDocument);
  console.log('Editor - categoryId:', categoryId, 'type:', typeof categoryId);

  // Debounced cursor line change handler
  const debouncedLineChange = useDebouncedCursorChange(onCursorLineChange, 300);

  // Setup Monaco editor with debounced cursor change handling
  const editor = useMonacoEditor(containerRef, value, onChange, debouncedLineChange);

  // Setup spell checking
  const { progress, suggestionsMap } = useSpellCheck(editor, value, categoryId);

  // Setup keyboard shortcuts (including spell check quick fixes)
  useKeyboardShortcuts(editor, suggestionsMap, () => categoryIdRef.current);

  // Setup intelligent list behavior
  useListBehavior(editor);

  return (
    <div id="editorContainer" style={{ height: "100%", width: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      <MarkdownToolbar editorRef={{ current: editor }} />
      <div id="editor" ref={containerRef} className="has-toolbar" style={{ flex: 1, width: "100%" }} />
      <ProgressIndicator progress={progress} />
    </div>
  );
}
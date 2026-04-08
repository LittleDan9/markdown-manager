import { useRef, useEffect, useState } from 'react';
import { EditorService } from '@/services/editor';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Core editor hook for Monaco setup and basic functionality
 * @param {Object} options
 *   - containerRef: ref to DOM container
 *   - value: initial editor value
 *   - onChange: callback for content changes
 *   - onCursorLineChange: callback for cursor line changes
 * @returns {Object} { editor, isTyping, markAsTyping }
 */
export default function useEditorCore({ containerRef, value, onChange, onCursorLineChange, onSelectionChange, documentId }) {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const [editor, setEditor] = useState(null); // Use state for ready editor
  const lastEditorValue = useRef(value);
  const onChangeRef = useRef(onChange);
  const isSettingValueRef = useRef(false); // Track when WE are setting the value
  const lastChangeSourceRef = useRef('external'); // Track source of last change: 'editor' or 'external'
  const lastDocumentIdRef = useRef(documentId); // Track document ID for same-content switches

  // Keep onChange ref up to date without causing re-renders
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!containerRef.current) return;

    EditorService
      .setup(containerRef.current, '', theme) // DEBUG: Pass empty string instead of value
      .then(editorInstance => {
        editorRef.current = editorInstance;
        editorInstance.setValue(value); // Set value before setting state
        setEditor(editorInstance); // Set state when ready

        // Content changes
        editorInstance.onDidChangeModelContent(() => {
          const newValue = editorInstance.getValue();

          // Skip onChange if we're the ones setting the value (prevents loops)
          if (isSettingValueRef.current) {
            return;
          }

          // Mark that this change came from the editor
          lastChangeSourceRef.current = 'editor';

          // Update tracking reference immediately
          lastEditorValue.current = newValue;

          // Call onChange callback
          if (onChange) onChange(newValue);
        });

        // Cursor position changes
        if (onCursorLineChange) {
          editorInstance.onDidChangeCursorPosition((e) => {
            onCursorLineChange(e.position.lineNumber);
          });
        }

        // Selection changes — emit selected text for chat context
        if (onSelectionChange) {
          editorInstance.onDidChangeCursorSelection((e) => {
            const selection = e.selection;
            if (selection.isEmpty()) {
              onSelectionChange(null);
            } else {
              const text = editorInstance.getModel().getValueInRange(selection);
              onSelectionChange({
                text,
                startLine: selection.startLineNumber,
                endLine: selection.endLineNumber,
              });
            }
          });
        }

        // Expose editor globally for debugging
        window.editorInstance = editorInstance;
      })
      .catch(console.error);

    // Cleanup
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
        setEditor(null); // Clear state
      }
      // No cleanup needed
    };
  }, [containerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme changes
  useEffect(() => {
    if (editorRef.current) {
      EditorService.applyTheme(theme);
    }
  }, [theme]);

  // External value changes - Only respond to truly external changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Detect document switch: if documentId changed, force a reset even if content is identical
    const isDocumentSwitch = documentId !== lastDocumentIdRef.current;
    if (isDocumentSwitch) {
      lastDocumentIdRef.current = documentId;
    }

    // If the last change came from the editor itself, ignore this value prop change
    // This prevents circular updates during typing
    // But always allow document switches through — the user explicitly changed documents
    if (lastChangeSourceRef.current === 'editor' && !isDocumentSwitch) {
      console.log('🔄 Ignoring value prop change - originated from editor');
      lastChangeSourceRef.current = 'external'; // Reset for next change
      return;
    }

    // Check if value actually differs from current editor content
    const currentEditorValue = editor.getValue();

    console.log('🔄 EXTERNAL VALUE EFFECT triggered:', {
      incomingLength: value?.length || 0,
      currentLength: currentEditorValue?.length || 0,
      areEqual: value === currentEditorValue,
      isDocumentSwitch,
      documentId,
      source: lastChangeSourceRef.current,
      timestamp: Date.now()
    });

    // Check for exact equality first — but always update on document switch
    // to reset undo history and cursor position for the new document
    if (value === currentEditorValue && !isDocumentSwitch) {
      lastEditorValue.current = value;
      console.log('✅ Values are equal, skipping update');
      return;
    }

    // Check if this is just a minor difference (like trailing newline)
    // But always update on document switch
    const valueTrimmed = value?.trim();
    const currentTrimmed = currentEditorValue?.trim();
    if (valueTrimmed === currentTrimmed && !isDocumentSwitch) {
      console.log('⚠️ Values differ only in whitespace, skipping update');
      lastEditorValue.current = value;
      return;
    }

    // This is a legitimate external change (document switch, import, etc.)
    console.log('🚨 LEGITIMATE EXTERNAL CHANGE detected, updating editor:', {
      incomingLength: value?.length || 0,
      currentLength: currentEditorValue?.length || 0,
      isDocumentSwitch
    });

    // Mark that we're setting the value to prevent onChange loop
    isSettingValueRef.current = true;

    // Save current position before updating
    const savedPosition = editor.getPosition();
    const savedScrollTop = editor.getScrollTop();

    console.log('💾 Saving position before external update:', {
      position: savedPosition ? `${savedPosition.lineNumber}:${savedPosition.column}` : 'none',
      scrollTop: savedScrollTop
    });

    editor.setValue(value);
    lastEditorValue.current = value;

    // Clear the flag after setValue completes
    isSettingValueRef.current = false;

    // For external changes, we don't restore position - let Monaco handle cursor placement
    // The user expects the cursor to go to a reasonable position for the new content
  }, [value, documentId]);

  return {
    editor // Return state-based editor (null until ready)
    // Simplified: no typing detection to avoid re-renders
  };
}
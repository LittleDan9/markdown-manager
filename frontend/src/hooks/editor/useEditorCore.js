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
export default function useEditorCore({ containerRef, value, onChange, onCursorLineChange }) {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const [editor, setEditor] = useState(null); // Use state for ready editor
  const lastEditorValue = useRef(value);
  const onChangeRef = useRef(onChange);
  const isSettingValueRef = useRef(false); // Track when WE are setting the value
  // No typing detection hook - keep it simple to avoid re-renders

  // Keep onChange ref up to date without causing re-renders
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!containerRef.current) return;

    EditorService
      .setup(containerRef.current, value, theme)
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

  // External value changes - Only for genuine external changes (document loading, etc.)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Check if value actually differs from current editor content
    const currentEditorValue = editor.getValue();

    console.log('useEditorCore: External value effect triggered', {
      incomingValue: value.length,
      currentEditorValue: currentEditorValue.length,
      lastEditorValue: lastEditorValue.current.length,
      areEqual: value === currentEditorValue
    });

    if (value === currentEditorValue) {
      lastEditorValue.current = value;
      console.log('useEditorCore: Values are equal, skipping update');
      return;
    }

    // For document switches and external changes, always update the editor
    // The complex user typing detection was causing issues with document synchronization
    console.log('EXTERNAL VALUE EFFECT: External change detected - updating editor', {
      incomingLength: value.length,
      currentLength: currentEditorValue.length
    });

    // Mark that we're setting the value to prevent onChange loop
    isSettingValueRef.current = true;

    // Safe to update editor content
    const currentPosition = editor.getPosition();
    const currentScrollTop = editor.getScrollTop();

    editor.setValue(value);
    lastEditorValue.current = value;

    // Clear the flag after setValue completes
    isSettingValueRef.current = false;

    // Restore cursor position if we had one
    if (currentPosition) {
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();

        // Ensure position is within bounds
        const safeLineNumber = Math.min(currentPosition.lineNumber, lineCount);
        const lineLength = model.getLineContent(safeLineNumber).length;
        const safeColumn = Math.min(currentPosition.column, lineLength + 1);

        const safePosition = {
          lineNumber: safeLineNumber,
          column: safeColumn
        };

        // Use setTimeout to ensure the position is set after Monaco finishes processing
        setTimeout(() => {
          editor.setPosition(safePosition);
          editor.setScrollTop(currentScrollTop);
        }, 0);
      }
    }
  }, [value]);

  return {
    editor // Return state-based editor (null until ready)
    // Simplified: no typing detection to avoid re-renders
  };
}
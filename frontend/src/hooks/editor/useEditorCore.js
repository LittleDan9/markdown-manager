import { useRef, useEffect, useState } from 'react';
import { EditorService } from '@/services/editor';
import { useTheme } from '@/providers/ThemeProvider';
import { useTypingDetection } from './shared';

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
  const changeTimeoutRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const isSettingValueRef = useRef(false); // Track when WE are setting the value
  // No typing detection hook - keep it simple to avoid re-renders

  // Keep onChange ref up to date without causing re-renders
  onChangeRef.current = onChange;

  // Monaco editor setup
  useEffect(() => {
    if (!containerRef.current) return;

    EditorService
      .setup(containerRef.current, value, theme)
      .then(editorInstance => {
        editorRef.current = editorInstance;
        setEditor(editorInstance); // Set state when ready
        editorInstance.setValue(value);

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
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
        setEditor(null); // Clear state
      }
      // No cleanup needed
    };
  }, [containerRef]); // Simplified dependencies

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
    if (value === currentEditorValue) {
      lastEditorValue.current = value;
      return;
    }

    // Key insight: If lastEditorValue matches the current editor content,
    // then this value change came from user typing (our onChange callback updated the parent).
    // BUT: On initial load, currentEditorValue might be empty while value has content
    const isInitialLoad = currentEditorValue === '' && value !== '';
    const isUserTypingChange = currentEditorValue === lastEditorValue.current && !isInitialLoad;

    if (isUserTypingChange) {
      // This value change came from our own onChange callback - ignore it
      lastEditorValue.current = value; // Keep tracking in sync
      return;
    }

    console.log('EXTERNAL VALUE EFFECT: External change detected', {
      type: isInitialLoad ? 'initial-load' : 'external-change',
      incomingLength: value.length,
      currentLength: currentEditorValue.length,
      lastEditorLength: lastEditorValue.current.length
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

    // Only restore position if not initial load
    if (!isInitialLoad && currentPosition) {
      const model = editor.getModel();
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
  }, [value]);

  return {
    editor // Return state-based editor (null until ready)
    // Simplified: no typing detection to avoid re-renders
  };
}
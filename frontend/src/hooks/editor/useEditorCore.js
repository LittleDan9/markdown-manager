import { useRef, useEffect } from 'react';
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
  const lastEditorValue = useRef(value);
  const { isTyping, markAsTyping, cleanup: cleanupTyping } = useTypingDetection();

  // Monaco editor setup
  useEffect(() => {
    if (!containerRef.current) return;

    EditorService
      .setup(containerRef.current, value, theme)
      .then(editor => {
        editorRef.current = editor;
        editor.setValue(value);

        // Content changes
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();

          // Mark user as typing and reset typing timeout
          markAsTyping();

          // Update tracking reference immediately
          lastEditorValue.current = newValue;

          // Call onChange callback
          if (onChange) onChange(newValue);
        });

        // Cursor position changes
        if (onCursorLineChange) {
          editor.onDidChangeCursorPosition((e) => {
            onCursorLineChange(e.position.lineNumber);
          });
        }

        // Expose editor globally for debugging
        window.editorInstance = editor;
      })
      .catch(console.error);

    // Cleanup
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
      cleanupTyping();
    };
  }, [containerRef, markAsTyping, cleanupTyping]);

  // Theme changes
  useEffect(() => {
    if (editorRef.current) {
      EditorService.applyTheme(theme);
    }
  }, [theme]);

  // External value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastEditorValue.current) return;

    // Do not interfere with editor content while user is actively typing
    if (isTyping) {
      console.log('EXTERNAL VALUE EFFECT: Skipping setValue - user is typing');
      return;
    }

    // Check if value actually differs from current editor content
    const currentEditorValue = editor.getValue();
    if (value === currentEditorValue) {
      lastEditorValue.current = value;
      return;
    }

    // Safe to update editor content
    const currentPosition = editor.getPosition();
    const currentScrollTop = editor.getScrollTop();

    editor.setValue(value);
    lastEditorValue.current = value;

    // Restore cursor position and scroll after setValue
    if (currentPosition) {
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
  }, [value, isTyping]);

  return {
    editor: editorRef.current,
    isTyping,
    markAsTyping
  };
}
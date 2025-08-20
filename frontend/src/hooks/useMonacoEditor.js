import { useEffect, useRef } from 'react';
import EditorSingleton from '../services/EditorService';
import { useTheme } from '@/context/ThemeProvider';

/**
 * Custom hook for Monaco editor setup and lifecycle management
 * @param {Object} containerRef - Ref to the DOM container element
 * @param {string} value - Initial editor value
 * @param {Function} onChange - Callback when editor content changes
 * @param {Function} onCursorLineChange - Callback when cursor line changes
 * @returns {Object} - Monaco editor instance
 */
export default function useMonacoEditor(containerRef, value, onChange, onCursorLineChange) {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const lastEditorValue = useRef(value);

  // Initialize Monaco editor
  useEffect(() => {
    if (!containerRef.current) return;

    EditorSingleton
      .setup(containerRef.current, value, theme)
      .then(editor => {
        editorRef.current = editor;
        editor.setValue(value);

        // Handle content changes
        editor.onDidChangeModelContent(() => {
          const newValue = editor.getValue();
          lastEditorValue.current = newValue;
          if (onChange) {
            onChange(newValue);
          }
        });

        // Handle cursor position changes
        if (onCursorLineChange) {
          editor.onDidChangeCursorPosition((e) => {
            onCursorLineChange(e.position.lineNumber);
          });
        }

        // Expose editor for debugging
        window.editorInstance = editor;
      })
      .catch(console.error);

    // Cleanup function
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, [containerRef]); // Only depend on containerRef

  // Handle theme changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.applyTheme(theme);
    }
  }, [theme]);

  // Handle external value changes (but not internal editor changes)
  useEffect(() => {
    if (!editorRef.current || value === lastEditorValue.current) return;

    const editor = editorRef.current;

    // Save current cursor position before updating value
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
  }, [value]);

  return editorRef.current;
}

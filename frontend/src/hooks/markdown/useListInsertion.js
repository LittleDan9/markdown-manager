import { useCallback } from 'react';
import { useCodeFenceDetection } from './useCodeFenceDetection';

/**
 * Custom hook for list insertion (ordered and unordered lists)
 * Handles line-based list formatting
 */
export function useListInsertion(editorRef) {
  const { isInCodeFence } = useCodeFenceDetection();

  const insertList = useCallback((ordered = false) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);
    const listMarker = ordered ? '1. ' : '- ';

    if (lineContent.trim() === '') {
      // Empty line - add list item
      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: `${listMarker}List item`
        }
      ]);

      // Select "List item" text
      editor.setSelection({
        startLineNumber: position.lineNumber,
        startColumn: listMarker.length + 1,
        endLineNumber: position.lineNumber,
        endColumn: listMarker.length + 10
      });
    } else {
      // Add list marker to existing text
      const newText = `${listMarker}${lineContent.trim()}`;
      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: lineContent.length + 1
          },
          text: newText
        }
      ]);
    }

    editor.focus();
  }, [editorRef, isInCodeFence]);

  return { insertList };
}

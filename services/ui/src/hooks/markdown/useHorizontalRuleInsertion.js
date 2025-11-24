import { useCallback } from 'react';
import { useCodeFenceDetection } from './useCodeFenceDetection';

/**
 * Custom hook for horizontal rule insertion
 * Handles special block element insertion
 */
export function useHorizontalRuleInsertion(editorRef) {
  const { isInCodeFence } = useCodeFenceDetection();

  const insertHorizontalRule = useCallback(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);

    // If current line is not empty, add a new line before the HR
    const hrText = lineContent.trim() === '' ? '---' : '\n---';

    editor.executeEdits('markdown-toolbar', [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: lineContent.length + 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: hrText
      }
    ]);

    // Position cursor after the HR
    const newLineNumber = lineContent.trim() === '' ? position.lineNumber : position.lineNumber + 1;
    editor.setPosition({
      lineNumber: newLineNumber + 1,
      column: 1
    });

    editor.focus();
  }, [editorRef, isInCodeFence]);

  return { insertHorizontalRule };
}

import { useCallback } from 'react';
import { useCodeFenceDetection } from './useCodeFenceDetection';

/**
 * Custom hook for heading insertion (H1, H2, H3, etc.)
 * Handles line-based heading formatting
 */
export function useHeadingInsertion(editorRef) {
  const { isInCodeFence } = useCodeFenceDetection();

  const insertHeading = useCallback((level) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const position = editor.getPosition();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, position)) {
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);
    const headingMarks = '#'.repeat(level);

    // If line is empty or doesn't start with #, add heading
    if (!lineContent.trim() || !lineContent.trim().startsWith('#')) {
      const newText = lineContent.trim() ? `${headingMarks} ${lineContent.trim()}` : `${headingMarks} Heading ${level}`;

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

      // Select the heading text (excluding the # marks)
      editor.setSelection({
        startLineNumber: position.lineNumber,
        startColumn: headingMarks.length + 2,
        endLineNumber: position.lineNumber,
        endColumn: newText.length + 1
      });
    }

    editor.focus();
  }, [editorRef, isInCodeFence]);

  return { insertHeading };
}

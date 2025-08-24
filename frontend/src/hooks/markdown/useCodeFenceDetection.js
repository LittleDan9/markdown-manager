import { useCallback } from 'react';

/**
 * Custom hook for detecting if cursor is inside a code fence
 * Prevents markdown formatting inside code blocks
 */
export function useCodeFenceDetection() {
  const isInCodeFence = useCallback((editor, position) => {
    const model = editor.getModel();
    let inCodeFence = false;

    // Check from start of document to current position
    for (let i = 1; i <= position.lineNumber; i++) {
      const lineContent = model.getLineContent(i);
      if (lineContent.trim().startsWith('```')) {
        inCodeFence = !inCodeFence;
      }
    }

    return inCodeFence;
  }, []);

  return { isInCodeFence };
}

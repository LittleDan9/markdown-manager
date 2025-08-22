import { useCallback } from 'react';

/**
 * Custom hook for markdown insertion logic
 * Handles code fence detection and markdown text manipulation
 */
export function useMarkdownInsertion(editorRef) {
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

  const insertMarkdown = useCallback((before, after = '', placeholder = '') => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();

    // Check if we're in a code fence
    if (isInCodeFence(editor, selection.getStartPosition())) {
      return; // Don't format if in code fence
    }

    const selectedText = model.getValueInRange(selection);

    if (selectedText) {
      // Check if the selected text is already wrapped with this formatting
      const isAlreadyFormatted = selectedText.startsWith(before) && selectedText.endsWith(after);

      if (isAlreadyFormatted && before === after) {
        // Remove formatting for symmetric markers (like ** or * or `)
        const unwrappedText = selectedText.slice(before.length, -after.length);
        editor.executeEdits('markdown-toolbar', [
          {
            range: selection,
            text: unwrappedText
          }
        ]);

        // Set selection to the unwrapped text
        const startPos = selection.getStartPosition();
        const endPos = {
          lineNumber: startPos.lineNumber,
          column: startPos.column + unwrappedText.length
        };
        editor.setSelection({
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column
        });
      } else {
        // Check if text is surrounded by the formatting (with possible whitespace)
        const beforeMarker = before;
        const afterMarker = after;

        // Get extended selection to check for surrounding markers
        const startPos = selection.getStartPosition();
        const endPos = selection.getEndPosition();

        // Extend selection backwards to check for before marker
        const extendedStartPos = {
          lineNumber: startPos.lineNumber,
          column: Math.max(1, startPos.column - beforeMarker.length)
        };

        // Extend selection forwards to check for after marker
        const extendedEndPos = {
          lineNumber: endPos.lineNumber,
          column: endPos.column + afterMarker.length
        };

        const extendedRange = {
          startLineNumber: extendedStartPos.lineNumber,
          startColumn: extendedStartPos.column,
          endLineNumber: extendedEndPos.lineNumber,
          endColumn: extendedEndPos.column
        };

        const extendedText = model.getValueInRange(extendedRange);

        if (extendedText.startsWith(beforeMarker) && extendedText.endsWith(afterMarker)) {
          // Remove the surrounding formatting
          editor.executeEdits('markdown-toolbar', [
            {
              range: extendedRange,
              text: selectedText
            }
          ]);

          // Keep the original text selected
          editor.setSelection({
            startLineNumber: extendedStartPos.lineNumber,
            startColumn: extendedStartPos.column,
            endLineNumber: extendedStartPos.lineNumber,
            endColumn: extendedStartPos.column + selectedText.length
          });
        } else {
          // Add formatting
          const newText = `${before}${selectedText}${after}`;
          editor.executeEdits('markdown-toolbar', [
            {
              range: selection,
              text: newText
            }
          ]);

          // Set cursor after the formatting
          const startPos = selection.getStartPosition();
          const endLine = startPos.lineNumber;
          const endColumn = startPos.column + newText.length;
          editor.setPosition({ lineNumber: endLine, column: endColumn });
        }
      }
    } else {
      // No selection - insert formatting with placeholder
      const position = editor.getPosition();
      const textToInsert = placeholder ? `${before}${placeholder}${after}` : `${before}${after}`;

      editor.executeEdits('markdown-toolbar', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          text: textToInsert
        }
      ]);

      // Position cursor in the middle of the formatting
      const newColumn = position.column + before.length + (placeholder ? placeholder.length : 0);
      editor.setPosition({ lineNumber: position.lineNumber, column: newColumn });

      // If we inserted a placeholder, select it
      if (placeholder) {
        editor.setSelection({
          startLineNumber: position.lineNumber,
          startColumn: position.column + before.length,
          endLineNumber: position.lineNumber,
          endColumn: position.column + before.length + placeholder.length
        });
      }
    }

    editor.focus();
  }, [editorRef, isInCodeFence]);

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

  return {
    insertMarkdown,
    insertHeading,
    insertList,
    insertHorizontalRule
  };
}

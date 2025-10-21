import { useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { isInCodeFence, getListPattern, analyzeOrderedListPattern } from './shared';

/**
 * Hook for handling markdown list behavior (enter key continuation)
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether list behavior is enabled
 * @returns {Object} Hook interface (currently empty, behavior is self-contained)
 */
export default function useEditorListBehavior(editor, enabled = true) {
  useEffect(() => {
    if (!enabled || !editor) return;

    // Main: handleEnterKeyInList
    const handleEnterKeyInList = (editor) => {
      const position = editor.getPosition();
      if (isInCodeFence(editor, position)) return false;

      const model = editor.getModel();
      const lineContent = model.getLineContent(position.lineNumber);
      const listPattern = getListPattern(lineContent);

      if (!listPattern) return false;

      // Empty list item - exit list mode
      if (listPattern.content.trim() === '') {
        editor.executeEdits('list-enter', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: lineContent.length + 1
            },
            text: '\n'
          }
        ]);
        editor.setPosition({
          lineNumber: position.lineNumber + 1,
          column: 1
        });
        return true;
      }

      // Continue list with appropriate marker
      let newMarker;
      if (listPattern.type === 'unordered') {
        newMarker = `${listPattern.marker} `;
      } else {
        const analysis = analyzeOrderedListPattern(editor, position.lineNumber, listPattern.indentation);
        newMarker = `${analysis.nextNumber}. `;
      }

      const newLineText = `\n${listPattern.indentation}${newMarker}`;
      editor.executeEdits('list-enter', [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          },
          text: newLineText
        }
      ]);

      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: listPattern.indentation.length + newMarker.length + 1
      });

      return true;
    };

    // Add onKeyDown event
    const keyDownDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        if (handleEnterKeyInList(editor)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    return () => {
      keyDownDisposable.dispose();
    };
  }, [editor, enabled]);

  return {};
}
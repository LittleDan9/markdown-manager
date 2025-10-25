import { useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  isInCodeFence,
  getListPattern,
  analyzeOrderedListPattern,
  findPreviousIndentationLevel
} from './shared/editorUtils';

/**
 * Hook for handling markdown list behavior (enter key continuation and tab indentation)
 * @param {Object} editor - Monaco editor instance
 * @param {boolean} enabled - Whether list behavior is enabled
 * @returns {Object} Hook interface (currently empty, behavior is self-contained)
 */
export default function useEditorListBehavior(editor, enabled = true) {
  useEffect(() => {
    if (!enabled || !editor) {
      return;
    }

    // Only set up if we have a proper Monaco editor instance
    if (typeof editor.getModel !== 'function' || typeof editor.onKeyDown !== 'function') {
      return;
    }

    // Use onKeyDown for more precise control instead of addCommand
    const keyDownDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        const model = editor.getModel();
        const position = editor.getPosition();

        // Safety checks
        if (!model || !position) {
          return; // Let default behavior handle it
        }

        const lineNumber = position.lineNumber;
        const currentLine = model.getLineContent(lineNumber);
        const lineUpToPosition = currentLine.substring(0, position.column - 1);
        const lineAfterPosition = currentLine.substring(position.column - 1);

        // Don't interfere if we're in a code fence
        if (isInCodeFence(model, lineNumber)) {
          return; // Let default behavior handle it
        }

        // Check the entire current line for list pattern
        const listPattern = getListPattern(currentLine);

        if (listPattern) {
          // Prevent default Enter behavior
          e.preventDefault();
          e.stopPropagation();

          // If the line only contains the list marker (no content), handle smart exit
          if (!listPattern.content.trim()) {
            // If we're at root level (no indentation), exit list completely
            if (listPattern.indentation.length === 0) {
              const range = new monaco.Range(lineNumber, 1, lineNumber, currentLine.length + 1);
              editor.executeEdits('listBehavior', [{
                range,
                text: '\n'
              }]);
              return;
            }

            // Find the previous indentation level
            const currentLevel = Math.floor(listPattern.indentation.length / 2);
            const previousLevel = findPreviousIndentationLevel(editor, lineNumber, currentLevel);

            if (previousLevel === -1) {
              // No previous level found, exit list completely
              const range = new monaco.Range(lineNumber, 1, lineNumber, currentLine.length + 1);
              editor.executeEdits('listBehavior', [{
                range,
                text: '\n'
              }]);
              return;
            }

            // Move to the previous indentation level
            const newIndentation = '  '.repeat(previousLevel);
            let newPrefix;

            if (listPattern.type === 'ordered') {
              // For ordered lists, analyze context at the target level
              const analysis = analyzeOrderedListPattern(editor, lineNumber, newIndentation);
              const contextNumber = analysis.nextNumber || 1;
              newPrefix = `${newIndentation}${contextNumber}. `;
            } else {
              // For unordered lists, use the same marker
              newPrefix = `${newIndentation}${listPattern.marker} `;
            }

            const range = new monaco.Range(lineNumber, 1, lineNumber, currentLine.length + 1);
            editor.executeEdits('listBehavior', [{
              range,
              text: newPrefix
            }]);

            // Position cursor at end of new list marker
            const newPosition = new monaco.Position(lineNumber, newPrefix.length + 1);
            editor.setPosition(newPosition);
            return;
          }

          // Create continuation for next line
          let nextPrefix;

          // Handle ordered lists with smart numbering
          if (listPattern.type === 'ordered') {
            // Check if this is part of a sequential numbered list
            const analysis = analyzeOrderedListPattern(editor, lineNumber, listPattern.indentation);
            if (analysis.allOnes) {
              // User hasn't shown intent for sequential numbering, keep using 1
              nextPrefix = `${listPattern.indentation}1. `;
            } else {
              // User has sequential numbers, continue the sequence
              nextPrefix = `${listPattern.indentation}${analysis.nextNumber}. `;
            }
          } else {
            // Unordered lists - use same marker
            nextPrefix = `${listPattern.indentation}${listPattern.marker} `;
          }

          const edit = {
            range: new monaco.Range(lineNumber, position.column, lineNumber, position.column),
            text: `\n${nextPrefix}`
          };

          // If there's content after cursor, move it to next line without list marker
          if (lineAfterPosition.trim()) {
            edit.text += `\n${lineAfterPosition}`;
            // Remove the content after cursor from current line
            const removeEdit = {
              range: new monaco.Range(lineNumber, position.column, lineNumber, currentLine.length + 1),
              text: ''
            };
            editor.executeEdits('listBehavior', [edit, removeEdit]);
          } else {
            editor.executeEdits('listBehavior', [edit]);
          }
        }
        // If no list pattern, let default Enter behavior happen (don't prevent default)
      }
    });

    // Tab key handler for list indentation
    const tabKeyHandler = editor.addCommand(
      monaco.KeyCode.Tab,
      () => {
        const model = editor.getModel();
        const position = editor.getPosition();
        const lineNumber = position.lineNumber;
        const currentLine = model.getLineContent(lineNumber);

        // Don't interfere if we're in a code fence
        if (isInCodeFence(model, lineNumber)) {
          return false; // Let default behavior handle it
        }

        const listPattern = getListPattern(currentLine);

        if (listPattern) {
          // Add one level of indentation (2 spaces)
          let newPrefix;
          if (listPattern.type === 'ordered') {
            // For ordered lists, reset to 1 at the new indentation level
            newPrefix = `${listPattern.indentation}  1. `;
          } else {
            // For unordered lists, keep the same marker
            newPrefix = `${listPattern.indentation}  ${listPattern.marker} `;
          }
          const newLine = `${newPrefix}${listPattern.content}`;

          const range = new monaco.Range(lineNumber, 1, lineNumber, currentLine.length + 1);
          editor.executeEdits('listBehavior', [{
            range,
            text: newLine
          }]);

          // Move cursor to maintain position relative to content
          const newPosition = new monaco.Position(lineNumber, newPrefix.length + 1);
          editor.setPosition(newPosition);

          return true;
        }

        return false; // Let default behavior handle non-list lines
      }
    );

    // Shift+Tab key handler for list outdentation
    const shiftTabKeyHandler = editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyCode.Tab,
      () => {
        const model = editor.getModel();
        const position = editor.getPosition();
        const lineNumber = position.lineNumber;
        const currentLine = model.getLineContent(lineNumber);

        // Don't interfere if we're in a code fence
        if (isInCodeFence(model, lineNumber)) {
          return false; // Let default behavior handle it
        }

        const listPattern = getListPattern(currentLine);

        if (listPattern) {
          // Check if we can outdent (must have at least 2 spaces in indentation)
          if (listPattern.indentation.length >= 2) {
            // Remove one level of indentation (2 spaces)
            const newIndentation = listPattern.indentation.substring(2);
            let newPrefix;
            if (listPattern.type === 'ordered') {
              // For ordered lists, analyze context to determine appropriate number
              const analysis = analyzeOrderedListPattern(editor, lineNumber, newIndentation);
              const contextNumber = analysis.nextNumber || 1;
              newPrefix = `${newIndentation}${contextNumber}. `;
            } else {
              // For unordered lists, keep the same marker
              newPrefix = `${newIndentation}${listPattern.marker} `;
            }
            const newLine = `${newPrefix}${listPattern.content}`;

            const range = new monaco.Range(lineNumber, 1, lineNumber, currentLine.length + 1);
            editor.executeEdits('listBehavior', [{
              range,
              text: newLine
            }]);

            // Move cursor to maintain position relative to content
            const newPosition = new monaco.Position(lineNumber, newPrefix.length + 1);
            editor.setPosition(newPosition);

            return true;
          }
        }

        return false; // Let default behavior handle non-list lines or when can't outdent
      }
    );

    // Cleanup function
    return () => {
      if (keyDownDisposable) {
        keyDownDisposable.dispose();
      }
      if (tabKeyHandler) {
        tabKeyHandler.dispose();
      }
      if (shiftTabKeyHandler) {
        shiftTabKeyHandler.dispose();
      }
    };
  }, [editor, enabled]);

  return {};
}
import { useEffect } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

/**
 * Custom hook for handling intelligent list behavior in Monaco editor
 * @param {Object} editor - Monaco editor instance
 */
export default function useListBehavior(editor) {
  useEffect(() => {
    if (!editor) return;

    // Helper function to check if we're in a code fence
    const isInCodeFence = (editor, position) => {
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
    };

    // Helper function to detect list patterns
    const getListPattern = (line) => {
      const trimmed = line.trim();

      // Unordered list patterns: -, *, +
      const unorderedMatch = trimmed.match(/^([-*+])\s+(.*)$/);
      if (unorderedMatch) {
        return {
          type: 'unordered',
          marker: unorderedMatch[1],
          content: unorderedMatch[2],
          indentation: line.match(/^(\s*)/)[1]
        };
      }

      // Ordered list patterns: 1., 2., etc. - allow empty content after space
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        return {
          type: 'ordered',
          number: parseInt(orderedMatch[1]),
          content: orderedMatch[2],
          indentation: line.match(/^(\s*)/)[1]
        };
      }

      // Also match just the marker without content (for exit detection)
      const orderedMarkerOnly = trimmed.match(/^(\d+)\.\s*$/);
      if (orderedMarkerOnly) {
        return {
          type: 'ordered',
          number: parseInt(orderedMarkerOnly[1]),
          content: '',
          indentation: line.match(/^(\s*)/)[1]
        };
      }

      const unorderedMarkerOnly = trimmed.match(/^([-*+])\s*$/);
      if (unorderedMarkerOnly) {
        return {
          type: 'unordered',
          marker: unorderedMarkerOnly[1],
          content: '',
          indentation: line.match(/^(\s*)/)[1]
        };
      }

      return null;
    };

    // Helper function to analyze ordered list numbering pattern
    const analyzeOrderedListPattern = (editor, currentLineNumber, indentation) => {
      const model = editor.getModel();
      const listItems = [];

      // Look backwards to find the start of the list
      let startLine = currentLineNumber;
      for (let i = currentLineNumber - 1; i >= 1; i--) {
        const lineContent = model.getLineContent(i);
        const pattern = getListPattern(lineContent);

        if (!pattern || pattern.type !== 'ordered' || pattern.indentation !== indentation) {
          break;
        }
        startLine = i;
        listItems.unshift(pattern.number);
      }

      // Look forwards to include current and subsequent list items
      for (let i = startLine; i <= model.getLineCount(); i++) {
        const lineContent = model.getLineContent(i);
        const pattern = getListPattern(lineContent);

        if (!pattern || pattern.type !== 'ordered' || pattern.indentation !== indentation) {
          break;
        }

        if (i >= startLine) {
          listItems.push(pattern.number);
        }
      }

      // Determine if all items use "1." or if they increment
      const allOnes = listItems.every(num => num === 1);

      return {
        allOnes,
        nextNumber: allOnes ? 1 : Math.max(...listItems) + 1
      };
    };

    // Main function to handle Enter key in lists
    const handleEnterKeyInList = (editor) => {
      const position = editor.getPosition();

      console.log('handleEnterKeyInList called at position:', position);

      // Don't handle if we're in a code fence
      if (isInCodeFence(editor, position)) {
        console.log('In code fence, returning false');
        // Let Monaco handle the default Enter behavior
        return false; // Allow default behavior
      }

      const model = editor.getModel();
      const lineContent = model.getLineContent(position.lineNumber);
      console.log('Current line content:', JSON.stringify(lineContent));

      const listPattern = getListPattern(lineContent);
      console.log('List pattern detected:', listPattern);

      if (!listPattern) {
        console.log('No list pattern, returning false');
        // Not in a list, use default behavior
        return false; // Allow default behavior
      }

      // Check if the current list item is empty (just the marker)
      if (listPattern.content.trim() === '') {
        console.log('Exit list detected - current line:', lineContent);
        console.log('Position:', position);
        console.log('List pattern:', listPattern);

        // Empty list item - replace with just one newline
        editor.executeEdits('list-enter', [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: lineContent.length + 1
            },
            text: '\n' // Replace the list marker line with just one newline
          }
        ]);

        console.log('After edit - setting position to line:', position.lineNumber + 1);

        // Position cursor at the beginning of the new line
        editor.setPosition({
          lineNumber: position.lineNumber + 1,
          column: 1
        });

        return true; // Command handled
      }

      // We have content in the list item, create a new list item
      let newMarker;

      if (listPattern.type === 'unordered') {
        newMarker = `${listPattern.marker} `;
      } else {
        // Ordered list - analyze the pattern
        const analysis = analyzeOrderedListPattern(editor, position.lineNumber, listPattern.indentation);
        newMarker = `${analysis.nextNumber}. `;
      }

      const newLineText = `\n${listPattern.indentation}${newMarker}`;

      // Insert the new line with the list marker
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

      // Position cursor after the new marker
      editor.setPosition({
        lineNumber: position.lineNumber + 1,
        column: listPattern.indentation.length + newMarker.length + 1
      });

      return true; // Command handled
    };

    // Add intelligent list behavior using onKeyDown event
    const keyDownDisposable = editor.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        if (handleEnterKeyInList(editor)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // Cleanup function
    return () => {
      keyDownDisposable.dispose();
    };
  }, [editor]);
}

/**
 * Utility functions for editor behavior
 */

/**
 * Check if cursor is inside a code fence
 * @param {Object} editor - Monaco editor instance
 * @param {Object} position - Cursor position
 * @returns {boolean} True if inside code fence
 */
export function isInCodeFence(editor, position) {
  const model = editor.getModel();
  let inCodeFence = false;

  for (let i = 1; i <= position.lineNumber; i++) {
    const lineContent = model.getLineContent(i);
    if (lineContent.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
    }
  }

  return inCodeFence;
}

/**
 * Get list pattern from a line of text
 * @param {string} line - Line content
 * @returns {Object|null} Pattern object or null if not a list
 */
export function getListPattern(line) {
  const trimmed = line.trim();

  // Unordered list patterns
  const unorderedMatch = trimmed.match(/^([-*+])\s+(.*)$/);
  if (unorderedMatch) {
    return {
      type: 'unordered',
      marker: unorderedMatch[1],
      content: unorderedMatch[2],
      indentation: line.match(/^(\s*)/)[1]
    };
  }

  // Ordered list patterns
  const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (orderedMatch) {
    return {
      type: 'ordered',
      number: parseInt(orderedMatch[1]),
      content: orderedMatch[2],
      indentation: line.match(/^(\s*)/)[1]
    };
  }

  // Empty list markers
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
}

/**
 * Analyze ordered list pattern for smart numbering
 * @param {Object} editor - Monaco editor instance
 * @param {number} currentLineNumber - Current line number
 * @param {string} indentation - Current indentation
 * @returns {Object} Analysis result
 */
export function analyzeOrderedListPattern(editor, currentLineNumber, indentation) {
  const model = editor.getModel();
  const listItems = [];
  let startLine = currentLineNumber;

  // Look backwards for list start
  for (let i = currentLineNumber - 1; i >= 1; i--) {
    const lineContent = model.getLineContent(i);
    const pattern = getListPattern(lineContent);

    if (!pattern || pattern.type !== 'ordered' || pattern.indentation !== indentation) {
      break;
    }

    startLine = i;
    listItems.unshift(pattern.number);
  }

  // Look forwards to get complete list context
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

  const allOnes = listItems.every(num => num === 1);

  return {
    allOnes,
    nextNumber: allOnes ? 1 : Math.max(...listItems) + 1
  };
}
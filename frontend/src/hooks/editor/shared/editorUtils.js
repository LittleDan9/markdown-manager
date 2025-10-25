/**
 * Utility functions for editor behavior
 */

/**
 * Check if cursor is inside a code fence
 * @param {Object} model - Monaco model instance
 * @param {number} lineNumber - Line number to check
 * @returns {boolean} True if inside code fence
 */
export function isInCodeFence(model, lineNumber) {
  if (!model || typeof model.getLineContent !== 'function') {
    return false;
  }

  let inCodeFence = false;

  for (let i = 1; i <= lineNumber; i++) {
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

  // Check for patterns without trimming first (to preserve trailing spaces)
  // Empty list markers with trailing space
  const orderedMarkerWithSpace = line.match(/^(\s*)(\d+)\.\s+$/);
  if (orderedMarkerWithSpace) {
    return {
      type: 'ordered',
      number: parseInt(orderedMarkerWithSpace[2]),
      content: '',
      indentation: orderedMarkerWithSpace[1]
    };
  }

  const unorderedMarkerWithSpace = line.match(/^(\s*)([-*+])\s+$/);
  if (unorderedMarkerWithSpace) {
    return {
      type: 'unordered',
      marker: unorderedMarkerWithSpace[2],
      content: '',
      indentation: unorderedMarkerWithSpace[1]
    };
  }

  // Now check trimmed patterns for content
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
  if (!editor || typeof editor.getModel !== 'function') {
    return { allOnes: false, nextNumber: 1 };
  }

  const model = editor.getModel();
  if (!model) {
    return { allOnes: false, nextNumber: 1 };
  }

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

/**
 * Get the indentation level of a list item (number of 2-space indents)
 * @param {string} indentation - The indentation string
 * @returns {number} The indentation level (0-based)
 */
export function getIndentationLevel(indentation) {
  return Math.floor(indentation.length / 2);
}

/**
 * Create indentation string for a given level
 * @param {number} level - The indentation level (0-based)
 * @returns {string} The indentation string
 */
export function createIndentation(level) {
  return '  '.repeat(Math.max(0, level));
}

/**
 * Check if a line is a list item or can be converted to one
 * @param {string} line - Line content
 * @returns {boolean} True if line is or can be a list item
 */
export function isListItemOrConvertible(line) {
  const trimmed = line.trim();
  // Already a list item
  if (getListPattern(line)) return true;
  // Empty line can be converted
  if (trimmed === '') return true;
  // Any non-empty line can be converted to a list item
  return trimmed.length > 0;
}

/**
 * Convert a line to a list item at the specified indentation level
 * @param {string} line - Original line content
 * @param {number} level - Target indentation level
 * @param {string} marker - List marker ('1.' for ordered, '-' for unordered)
 * @returns {string} Converted line
 */
export function convertToListItem(line, level, marker = '-') {
  const trimmed = line.trim();
  const indentation = createIndentation(level);

  // If already a list item, adjust its indentation
  const existingPattern = getListPattern(line);
  if (existingPattern) {
    return `${indentation}${marker} ${existingPattern.content}`;
  }

  // Convert regular text to list item
  if (trimmed === '') {
    return `${indentation}${marker} `;
  }

  return `${indentation}${marker} ${trimmed}`;
}

/**
 * Increase the indentation of a list item
 * @param {string} line - Original line content
 * @param {number} maxLevel - Maximum allowed indentation level
 * @returns {Object} Result with newLine and newCursorColumn
 */
export function increaseListIndentation(line, maxLevel = 4) {
  const pattern = getListPattern(line);
  if (!pattern) {
    // Convert non-list line to list item at level 0
    const newLine = convertToListItem(line, 0, '-');
    return {
      newLine,
      newCursorColumn: newLine.indexOf(' ') + 1
    };
  }

  const currentLevel = getIndentationLevel(pattern.indentation);
  if (currentLevel >= maxLevel) {
    // Already at max level, don't change
    return {
      newLine: line,
      newCursorColumn: pattern.indentation.length + (pattern.type === 'ordered' ? `${pattern.number}. ` : `${pattern.marker} `).length + 1
    };
  }

  const newLevel = currentLevel + 1;
  const newIndentation = createIndentation(newLevel);
  const marker = pattern.type === 'ordered' ? '1.' : pattern.marker;
  const newLine = `${newIndentation}${marker} ${pattern.content}`;

  return {
    newLine,
    newCursorColumn: newIndentation.length + (marker === '1.' ? '1. ' : `${marker} `).length + 1
  };
}

/**
 * Decrease the indentation of a list item
 * @param {string} line - Original line content
 * @returns {Object} Result with newLine and newCursorColumn
 */
export function decreaseListIndentation(line) {
  const pattern = getListPattern(line);
  if (!pattern) {
    // Not a list item, no change
    return {
      newLine: line,
      newCursorColumn: 1
    };
  }

  const currentLevel = getIndentationLevel(pattern.indentation);
  if (currentLevel === 0) {
    // Already at root level, don't change
    return {
      newLine: line,
      newCursorColumn: pattern.indentation.length + (pattern.type === 'ordered' ? `${pattern.number}. ` : `${pattern.marker} `).length + 1
    };
  }

  const newLevel = currentLevel - 1;
  const newIndentation = createIndentation(newLevel);
  const marker = pattern.type === 'ordered' ? '1.' : pattern.marker;
  const newLine = `${newIndentation}${marker} ${pattern.content}`;

  return {
    newLine,
    newCursorColumn: newIndentation.length + (marker === '1.' ? '1. ' : `${marker} `).length + 1
  };
}

/**
 * Find the previous indentation level for fallback behavior
 * @param {Object} editor - Monaco editor instance
 * @param {number} currentLineNumber - Current line number
 * @param {number} currentLevel - Current indentation level
 * @returns {number} Previous indentation level, or -1 if should exit list mode
 */
export function findPreviousIndentationLevel(editor, currentLineNumber, currentLevel) {
  if (!editor || typeof editor.getModel !== 'function') {
    return -1;
  }

  const model = editor.getModel();
  if (!model) {
    return -1;
  }

  // Look backwards for a list item with lower indentation
  for (let i = currentLineNumber - 1; i >= 1; i--) {
    const lineContent = model.getLineContent(i);
    const pattern = getListPattern(lineContent);

    if (pattern) {
      const level = getIndentationLevel(pattern.indentation);
      if (level < currentLevel) {
        return level;
      }
    }
  }

  // If no previous level found, should exit list mode
  return -1;
}
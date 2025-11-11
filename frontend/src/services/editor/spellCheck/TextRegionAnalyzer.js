// src/services/editor/spellCheck/TextRegionAnalyzer.js

/**
 * Service for analyzing text changes and determining regions for spell checking
 */
export default class TextRegionAnalyzer {
  /**
   * Compute the changed region between prevValue and newValue, using the editor's selection/cursor if available.
   * - If prevValue is empty, scan the whole doc.
   * - If only a small region changed, scan from a few words before the change to the end of the line.
   * - If editor is provided, use its selection/cursor to refine the region.
   * Returns { regionText, startOffset } for spell checking.
   *
   * @param {Object} editor - Monaco editor instance
   * @param {string} prevValue - Previous text value
   * @param {string} newValue - New text value
   * @param {number} fullTextThreshold - Threshold for doing full text scan
   * @returns {Object} Object with regionText and startOffset
   */
  static getChangedRegion(editor, prevValue, newValue, fullTextThreshold = 2000) {
    if (!prevValue || prevValue.length === 0) {
      // Full scan if no previous value
      return { regionText: newValue, startOffset: 0 };
    }
    if (prevValue === newValue) {
      return { regionText: '', startOffset: 0 };
    }

    // For small documents, always do full scan to avoid positioning issues
    if (newValue.length <= fullTextThreshold) {
      return { regionText: newValue, startOffset: 0 };
    }

    // Find first and last changed indices
    let start = 0;
    const endPrev = prevValue.length;
    const endNew = newValue.length;
    while (start < endPrev && start < endNew && prevValue[start] === newValue[start]) {
      start++;
    }

    // Find end of change (from end)
    let tailPrev = endPrev - 1;
    let tailNew = endNew - 1;
    while (tailPrev >= start && tailNew >= start && prevValue[tailPrev] === newValue[tailNew]) {
      tailPrev--;
      tailNew--;
    }

    // Expand to word boundaries and line boundaries for better context
    let scanStart = start;
    let scanEnd = tailNew + 1;

    // Expand start to beginning of paragraph or sentence
    while (scanStart > 0 && !/[\n\r]/.test(newValue[scanStart - 1])) {
      scanStart--;
    }

    // Expand end to end of paragraph or sentence
    while (scanEnd < newValue.length && !/[\n\r]/.test(newValue[scanEnd])) {
      scanEnd++;
    }

    // If editor is available, expand to include the visible area around cursor
    if (editor && typeof editor.getSelection === 'function') {
      const expandedRegion = this._expandRegionAroundCursor(editor, scanStart, scanEnd);
      scanStart = expandedRegion.start;
      scanEnd = expandedRegion.end;
    }

    // Ensure we don't exceed document bounds
    scanStart = Math.max(0, scanStart);
    scanEnd = Math.min(newValue.length, scanEnd);

    // If the region is still large relative to the document, just scan the whole thing
    const regionSize = scanEnd - scanStart;
    if (regionSize > fullTextThreshold * 0.7) {
      return { regionText: newValue, startOffset: 0 };
    }

    return { regionText: newValue.slice(scanStart, scanEnd), startOffset: scanStart };
  }

  /**
   * Expand the region to include lines around the cursor for better context
   * @param {Object} editor - Monaco editor instance
   * @param {number} currentStart - Current start offset
   * @param {number} currentEnd - Current end offset
   * @returns {Object} Object with expanded start and end offsets
   * @private
   */
  static _expandRegionAroundCursor(editor, currentStart, currentEnd) {
    const sel = editor.getSelection();
    if (!sel) {
      return { start: currentStart, end: currentEnd };
    }

    const model = editor.getModel();
    const startPos = sel.getStartPosition();
    const endPos = sel.getEndPosition();

    // Expand to include a few lines around the cursor for context
    const expandLines = 3;
    const expandStartLine = Math.max(1, startPos.lineNumber - expandLines);
    const expandEndLine = Math.min(model.getLineCount(), endPos.lineNumber + expandLines);

    const selStartOffset = model.getOffsetAt({ lineNumber: expandStartLine, column: 1 });
    const selEndOffset = model.getOffsetAt({
      lineNumber: expandEndLine,
      column: model.getLineMaxColumn(expandEndLine)
    });

    // Use the expanded selection if it makes sense
    return {
      start: Math.min(currentStart, selStartOffset),
      end: Math.max(currentEnd, selEndOffset)
    };
  }
}

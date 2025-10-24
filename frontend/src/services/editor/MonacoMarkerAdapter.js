// src/services/editor/MonacoMarkerAdapter.js
import * as monaco from 'monaco-editor';
import SpellCheckMarkers from './SpellCheckMarkers';

/**
 * Service for converting spell check issues to Monaco markers
 */
export default class MonacoMarkerAdapter {
  /**
   * Convert spell check issues to Monaco markers and update the suggestions map
   * @param {Object} editor - Monaco editor instance
   * @param {Array} issues - Array of spell check issues
   * @param {number} startOffset - Offset where the scanned region starts
   * @param {Map} prevSuggestionsMap - Previous suggestions map to preserve
   * @returns {Map} Updated suggestions map
   */
  static toMonacoMarkers(editor, issues, startOffset, prevSuggestionsMap = new Map()) {
    // Guard against Monaco not being loaded
    if (!monaco || !monaco.editor) {
      console.warn('Monaco editor not fully loaded, skipping marker creation');
      return new Map();
    }

    const model = editor.getModel();
    if (!model) {
      console.warn('Editor model not available, skipping marker creation');
      return new Map();
    }

    const oldMarkers = SpellCheckMarkers.getExistingMarkers(model);
    const newMarkers = [];
    const newSuggestions = new Map();

    let filteredOld = [];
    if (startOffset === 0) {
      // Full document scan - clear all spell markers
      filteredOld = [];
      newSuggestions.clear();
    } else {
      // Regional scan - calculate the actual region bounds more carefully
      const regionEndOffset = this._calculateRegionEndOffset(startOffset, issues);

      // Keep markers outside the scanned region
      filteredOld = SpellCheckMarkers.filterMarkersOutsideRegion(
        oldMarkers,
        model,
        startOffset,
        regionEndOffset
      );

      // Preserve suggestions for markers we're keeping
      this._preserveExistingSuggestions(filteredOld, prevSuggestionsMap, newSuggestions);
    }

    // Build fresh markers + suggestion map for new issues
    const createdMarkers = this._createMarkersFromIssues(model, issues, startOffset, newSuggestions);
    newMarkers.push(...createdMarkers);

    // Apply combined markers
    SpellCheckMarkers.applyMarkers(model, filteredOld.concat(newMarkers));

    return newSuggestions;
  }

  /**
   * Create Monaco markers from spell check issues
   * @param {Object} model - Monaco editor model
   * @param {Array} issues - Array of spell check issues
   * @param {number} startOffset - Start offset for the region
   * @param {Map} suggestionsMap - Map to store suggestions
   * @returns {Array} Array of Monaco markers
   * @private
   */
  static _createMarkersFromIssues(model, issues, startOffset, suggestionsMap) {
    const markers = [];

    for (const issue of issues) {
      try {
        const marker = this._createMarkerFromIssue(model, issue, startOffset);
        if (marker) {
          markers.push(marker);

          // Store full issue information for quick fixes (includes type)
          const key = `${marker.startLineNumber}:${marker.startColumn}`;
          suggestionsMap.set(key, {
            suggestions: issue.suggestions || [],
            type: issue.type || 'spelling',
            message: issue.message,
            rule: issue.rule
          });
        } else {
          console.warn(`❌ Failed to create marker for "${issue.word}" (${issue.type})`);
        }
      } catch (error) {
        console.warn('Error creating marker for spell issue:', error, issue);
      }
    }

    return markers;
  }

  /**
   * Create a single Monaco marker from a spell check issue
   * @param {Object} model - Monaco editor model
   * @param {Object} issue - Spell check issue
   * @param {number} startOffset - Start offset for the region
   * @returns {Object|null} Monaco marker or null if creation failed
   * @private
   */
  static _createMarkerFromIssue(model, issue, startOffset) {
    // Handle both old format (issue.offset) and new backend format (issue.position.start)
    let globalOffset;
    let wordLength;

    if (issue.position && typeof issue.position.start === 'number') {
      // New backend format - position already contains global offset
      globalOffset = issue.position.start;
      wordLength = issue.position.end - issue.position.start;
    } else if (typeof issue.offset === 'number') {
      // Old format - offset relative to startOffset
      globalOffset = startOffset + issue.offset;
      wordLength = issue.word ? issue.word.length : 1;
    } else {
      console.warn('❌ Spell check issue missing position information:', issue);
      return null;
    }

    // Apply code fence offset correction if needed
    const adjustedPosition = this._adjustPositionForCodeFences(model, globalOffset, wordLength, issue);
    if (adjustedPosition) {
      globalOffset = adjustedPosition.globalOffset;
      wordLength = adjustedPosition.wordLength;
    }

    const pos = model.getPositionAt(globalOffset);
    const endPos = model.getPositionAt(globalOffset + wordLength);

    // Create appropriate message based on issue type
    let msg;
    switch (issue.type) {
      case 'spelling':
        // For spelling: "word" → suggestion1, suggestion2, suggestion3
        const spellingSuggestions = issue.suggestions?.slice(0, 3).join(', ') || 'no suggestions';
        msg = `"${issue.word}" → ${spellingSuggestions}`;
        break;
      case 'grammar':
        // For grammar: Use the descriptive message from backend, truncate if too long
        if (issue.message && issue.message.length > 60) {
          msg = issue.message.substring(0, 57) + '...';
        } else {
          msg = issue.message || `Grammar issue: "${issue.word}"`;
        }
        break;
      case 'style':
        // For style: Use the descriptive message from backend, truncate if too long
        if (issue.message && issue.message.length > 60) {
          msg = issue.message.substring(0, 57) + '...';
        } else {
          msg = issue.message || `Style suggestion: "${issue.word}"`;
        }
        break;
      default:
        // Legacy format
        const defaultSuggestions = issue.suggestions?.slice(0, 3).join(', ') || 'no suggestions';
        msg = `"${issue.word}" → ${defaultSuggestions}`;
    }

    // Determine severity based on issue type
    let severity;
    switch (issue.type) {
      case 'spelling':
        severity = monaco.MarkerSeverity.Error; // Red squiggles for spelling errors
        break;
      case 'grammar':
        severity = monaco.MarkerSeverity.Warning; // Yellow squiggles for grammar issues
        break;
      case 'style':
        severity = monaco.MarkerSeverity.Info; // Blue squiggles for style suggestions
        break;
      case 'code-comment':
      case 'code-string':
      case 'code-identifier':
        severity = monaco.MarkerSeverity.Error; // Red squiggles for code spell issues (same as regular spelling)
        break;
      default:
        severity = monaco.MarkerSeverity.Warning;
    }

    return {
      severity: severity,
      message: msg,
      startLineNumber: pos.lineNumber,
      startColumn: pos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
      type: issue.type, // Add type for proper categorization in SpellCheckMarkers
    };
  }

  /**
   * Preserve suggestions for existing markers that are being kept
   * @param {Array} existingMarkers - Array of existing markers to preserve
   * @param {Map} prevSuggestionsMap - Previous suggestions map
   * @param {Map} newSuggestionsMap - New suggestions map to populate
   * @private
   */
  static _preserveExistingSuggestions(existingMarkers, prevSuggestionsMap, newSuggestionsMap) {
    existingMarkers.forEach(marker => {
      const key = `${marker.startLineNumber}:${marker.startColumn}`;
      if (prevSuggestionsMap.has(key)) {
        newSuggestionsMap.set(key, prevSuggestionsMap.get(key));
      }
    });
  }

  /**
   * Calculate the end offset of a region based on issues found
   * @param {number} startOffset - Start offset of the region
   * @param {Array} issues - Array of spell check issues
   * @returns {number} End offset of the region
   * @private
   */
  static _calculateRegionEndOffset(startOffset, issues) {
    if (!issues || issues.length === 0) {
      return startOffset;
    }

    return Math.max(
      ...issues.map(issue => {
        if (issue.position && typeof issue.position.end === 'number') {
          // New backend format - position contains global offset
          return issue.position.end;
        } else if (typeof issue.offset === 'number') {
          // Old format - offset relative to startOffset
          return startOffset + issue.offset + (issue.word ? issue.word.length : 0);
        } else {
          return startOffset;
        }
      })
    );
  }

  /**
   * Adjust position for code fence content when Monaco displays only the code content
   * This handles cases where spell check was done on full markdown but Monaco shows extracted code
   * @param {Object} model - Monaco editor model
   * @param {number} globalOffset - Original global offset
   * @param {number} wordLength - Length of the word
   * @param {Object} issue - Spell check issue
   * @returns {Object|null} Adjusted position or null if no adjustment needed
   * @private
   */
  static _adjustPositionForCodeFences(model, globalOffset, wordLength, issue) {
    // Only adjust for code-related issues (code-comment, code-string, code-identifier)
    if (!issue.type || !issue.type.includes('code')) {
      return null;
    }

    const fullText = model.getValue();
    const textAtPosition = fullText.substring(globalOffset, globalOffset + wordLength);

    // If the position already matches the expected word, no adjustment needed
    if (textAtPosition === issue.word) {
      return null;
    }

    // Look for code fence patterns around the issue position
    const beforeText = fullText.substring(0, globalOffset);
    // Pattern to match various fence formats: ```language\n, ```\n, ``` \n, etc.
    const fencePattern = /```[^\n]*\n/g;
    let match;
    let cumulativeOffset = 0;

    // Count all code fence opening delimiters before this position
    while ((match = fencePattern.exec(beforeText)) !== null) {
      // Each fence opener adds its length to the offset difference
      cumulativeOffset += match[0].length;
    }

    if (cumulativeOffset > 0) {
      const adjustedGlobalOffset = globalOffset - cumulativeOffset;
      const adjustedText = fullText.substring(adjustedGlobalOffset, adjustedGlobalOffset + wordLength);

      // Only apply adjustment if it improves the match
      if (adjustedText === issue.word || adjustedText.includes(issue.word)) {
        return {
          globalOffset: adjustedGlobalOffset,
          wordLength: wordLength,
          offsetAdjustment: cumulativeOffset
        };
      }
    }

    // Try searching for the word near the original position if simple offset didn't work
    const searchRadius = 100; // Search within 100 characters
    const searchStart = Math.max(0, globalOffset - searchRadius);
    const searchEnd = Math.min(fullText.length, globalOffset + searchRadius);
    const searchText = fullText.substring(searchStart, searchEnd);
    const wordIndex = searchText.indexOf(issue.word);

    if (wordIndex !== -1) {
      const correctedOffset = searchStart + wordIndex;
      return {
        globalOffset: correctedOffset,
        wordLength: issue.word.length,
        offsetAdjustment: globalOffset - correctedOffset
      };
    }

    return null;
  }
}

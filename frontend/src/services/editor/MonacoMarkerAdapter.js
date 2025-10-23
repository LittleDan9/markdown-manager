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
    console.log('MonacoMarkerAdapter: Creating marker from issue:', JSON.stringify(issue, null, 2));

    // Handle both old format (issue.offset) and new backend format (issue.position.start)
    let globalOffset;
    let wordLength;

    if (issue.position && typeof issue.position.start === 'number') {
      // New backend format - position already contains global offset
      globalOffset = issue.position.start;
      wordLength = issue.position.end - issue.position.start;
      console.log('MonacoMarkerAdapter: Backend position data:', {
        start: issue.position.start,
        end: issue.position.end,
        calculatedLength: wordLength
      });
    } else if (typeof issue.offset === 'number') {
      // Old format - offset relative to startOffset
      globalOffset = startOffset + issue.offset;
      wordLength = issue.word ? issue.word.length : 1;
    } else {
      console.warn('Spell check issue missing position information:', issue);
      return null;
    }

    const pos = model.getPositionAt(globalOffset);
    console.log('MonacoMarkerAdapter: Position conversion:', {
      globalOffset,
      wordLength,
      convertedPosition: pos,
      endColumn: pos.column + wordLength
    });

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
      default:
        severity = monaco.MarkerSeverity.Warning;
    }

    return {
      owner: 'spell',
      severity: severity,
      message: msg,
      startLineNumber: pos.lineNumber,
      startColumn: pos.column,
      endLineNumber: pos.lineNumber,
      endColumn: pos.column + wordLength,
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
}

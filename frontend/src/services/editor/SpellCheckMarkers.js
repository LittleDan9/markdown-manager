// src/services/editor/SpellCheckMarkers.js
import * as monaco from 'monaco-editor';

/**
 * Service for managing spell check markers in Monaco editor
 * Phase 5: Enhanced with support for different analysis types (spelling, grammar, style)
 */
export default class SpellCheckMarkers {
  /**
   * Clear all spell check markers from the Monaco editor
   * @param {Object} editor - Monaco editor instance
   * @param {Map} suggestionsMap - The suggestions map to clear
   */
  static clearMarkers(editor, suggestionsMap = null) {
    if (!editor || typeof editor.getModel !== 'function') return;
    
    // Guard against Monaco not being loaded
    if (!monaco || !monaco.editor) {
      console.warn('Monaco editor not fully loaded, skipping marker clearing');
      return;
    }

    const model = editor.getModel();
    if (model) {
      // Clear markers for all analysis types
      monaco.editor.setModelMarkers(model, 'spell', []);
      monaco.editor.setModelMarkers(model, 'grammar', []);
      monaco.editor.setModelMarkers(model, 'style', []);
      
      if (suggestionsMap) {
        suggestionsMap.clear();
      }
    }
  }

  /**
   * Get existing spell check markers for a model
   * @param {Object} model - Monaco editor model
   * @returns {Array} Array of existing spell check markers
   */
  static getExistingMarkers(model) {
    if (!monaco || !monaco.editor || !model) {
      return [];
    }
    
    return monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => ['spell', 'grammar', 'style'].includes(m.owner));
  }

  /**
   * Filter markers that are outside a specific region
   * @param {Array} markers - Array of Monaco markers
   * @param {Object} model - Monaco editor model
   * @param {number} startOffset - Start offset of the region
   * @param {number} endOffset - End offset of the region
   * @returns {Array} Filtered markers outside the region
   */
  static filterMarkersOutsideRegion(markers, model, startOffset, endOffset) {
    return markers.filter(m => {
      const markerStart = model.getOffsetAt({ 
        lineNumber: m.startLineNumber, 
        column: m.startColumn 
      });
      const markerEnd = model.getOffsetAt({ 
        lineNumber: m.endLineNumber, 
        column: m.endColumn 
      });
      return markerEnd < startOffset || markerStart > endOffset;
    });
  }

  /**
   * Apply markers to the Monaco editor model with proper categorization
   * @param {Object} model - Monaco editor model
   * @param {Array} markers - Array of markers to apply
   */
  static applyMarkers(model, markers) {
    if (!monaco || !monaco.editor || !model) {
      console.warn('Monaco editor not available for applying markers');
      return;
    }

    // Phase 5: Separate markers by type for proper visual differentiation
    const spellingMarkers = [];
    const grammarMarkers = [];
    const styleMarkers = [];

    markers.forEach(marker => {
      switch (marker.type) {
        case 'spelling':
          spellingMarkers.push(marker);
          break;
        case 'grammar':
          grammarMarkers.push(marker);
          break;
        case 'style':
          styleMarkers.push(marker);
          break;
        default:
          // Default to spelling for backward compatibility
          spellingMarkers.push(marker);
      }
    });

    // Apply markers with appropriate owners for different visual styles
    monaco.editor.setModelMarkers(model, 'spell', spellingMarkers);
    monaco.editor.setModelMarkers(model, 'grammar', grammarMarkers);
    monaco.editor.setModelMarkers(model, 'style', styleMarkers);
  }

  /**
   * Convert spell check issues to Monaco markers with appropriate severity
   * @param {Array} issues - Array of spell check issues
   * @param {Object} model - Monaco editor model
   * @returns {Array} Array of Monaco markers
   */
  static convertIssuesToMarkers(issues, model) {
    if (!model || !Array.isArray(issues)) {
      return [];
    }

    return issues.map(issue => {
      // Calculate position
      const startPos = model.getPositionAt(issue.position.start);
      const endPos = model.getPositionAt(issue.position.end);

      // Determine severity based on issue type
      let severity;
      switch (issue.type) {
        case 'spelling':
          severity = monaco.MarkerSeverity.Error;   // Red squiggles
          break;
        case 'grammar':
          severity = monaco.MarkerSeverity.Warning; // Yellow squiggles
          break;
        case 'style':
          severity = monaco.MarkerSeverity.Info;    // Blue squiggles
          break;
        default:
          severity = monaco.MarkerSeverity.Error;
      }

      return {
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        message: this.formatIssueMessage(issue),
        severity: severity,
        source: `markdown-manager-${issue.type}`,
        type: issue.type, // Add type for categorization
        // Store suggestions for quick fixes
        suggestions: issue.suggestions || [],
        word: issue.word
      };
    });
  }

  /**
   * Format issue message for display in Monaco
   * @param {Object} issue - Spell check issue
   * @returns {string} Formatted message
   */
  static formatIssueMessage(issue) {
    const typeLabel = issue.type === 'spelling' ? 'Spelling' :
                     issue.type === 'grammar' ? 'Grammar' :
                     issue.type === 'style' ? 'Style' : 'Issue';

    let message = `${typeLabel}: ${issue.word || 'Issue detected'}`;

    if (issue.suggestions && issue.suggestions.length > 0) {
      const suggestionText = issue.suggestions.slice(0, 3).join(', ');
      message += ` (suggestions: ${suggestionText})`;
    }

    return message;
  }

  /**
   * Get markers by type
   * @param {Object} model - Monaco editor model
   * @param {string} type - Marker type ('spell', 'grammar', 'style')
   * @returns {Array} Array of markers of the specified type
   */
  static getMarkersByType(model, type) {
    if (!monaco || !monaco.editor || !model) {
      return [];
    }
    
    return monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => m.owner === type);
  }

  /**
   * Toggle markers visibility by type
   * @param {Object} model - Monaco editor model
   * @param {string} type - Marker type to toggle
   * @param {boolean} visible - Whether markers should be visible
   * @param {Array} allIssues - All issues to restore from if making visible
   */
  static toggleMarkersByType(model, type, visible, allIssues = []) {
    if (!monaco || !monaco.editor || !model) {
      return;
    }

    if (visible) {
      // Restore markers of this type
      const typeIssues = allIssues.filter(issue => issue.type === type);
      const markers = this.convertIssuesToMarkers(typeIssues, model);
      monaco.editor.setModelMarkers(model, type, markers);
    } else {
      // Clear markers of this type
      monaco.editor.setModelMarkers(model, type, []);
    }
  }
}

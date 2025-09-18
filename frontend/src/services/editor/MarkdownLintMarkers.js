/**
 * MarkdownLintMarkers - Monaco marker management for markdown linting
 * 
 * Handles conversion of linting issues to Monaco editor markers and
 * manages marker lifecycle (create, update, clear).
 */

export class MarkdownLintMarkers {
  constructor() {
    this.markerOwner = 'markdownlint';
  }

  /**
   * Convert linting issues to Monaco markers and set them on the editor
   * @param {Object} editor - Monaco editor instance
   * @param {Array} issues - Array of linting issues
   * @param {number} startOffset - Character offset for chunk processing
   * @param {Map} prevMarkersMap - Previous markers map for comparison
   * @returns {Map} Map of markers for this update
   */
  setMarkers(editor, issues, startOffset = 0, prevMarkersMap = new Map()) {
    if (!editor || !Array.isArray(issues)) {
      return new Map();
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return new Map();
      }

      // Convert issues to Monaco markers
      const markers = this.issuesToMarkers(model, issues, startOffset);
      
      // Set markers on the model
      this.monaco.editor.setModelMarkers(model, this.markerOwner, markers);

      // Create markers map for quick lookup
      const markersMap = new Map();
      markers.forEach((marker, index) => {
        const key = `${marker.startLineNumber}-${marker.startColumn}-${marker.message}`;
        markersMap.set(key, {
          ...marker,
          id: `${this.markerOwner}-${index}`,
          issue: issues[index]
        });
      });

      console.log(`MarkdownLintMarkers: Set ${markers.length} markers`);
      return markersMap;

    } catch (error) {
      console.error('MarkdownLintMarkers: Failed to set markers:', error);
      return new Map();
    }
  }

  /**
   * Clear all markdown lint markers from the editor
   * @param {Object} editor - Monaco editor instance
   * @param {Map} markersMap - Current markers map
   */
  clearMarkers(editor, markersMap = new Map()) {
    if (!editor) {
      return;
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      // Clear all markers for this owner
      this.monaco.editor.setModelMarkers(model, this.markerOwner, []);
      
      if (markersMap) {
        markersMap.clear();
      }

      console.log('MarkdownLintMarkers: Cleared all markers');

    } catch (error) {
      console.error('MarkdownLintMarkers: Failed to clear markers:', error);
    }
  }

  /**
   * Convert linting issues to Monaco editor markers
   * @param {Object} model - Monaco editor model
   * @param {Array} issues - Array of linting issues
   * @param {number} startOffset - Character offset for positioning
   * @returns {Array} Array of Monaco marker objects
   */
  issuesToMarkers(model, issues, startOffset = 0) {
    const markers = [];

    for (const issue of issues) {
      try {
        const marker = this.issueToMarker(model, issue, startOffset);
        if (marker) {
          markers.push(marker);
        }
      } catch (error) {
        console.warn('MarkdownLintMarkers: Failed to convert issue to marker:', error, issue);
      }
    }

    return markers;
  }

  /**
   * Convert a single linting issue to a Monaco marker
   * @param {Object} model - Monaco editor model
   * @param {Object} issue - Linting issue object
   * @param {number} startOffset - Character offset
   * @returns {Object|null} Monaco marker object or null
   */
  issueToMarker(model, issue, startOffset = 0) {
    if (!issue || typeof issue.line !== 'number') {
      return null;
    }

    try {
      // Adjust line number for 1-based indexing and offset
      const lineNumber = Math.max(1, issue.line);
      
      // Ensure line number is within model bounds
      const lineCount = model.getLineCount();
      if (lineNumber > lineCount) {
        return null;
      }

      // Get line content for column calculation
      const lineContent = model.getLineContent(lineNumber);
      const lineLength = lineContent.length;

      // Calculate column positions
      let startColumn = 1;
      let endColumn = lineLength + 1;

      // Use issue column if provided
      if (typeof issue.column === 'number' && issue.column > 0) {
        startColumn = Math.min(issue.column, lineLength + 1);
        
        // Calculate end column based on length or default to line end
        if (typeof issue.length === 'number' && issue.length > 0) {
          endColumn = Math.min(startColumn + issue.length, lineLength + 1);
        } else {
          // Default to highlighting entire line for better visibility
          endColumn = lineLength + 1;
        }
      }

      // Determine severity based on issue type or rule
      const severity = this.getMarkerSeverity(issue);

      return {
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
        message: this.formatMarkerMessage(issue),
        severity,
        source: 'markdownlint',
        code: issue.rule || issue.ruleNames?.[0] || 'unknown'
      };

    } catch (error) {
      console.warn('MarkdownLintMarkers: Failed to process issue:', error, issue);
      return null;
    }
  }

  /**
   * Get Monaco marker severity for an issue
   * @param {Object} issue - Linting issue
   * @returns {number} Monaco marker severity
   */
  getMarkerSeverity(issue) {
    // Access Monaco's MarkerSeverity enum
    const MarkerSeverity = this.monaco?.MarkerSeverity || {
      Error: 8,
      Warning: 4,
      Info: 2,
      Hint: 1
    };

    // Most markdown lint issues are warnings
    // Could be extended to categorize by rule type
    if (issue.severity === 'error') {
      return MarkerSeverity.Error;
    } else if (issue.severity === 'info') {
      return MarkerSeverity.Info;
    } else if (issue.severity === 'hint') {
      return MarkerSeverity.Hint;
    }

    return MarkerSeverity.Warning;
  }

  /**
   * Format issue message for display in marker
   * @param {Object} issue - Linting issue
   * @returns {string} Formatted message
   */
  formatMarkerMessage(issue) {
    const rule = issue.rule || issue.ruleNames?.[0] || 'unknown';
    const message = issue.message || issue.description || 'Markdown lint issue';
    
    return `${rule}: ${message}`;
  }

  /**
   * Set Monaco reference for accessing editor APIs
   * @param {Object} monaco - Monaco editor namespace
   */
  setMonaco(monaco) {
    this.monaco = monaco;
  }

  /**
   * Get markers for a specific line range
   * @param {Map} markersMap - Current markers map
   * @param {number} startLine - Start line number
   * @param {number} endLine - End line number  
   * @returns {Array} Array of markers in the range
   */
  getMarkersInRange(markersMap, startLine, endLine) {
    const markersInRange = [];

    for (const marker of markersMap.values()) {
      if (marker.startLineNumber >= startLine && marker.startLineNumber <= endLine) {
        markersInRange.push(marker);
      }
    }

    return markersInRange;
  }

  /**
   * Get marker at specific position
   * @param {Map} markersMap - Current markers map
   * @param {number} lineNumber - Line number
   * @param {number} column - Column number
   * @returns {Object|null} Marker at position or null
   */
  getMarkerAtPosition(markersMap, lineNumber, column) {
    for (const marker of markersMap.values()) {
      if (marker.startLineNumber === lineNumber &&
          column >= marker.startColumn &&
          column <= marker.endColumn) {
        return marker;
      }
    }

    return null;
  }
}

// Export singleton instance
export default new MarkdownLintMarkers();
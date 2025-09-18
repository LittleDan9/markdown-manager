/**
 * MarkdownLintMarkerAdapter - Convert linting issues to Monaco editor markers
 * 
 * Provides utilities for converting markdown linting issues into Monaco editor
 * markers with proper positioning, styling, and metadata.
 */

export class MarkdownLintMarkerAdapter {
  /**
   * Convert linting issues to Monaco markers with proper offset handling
   * @param {Object} editor - Monaco editor instance
   * @param {Array} issues - Array of linting issues
   * @param {number} startOffset - Character offset for chunk processing
   * @param {Map} prevMarkersMap - Previous markers map for comparison
   * @returns {Map} Map of markers for quick lookup
   */
  static toMonacoMarkers(editor, issues, startOffset = 0, prevMarkersMap = new Map()) {
    if (!editor || !Array.isArray(issues)) {
      return new Map();
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return new Map();
      }

      // Get Monaco reference from editor
      const monaco = editor.constructor.monaco || window.monaco;
      if (!monaco) {
        console.warn('MarkdownLintMarkerAdapter: Monaco reference not available');
        return new Map();
      }

      // Convert issues to Monaco markers
      const markers = [];
      const markersMap = new Map();

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const marker = this.issueToMonacoMarker(model, issue, startOffset, monaco);
        
        if (marker) {
          markers.push(marker);
          
          // Create unique key for marker lookup
          const key = `${marker.startLineNumber}-${marker.startColumn}-${issue.rule}`;
          markersMap.set(key, {
            ...marker,
            id: `markdownlint-${i}`,
            issue: issue
          });
        }
      }

      // Set markers on the model
      monaco.editor.setModelMarkers(model, 'markdownlint', markers);

      console.log(`MarkdownLintMarkerAdapter: Created ${markers.length} Monaco markers`);
      return markersMap;

    } catch (error) {
      console.error('MarkdownLintMarkerAdapter: Failed to create Monaco markers:', error);
      return new Map();
    }
  }

  /**
   * Convert a single linting issue to a Monaco marker
   * @param {Object} model - Monaco editor model
   * @param {Object} issue - Linting issue object
   * @param {number} startOffset - Character offset
   * @param {Object} monaco - Monaco editor namespace
   * @returns {Object|null} Monaco marker object or null
   */
  static issueToMonacoMarker(model, issue, startOffset = 0, monaco) {
    if (!issue || typeof issue.line !== 'number') {
      return null;
    }

    try {
      // Ensure line number is valid (1-based)
      const lineNumber = Math.max(1, Math.floor(issue.line));
      const lineCount = model.getLineCount();
      
      if (lineNumber > lineCount) {
        console.warn(`MarkdownLintMarkerAdapter: Line ${lineNumber} exceeds model line count ${lineCount}`);
        return null;
      }

      // Get line content for column calculations
      const lineContent = model.getLineContent(lineNumber);
      const lineLength = lineContent.length;

      // Calculate column positions
      let startColumn = 1;
      let endColumn = lineLength + 1;

      // Use issue column if provided
      if (typeof issue.column === 'number' && issue.column > 0) {
        startColumn = Math.min(Math.max(1, issue.column), lineLength + 1);
        
        // Calculate end column based on length
        if (typeof issue.length === 'number' && issue.length > 0) {
          endColumn = Math.min(startColumn + issue.length, lineLength + 1);
        } else {
          // Default to highlighting relevant part of line
          endColumn = Math.min(startColumn + 10, lineLength + 1);
        }
      }

      // Get severity from Monaco
      const severity = this.getMonacoSeverity(issue, monaco);

      // Create marker object
      const marker = {
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
        message: this.formatIssueMessage(issue),
        severity,
        source: 'markdownlint',
        code: {
          value: issue.rule || issue.ruleNames?.[0] || 'unknown',
          target: this.getRuleDocumentationUrl(issue.rule)
        },
        tags: this.getMarkerTags(issue, monaco)
      };

      return marker;

    } catch (error) {
      console.warn('MarkdownLintMarkerAdapter: Failed to convert issue:', error, issue);
      return null;
    }
  }

  /**
   * Get Monaco marker severity for an issue
   * @param {Object} issue - Linting issue
   * @param {Object} monaco - Monaco editor namespace
   * @returns {number} Monaco marker severity
   */
  static getMonacoSeverity(issue, monaco) {
    const MarkerSeverity = monaco?.MarkerSeverity || {
      Error: 8,
      Warning: 4,
      Info: 2,
      Hint: 1
    };

    // Map issue severity to Monaco severity
    if (issue.severity === 'error') {
      return MarkerSeverity.Error;
    } else if (issue.severity === 'info' || issue.severity === 'information') {
      return MarkerSeverity.Info;
    } else if (issue.severity === 'hint') {
      return MarkerSeverity.Hint;
    }

    // Default to warning for most markdown lint issues
    return MarkerSeverity.Warning;
  }

  /**
   * Get marker tags for styling and behavior
   * @param {Object} issue - Linting issue
   * @param {Object} monaco - Monaco editor namespace
   * @returns {Array} Array of marker tags
   */
  static getMarkerTags(issue, monaco) {
    const MarkerTag = monaco?.MarkerTag || {
      Unnecessary: 1,
      Deprecated: 2
    };

    const tags = [];

    // Add tags based on rule type
    if (issue.rule) {
      switch (issue.rule) {
        case 'MD009': // Trailing spaces
        case 'MD010': // Hard tabs
        case 'MD012': // Multiple consecutive blank lines
          tags.push(MarkerTag.Unnecessary);
          break;
      }
    }

    return tags;
  }

  /**
   * Format issue message for display
   * @param {Object} issue - Linting issue
   * @returns {string} Formatted message
   */
  static formatIssueMessage(issue) {
    const rule = issue.rule || issue.ruleNames?.[0] || 'unknown';
    const ruleName = issue.ruleName || rule;
    const description = issue.message || issue.description || 'Markdown lint issue';
    
    // Create detailed message
    let message = `${rule}`;
    if (ruleName && ruleName !== rule) {
      message += ` (${ruleName})`;
    }
    message += `: ${description}`;

    // Add additional context if available
    if (issue.context) {
      message += ` [Context: ${issue.context}]`;
    }

    return message;
  }

  /**
   * Get documentation URL for a rule
   * @param {string} rule - Rule identifier (e.g., 'MD001')
   * @returns {string|null} Documentation URL or null
   */
  static getRuleDocumentationUrl(rule) {
    if (!rule || !rule.startsWith('MD')) {
      return null;
    }

    // markdownlint rule documentation URLs
    const baseUrl = 'https://github.com/DavidAnson/markdownlint/blob/main/doc';
    return `${baseUrl}/${rule}.md`;
  }

  /**
   * Clear all markdown lint markers from editor
   * @param {Object} editor - Monaco editor instance
   */
  static clearMarkers(editor) {
    if (!editor) {
      return;
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const monaco = editor.constructor.monaco || window.monaco;
      if (monaco) {
        monaco.editor.setModelMarkers(model, 'markdownlint', []);
      }

      console.log('MarkdownLintMarkerAdapter: Cleared all markers');

    } catch (error) {
      console.error('MarkdownLintMarkerAdapter: Failed to clear markers:', error);
    }
  }

  /**
   * Get markers for a specific line range
   * @param {Map} markersMap - Current markers map
   * @param {number} startLine - Start line number
   * @param {number} endLine - End line number
   * @returns {Array} Array of markers in the range
   */
  static getMarkersInRange(markersMap, startLine, endLine) {
    const markersInRange = [];

    if (!markersMap) {
      return markersInRange;
    }

    for (const marker of markersMap.values()) {
      if (marker.startLineNumber >= startLine && 
          marker.startLineNumber <= endLine) {
        markersInRange.push(marker);
      }
    }

    return markersInRange;
  }

  /**
   * Find marker at specific position
   * @param {Map} markersMap - Current markers map
   * @param {number} lineNumber - Line number (1-based)
   * @param {number} column - Column number (1-based)
   * @returns {Object|null} Marker at position or null
   */
  static getMarkerAtPosition(markersMap, lineNumber, column) {
    if (!markersMap) {
      return null;
    }

    for (const marker of markersMap.values()) {
      if (marker.startLineNumber === lineNumber &&
          column >= marker.startColumn &&
          column < marker.endColumn) {
        return marker;
      }
    }

    return null;
  }

  /**
   * Group markers by rule type
   * @param {Map} markersMap - Current markers map
   * @returns {Object} Object with markers grouped by rule
   */
  static groupMarkersByRule(markersMap) {
    const grouped = {};

    if (!markersMap) {
      return grouped;
    }

    for (const marker of markersMap.values()) {
      const rule = marker.code?.value || 'unknown';
      if (!grouped[rule]) {
        grouped[rule] = [];
      }
      grouped[rule].push(marker);
    }

    return grouped;
  }
}

export default MarkdownLintMarkerAdapter;
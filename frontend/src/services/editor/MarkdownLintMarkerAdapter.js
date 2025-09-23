/**
 * MarkdownLintMarkerAdapter - Convert linting issues to Monaco editor markers
 *
 * Provides utilities for converting markdown linting issues into Monaco editor
 * markers with proper positioning, styling, and metadata.
 */

export class MarkdownLintMarkerAdapter {
  /**
   * Convert markdown lint issues to Monaco markers
   * @param {Object} editor - Monaco editor instance
   * @param {Array} issues - Array of markdown lint issues
   * @param {number} startOffset - Start offset for position calculation
   * @param {Map} existingMarkersMap - Existing markers map to update
   * @param {Object} monaco - Monaco editor API reference
   * @returns {Map} Map of marker keys to marker objects
   */
  static toMonacoMarkers(editor, issues = [], startOffset = 0, existingMarkersMap = null, monaco = null) {
    if (!editor || !Array.isArray(issues)) {
      return existingMarkersMap || new Map();
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return new Map();
      }

      // Use provided Monaco reference or try to get it from editor/window
      const monacoRef = monaco || editor.constructor.monaco || window.monaco;
      if (!monacoRef) {
        console.warn('MarkdownLintMarkerAdapter: Monaco reference not available');
        return new Map();
      }

      // Convert issues to Monaco markers
      const markers = [];
      const markersMap = new Map();

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const marker = this.issueToMonacoMarker(model, issue, startOffset, monacoRef);

        if (marker) {
          markers.push(marker);

          // Create unique key for marker lookup (format: lineStart-colStart-lineEnd-colEnd)
          const key = `${marker.startLineNumber}-${marker.startColumn}-${marker.endLineNumber}-${marker.endColumn}`;
          markersMap.set(key, {
            ...marker,
            id: `markdownlint-${i}`,
            issue: issue,
            fixable: issue.fixable || false,
            fixInfo: issue.fixInfo || null
          });
        }
      }

      // Set markers on the model
      monacoRef.editor.setModelMarkers(model, 'markdownlint', markers);

      console.log(`MarkdownLintMarkerAdapter: Created ${markers.length} Monaco markers`);
      return markersMap;

    } catch (error) {
      console.error('MarkdownLintMarkerAdapter: Error converting issues to markers:', error);
      return existingMarkersMap || new Map();
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
    // Handle both 'line' and 'lineNumber' properties from different linting sources
    const lineNumber = issue.lineNumber || issue.line;
    if (!issue || typeof lineNumber !== 'number') {
      return null;
    }

    try {
      // Ensure line number is valid (1-based)
      const validLineNumber = Math.max(1, Math.floor(lineNumber));
      const lineCount = model.getLineCount();

      if (validLineNumber > lineCount) {
        console.warn(`MarkdownLintMarkerAdapter: Line ${validLineNumber} exceeds model line count ${lineCount}`);
        return null;
      }

      // Get line content for column calculations
      const lineContent = model.getLineContent(validLineNumber);
      const lineLength = lineContent.length;

      // Calculate column positions - for markdown lint, highlight the entire line by default
      let startColumn = 1;
      let endColumn = Math.max(lineLength + 1, 2); // Ensure at least 1 character is highlighted

      // Only use specific column positioning for certain rules that benefit from precise highlighting
      const columnNumber = issue.columnNumber || issue.column;
      const shouldUseSpecificColumn = (
        typeof columnNumber === 'number' &&
        columnNumber > 0 &&
        typeof issue.length === 'number' &&
        issue.length > 0 &&
        (issue.rule === 'MD009' || issue.rule === 'MD010') // Only for trailing spaces and hard tabs
      );

      if (shouldUseSpecificColumn) {
        // Use specific range for precise issues like trailing spaces
        startColumn = Math.min(Math.max(1, columnNumber), lineLength + 1);
        endColumn = Math.min(startColumn + issue.length, lineLength + 1);
      }
      // For all other markdown lint issues, highlight the entire line

      // Get severity from Monaco
      const severity = this.getMonacoSeverity(issue, monaco);

      // Create marker object
      const marker = {
        startLineNumber: validLineNumber,
        startColumn,
        endLineNumber: validLineNumber,
        endColumn,
        message: this.formatIssueMessage(issue),
        severity,
        source: 'markdownlint',
        code: {
          value: issue.rule || issue.ruleNames?.[0] || 'unknown',
          target: this.getRuleDocumentationUrl(issue.rule || issue.ruleNames?.[0])
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

    // Use Info severity for markdown lint issues to get yellow squiggles (different from spell check warnings)
    return MarkerSeverity.Info;
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
    const ruleName = issue.ruleName || issue.ruleDescription || rule;
    const description = issue.message || issue.description || issue.ruleDescription || 'Markdown lint issue';

    // Create detailed message
    let message = `${rule}`;
    if (ruleName && ruleName !== rule) {
      message += ` (${ruleName})`;
    }
    message += `: ${description}`;

    // Add fixable indicator if the issue can be auto-fixed
    if (issue.fixable === true) {
      message += ` 🔧 Auto-fixable`;
    }

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
    return `${baseUrl}/${rule.toLowerCase()}.md`;
  }

    /**
   * Clear all MarkdownLint markers from editor
   * @param {Object} editor - Monaco editor instance
   * @param {Object} monaco - Monaco editor API reference (optional)
   */
  static clearMarkers(editor, monaco = null) {
    if (!editor) {
      return;
    }

    try {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const monacoRef = monaco || editor.constructor.monaco || window.monaco;
      if (monacoRef) {
        monacoRef.editor.setModelMarkers(model, 'markdownlint', []);
      } else {
        console.warn('MarkdownLintMarkerAdapter: Monaco reference not available for clearing markers');
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
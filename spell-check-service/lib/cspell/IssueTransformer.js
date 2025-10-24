/**
 * Issue Transformation Module
 * Handles transformation of spelling issues from various sources into standardized format
 */

class IssueTransformer {
  constructor(languageConfig) {
    this.languageConfig = languageConfig;
  }

  /**
   * Transform CSpell issue to our standardized format
   * @param {Object} cspellIssue - Issue from CSpell or fallback engine
   * @param {Object} content - Extracted content object
   * @param {Object} fence - Code fence object
   * @param {string} severity - Issue severity
   * @returns {Object} Transformed issue
   */
  transformCSpellIssue(cspellIssue, content, fence, severity) {
    // BUGFIX: Check if content.position.start is already an absolute position
    // If it's larger than the fence start, it's likely already absolute
    let contentPositionStart = content.position.start;
    let absoluteStart, absoluteEnd;

    if (contentPositionStart > fence.position.codeStart) {
      // Content position is already absolute, don't add fence offset
      console.log('🔧 BUGFIX: Content position appears to be absolute, using as-is');
      absoluteStart = contentPositionStart + (cspellIssue.offset || 0);
      absoluteEnd = absoluteStart + cspellIssue.text.length;
    } else {
      // Content position is relative to code block, add fence offset (original logic)
      absoluteStart = fence.position.codeStart + contentPositionStart + (cspellIssue.offset || 0);
      absoluteEnd = absoluteStart + cspellIssue.text.length;
    }

    // DEBUG: Log position calculation details
    console.log('🔧 Position calculation debug:', {
      word: cspellIssue.text,
      fenceCodeStart: fence.position.codeStart,
      contentPositionStart: contentPositionStart,
      cspellOffset: cspellIssue.offset || 0,
      calculatedAbsoluteStart: absoluteStart,
      calculatedAbsoluteEnd: absoluteEnd,
      contentText: content.text.substring(0, 50) + '...',
      contentType: content.type,
      positionType: contentPositionStart > fence.position.codeStart ? 'absolute' : 'relative'
    });

    // Calculate line numbers
    const beforeText = fence.code.substring(0, contentPositionStart + (cspellIssue.offset || 0));
    const lineNumber = fence.lineNumbers.codeStart + beforeText.split('\n').length - 1;

    return {
      word: cspellIssue.text,
      position: {
        start: absoluteStart,
        end: absoluteEnd
      },
      lineNumber: lineNumber,
      severity: this.languageConfig.getIssueSeverity(content.type) || severity,
      type: `code-${content.type}`,
      language: fence.language,
      message: this.generateMessage(cspellIssue.text, content.type),
      suggestions: cspellIssue.suggestions || [],
      confidence: this.calculateConfidence(cspellIssue, content, fence),
      context: {
        fence: {
          language: fence.language,
          originalLanguage: fence.originalLanguage,
          index: fence.index
        },
        content: {
          type: content.type,
          originalMatch: content.originalMatch
        }
      },
      source: 'cspell',
      enhanced: true
    };
  }

  /**
   * Transform multiple issues for a code fence
   * @param {Array} issues - Array of raw issues
   * @param {Array} extractedContent - Array of extracted content
   * @param {Object} fence - Code fence object
   * @param {string} defaultSeverity - Default severity level
   * @returns {Array} Array of transformed issues
   */
  transformMultipleIssues(issues, extractedContent, fence, defaultSeverity = 'info') {
    console.log('🔄 Transforming multiple issues:', {
      issuesCount: issues.length,
      extractedContentCount: extractedContent.length,
      fenceCodeStart: fence.position?.codeStart,
      fenceIndex: fence.index,
      extractedContentPositions: extractedContent.map(c => ({
        type: c.type,
        positionStart: c.position?.start,
        positionEnd: c.position?.end,
        textPreview: c.text.substring(0, 20) + '...'
      }))
    });

    const transformedIssues = [];

    for (const issue of issues) {
      // Find the content object that contains this issue
      const content = this.findContentForIssue(issue, extractedContent);

      if (content) {
        const transformedIssue = this.transformCSpellIssue(issue, content, fence, defaultSeverity);
        transformedIssues.push(transformedIssue);
      }
    }

    return transformedIssues;
  }

  /**
   * Find the content object that contains a specific issue
   * @param {Object} issue - Spelling issue
   * @param {Array} extractedContent - Array of extracted content
   * @returns {Object|null} Matching content object
   */
  findContentForIssue(issue, extractedContent) {
    console.log('🔍 Finding content for issue:', {
      issueText: issue.text,
      issueOffset: issue.offset,
      extractedContentCount: extractedContent.length,
      extractedContentSummary: extractedContent.map(c => ({
        type: c.type,
        text: c.text.substring(0, 30) + '...',
        positionStart: c.position?.start,
        positionEnd: c.position?.end
      }))
    });

    // Better approach: find content that contains the issue at the correct offset
    if (issue.offset !== undefined) {
      for (const content of extractedContent) {
        // Check if this content contains the issue at the expected relative position
        const relativeOffset = issue.offset - (content.position?.start || 0);
        if (relativeOffset >= 0 && relativeOffset < content.text.length) {
          const wordAtOffset = content.text.substring(relativeOffset, relativeOffset + issue.text.length);
          if (wordAtOffset === issue.text) {
            console.log('🎯 Matched content by offset:', {
              contentType: content.type,
              contentText: content.text.substring(0, 50) + '...',
              contentPosition: content.position,
              relativeOffset,
              wordAtOffset
            });
            return content;
          }
        }
      }
    }

    // Fallback: find content that contains the issue text (original logic)
    for (const content of extractedContent) {
      if (content.text.includes(issue.text)) {
        console.log('🎯 Matched content by text inclusion (fallback):', {
          contentType: content.type,
          contentText: content.text.substring(0, 50) + '...',
          contentPosition: content.position
        });
        return content;
      }
    }

    console.log('⚠️ No exact match found, using fallback');

    // Final fallback: return first content of the same type
    return extractedContent.find(content => content.type === 'comment') ||
           extractedContent.find(content => content.type === 'identifier') ||
           extractedContent[0] || null;
  }

  /**
   * Generate appropriate message for spelling issue
   * @param {string} word - Misspelled word
   * @param {string} contentType - Type of content (comment, string, identifier)
   * @returns {string} Issue message
   */
  generateMessage(word, contentType) {
    const typeMessages = {
      'comment': `Possible spelling error in comment: "${word}"`,
      'string': `Possible spelling error in string literal: "${word}"`,
      'identifier': `Possible spelling error in identifier: "${word}"`,
      'documentation': `Possible spelling error in documentation: "${word}"`
    };

    return typeMessages[contentType] || `Possible spelling error: "${word}"`;
  }

  /**
   * Calculate confidence score for issue
   * @param {Object} issue - Spelling issue
   * @param {Object} content - Content object
   * @param {Object} fence - Code fence object
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(issue, content, fence) {
    let confidence = 0.8; // Base confidence

    // Adjust based on content type
    if (content.type === 'comment') {
      confidence += 0.1; // Comments are more likely to have real words
    } else if (content.type === 'identifier') {
      confidence -= 0.1; // Identifiers might be intentional abbreviations
    }

    // Adjust based on word length
    if (issue.text.length < 4) {
      confidence -= 0.2; // Short words are less reliable
    } else if (issue.text.length > 8) {
      confidence += 0.1; // Longer words are more likely to be misspellings
    }

    // Adjust based on suggestions availability
    if (issue.suggestions && issue.suggestions.length > 0) {
      confidence += 0.1; // Having suggestions increases confidence
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Transform issues to match the expected API response format
   * @param {Array} issues - Array of transformed issues
   * @param {Object} statistics - Statistics about the checking process
   * @returns {Object} Formatted response
   */
  formatResponse(issues, statistics) {
    return {
      codeSpelling: issues,
      codeSpellStatistics: {
        codeBlocks: statistics.codeBlocks || 0,
        languagesDetected: statistics.languagesDetected || [],
        issuesFound: issues.length
      }
    };
  }

  /**
   * Create statistics object from processing results
   * @param {Array} codeFences - Array of processed code fences
   * @param {Array} allIssues - Array of all found issues
   * @returns {Object} Statistics object
   */
  createStatistics(codeFences, allIssues) {
    const languagesDetected = new Set();

    codeFences.forEach(fence => {
      languagesDetected.add(fence.language);
    });

    return {
      codeBlocks: codeFences.length,
      languagesDetected: Array.from(languagesDetected),
      issuesFound: allIssues.length
    };
  }

  /**
   * Filter issues based on criteria
   * @param {Array} issues - Array of issues
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered issues
   */
  filterIssues(issues, filters = {}) {
    const {
      minConfidence = 0.5,
      severityLevels = ['error', 'warning', 'info', 'hint'],
      contentTypes = ['comment', 'string', 'identifier'],
      languages = null
    } = filters;

    return issues.filter(issue => {
      // Filter by confidence
      if (issue.confidence < minConfidence) {
        return false;
      }

      // Filter by severity
      if (!severityLevels.includes(issue.severity)) {
        return false;
      }

      // Filter by content type
      const contentType = issue.type.replace('code-', '');
      if (!contentTypes.includes(contentType)) {
        return false;
      }

      // Filter by language
      if (languages && !languages.includes(issue.language)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Group issues by various criteria
   * @param {Array} issues - Array of issues
   * @param {string} groupBy - Grouping criteria ('language', 'type', 'severity')
   * @returns {Object} Grouped issues
   */
  groupIssues(issues, groupBy = 'language') {
    const groups = {};

    issues.forEach(issue => {
      let key;

      switch (groupBy) {
        case 'language':
          key = issue.language;
          break;
        case 'type':
          key = issue.type;
          break;
        case 'severity':
          key = issue.severity;
          break;
        case 'fence':
          key = `fence-${issue.context.fence.index}`;
          break;
        default:
          key = 'all';
      }

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(issue);
    });

    return groups;
  }

  /**
   * Deduplicate issues that refer to the same problem
   * @param {Array} issues - Array of issues
   * @returns {Array} Deduplicated issues
   */
  deduplicateIssues(issues) {
    const seen = new Set();
    const deduplicated = [];

    for (const issue of issues) {
      // Create a key based on position and word
      const key = `${issue.position.start}-${issue.position.end}-${issue.word}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(issue);
      }
    }

    return deduplicated;
  }

  /**
   * Get issue summary statistics
   * @param {Array} issues - Array of issues
   * @returns {Object} Summary statistics
   */
  getIssueSummary(issues) {
    const summary = {
      total: issues.length,
      byType: {},
      bySeverity: {},
      byLanguage: {},
      avgConfidence: 0
    };

    let totalConfidence = 0;

    issues.forEach(issue => {
      // Count by type
      const type = issue.type.replace('code-', '');
      summary.byType[type] = (summary.byType[type] || 0) + 1;

      // Count by severity
      summary.bySeverity[issue.severity] = (summary.bySeverity[issue.severity] || 0) + 1;

      // Count by language
      summary.byLanguage[issue.language] = (summary.byLanguage[issue.language] || 0) + 1;

      // Sum confidence
      totalConfidence += issue.confidence;
    });

    // Calculate average confidence
    summary.avgConfidence = issues.length > 0 ?
      (totalConfidence / issues.length).toFixed(2) : 0;

    return summary;
  }
}

module.exports = IssueTransformer;
/**
 * Content Extraction Module
 * Handles extraction of spellcheckable content from code fences
 * Includes comment, string, and identifier extraction with language-specific patterns
 */

class ContentExtractor {
  constructor(languageConfig) {
    this.languageConfig = languageConfig;
  }

  /**
   * Extract spellcheckable content from code based on language configuration
   * @param {string} code - The code content
   * @param {Object} langConfig - Language configuration
   * @param {Object} options - Extraction options
   * @returns {Array} Array of extracted content objects
   */
  extractSpellcheckableContent(code, langConfig, options) {
    const content = [];

    // Extract comments
    if (options.checkComments) {
      for (const pattern of langConfig.commentPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          content.push({
            text: this.cleanCommentText(match[0]),
            type: 'comment',
            originalMatch: match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length
            }
          });
        }
      }
    }

    // Extract strings
    if (options.checkStrings) {
      for (const pattern of langConfig.stringPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          const stringContent = this.cleanStringText(match[0]);
          if (stringContent.trim().length > 0) {
            content.push({
              text: stringContent,
              type: 'string',
              originalMatch: match[0],
              position: {
                start: match.index,
                end: match.index + match[0].length
              }
            });
          }
        }
      }
    }

    // Extract identifiers (variable/function names)
    if (options.checkIdentifiers) {
      const identifierPattern = langConfig.identifierPattern;
      let match;
      while ((match = identifierPattern.exec(code)) !== null) {
        const identifier = match[0];

        // Skip common keywords and short identifiers
        if (!this.languageConfig.isKeywordOrBuiltin(identifier, langConfig) && identifier.length > 2) {
          // Split camelCase and snake_case
          const words = this.splitIdentifier(identifier);

          for (const word of words) {
            if (word.length > 2) {
              content.push({
                text: word,
                type: 'identifier',
                originalMatch: identifier,
                position: {
                  start: match.index,
                  end: match.index + identifier.length
                }
              });
            }
          }
        }
      }
    }

    // Reset regex lastIndex for all patterns
    langConfig.commentPatterns.forEach(p => p.lastIndex = 0);
    langConfig.stringPatterns.forEach(p => p.lastIndex = 0);
    langConfig.identifierPattern.lastIndex = 0;

    return content;
  }

  /**
   * Clean comment text for spell checking
   * Removes comment markers and excessive whitespace
   * @param {string} comment - Raw comment text
   * @returns {string} Cleaned comment text
   */
  cleanCommentText(comment) {
    return comment
      .replace(/^\/\*+|\*+\/$/g, '')  // Remove /* */ markers
      .replace(/^\/\/+/gm, '')        // Remove // markers
      .replace(/^#+/gm, '')           // Remove # markers
      .replace(/^<!--+|--+>$/g, '')   // Remove HTML comment markers
      .replace(/^\s*\*+\s*/gm, '')    // Remove leading asterisks in block comments
      .replace(/^\s*-+\s*/gm, '')     // Remove leading dashes
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim();
  }

  /**
   * Clean string text for spell checking
   * Removes quotes and escape sequences
   * @param {string} str - Raw string text
   * @returns {string} Cleaned string text
   */
  cleanStringText(str) {
    return str
      .replace(/^["'`]/, '')        // Remove opening quotes
      .replace(/["'`]$/, '')        // Remove closing quotes
      .replace(/\\./g, '')          // Remove escape sequences
      .trim();
  }

  /**
   * Split identifier into words (camelCase, snake_case, kebab-case)
   * @param {string} identifier - The identifier to split
   * @returns {Array} Array of words
   */
  splitIdentifier(identifier) {
    const words = [];

    // Handle snake_case and kebab-case
    if (identifier.includes('_') || identifier.includes('-')) {
      words.push(...identifier.split(/[_-]+/));
    } else {
      // Handle camelCase and PascalCase
      const camelWords = identifier.split(/(?=[A-Z])/);
      words.push(...camelWords);
    }

    return words
      .map(word => word.toLowerCase())
      .filter(word => word.length > 0);
  }

  /**
   * Extract content with position tracking for better error reporting
   * @param {string} code - Source code
   * @param {Object} langConfig - Language configuration
   * @param {Object} options - Extraction options
   * @returns {Array} Array of content with detailed position information
   */
  extractWithPositionTracking(code, langConfig, options) {
    const content = this.extractSpellcheckableContent(code, langConfig, options);

    // Add line and column information
    return content.map(item => {
      const beforeText = code.substring(0, item.position.start);
      const lines = beforeText.split('\n');
      const lineNumber = lines.length;
      const columnNumber = lines[lines.length - 1].length + 1;

      return {
        ...item,
        position: {
          ...item.position,
          line: lineNumber,
          column: columnNumber
        }
      };
    });
  }

  /**
   * Filter extracted content based on minimum length and other criteria
   * @param {Array} content - Extracted content array
   * @param {Object} filters - Filter options
   * @returns {Array} Filtered content array
   */
  filterContent(content, filters = {}) {
    const {
      minLength = 3,
      maxLength = 50,
      excludeNumbers = true,
      excludeShortWords = true
    } = filters;

    return content.filter(item => {
      const text = item.text.trim();

      // Length filters
      if (text.length < minLength || text.length > maxLength) {
        return false;
      }

      // Exclude pure numbers
      if (excludeNumbers && /^\d+$/.test(text)) {
        return false;
      }

      // Exclude very short words for identifiers
      if (excludeShortWords && item.type === 'identifier' && text.length < 4) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get content extraction statistics
   * @param {Array} content - Extracted content array
   * @returns {Object} Statistics about extracted content
   */
  getExtractionStats(content) {
    const stats = {
      total: content.length,
      byType: {},
      avgLength: 0,
      totalChars: 0
    };

    content.forEach(item => {
      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      // Calculate total characters
      stats.totalChars += item.text.length;
    });

    // Calculate average length
    stats.avgLength = stats.total > 0 ? (stats.totalChars / stats.total).toFixed(2) : 0;

    return stats;
  }
}

module.exports = ContentExtractor;
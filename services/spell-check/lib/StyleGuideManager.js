/**
 * Style Guide Manager - Phase 3 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Support for AP, Chicago, MLA, and other style guides
 * Features: Configurable style rules, style compliance checking
 */

class StyleGuideManager {
  constructor() {
    this.styleGuides = new Map();
    this.isInitialized = false;
    this.loadStyleGuides();
  }

  /**
   * Initialize style guide manager
   */
  async init() {
    console.log('[StyleGuideManager] Initializing style guide manager...');
    this.isInitialized = true;
    console.log('[StyleGuideManager] Style guide manager initialized');
  }

  /**
   * Load all style guide configurations
   */
  loadStyleGuides() {
    // AP Style Guide
    this.styleGuides.set('ap', {
      name: 'Associated Press (AP) Style',
      description: 'Journalism and news writing style guide',
      rules: [
        {
          name: 'state-abbreviations',
          pattern: /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g,
          message: 'AP style: Spell out state names in text, use abbreviations only in addresses',
          suggestion: 'Spell out state name',
          severity: 'suggestion',
          category: 'abbreviations'
        },
        {
          name: 'numbers-under-ten',
          pattern: /\b[0-9]\b/g,
          message: 'AP style: Spell out numbers one through nine',
          suggestion: 'Spell out single-digit numbers',
          severity: 'suggestion',
          category: 'numbers'
        },
        {
          name: 'percent-symbol',
          pattern: /%/g,
          message: 'AP style: Use "percent" instead of % symbol in text',
          suggestion: 'Use "percent" instead of %',
          severity: 'suggestion',
          category: 'symbols'
        },
        {
          name: 'oxford-comma',
          pattern: /,\s+and\s+/g,
          message: 'AP style: Avoid Oxford comma (serial comma) before "and"',
          suggestion: 'Remove comma before "and"',
          severity: 'suggestion',
          category: 'punctuation'
        },
        {
          name: 'time-format',
          pattern: /\b\d{1,2}:\d{2}\s?(AM|PM|am|pm)\b/g,
          message: 'AP style: Use a.m. and p.m. with periods',
          suggestion: 'Use a.m./p.m. format',
          severity: 'suggestion',
          category: 'time'
        }
      ]
    });

    // Chicago Manual of Style
    this.styleGuides.set('chicago', {
      name: 'Chicago Manual of Style',
      description: 'Academic and book publishing style guide',
      rules: [
        {
          name: 'oxford-comma-required',
          pattern: /\w+,\s+\w+\s+and\s+\w+/g,
          message: 'Chicago style: Use Oxford comma (serial comma) before "and"',
          suggestion: 'Add comma before "and"',
          severity: 'suggestion',
          category: 'punctuation'
        },
        {
          name: 'numbers-under-hundred',
          pattern: /\b[1-9][0-9]\b/g,
          message: 'Chicago style: Spell out numbers one through ninety-nine',
          suggestion: 'Spell out numbers under 100',
          severity: 'suggestion',
          category: 'numbers'
        },
        {
          name: 'quotation-marks',
          pattern: /"([^"]*?)"/g,
          message: 'Chicago style: Use double quotes for primary quotations',
          suggestion: 'Verify quotation mark usage',
          severity: 'info',
          category: 'quotations'
        },
        {
          name: 'em-dash-spacing',
          pattern: /\s—\s/g,
          message: 'Chicago style: Em dashes should not have spaces around them',
          suggestion: 'Remove spaces around em dash',
          severity: 'suggestion',
          category: 'punctuation'
        },
        {
          name: 'chapter-capitalization',
          pattern: /\bchapter\s+\d+/gi,
          message: 'Chicago style: Capitalize "Chapter" when referring to specific chapters',
          suggestion: 'Capitalize "Chapter"',
          severity: 'suggestion',
          category: 'capitalization'
        }
      ]
    });

    // MLA Style Guide
    this.styleGuides.set('mla', {
      name: 'Modern Language Association (MLA) Style',
      description: 'Literature and humanities style guide',
      rules: [
        {
          name: 'works-cited',
          pattern: /works\s+cited/gi,
          message: 'MLA style: Use "Works Cited" for bibliography',
          suggestion: 'Use "Works Cited" heading',
          severity: 'info',
          category: 'citations'
        },
        {
          name: 'double-spacing',
          pattern: /\n\n\n+/g,
          message: 'MLA style: Use double spacing throughout the paper',
          suggestion: 'Use consistent double spacing',
          severity: 'info',
          category: 'formatting'
        },
        {
          name: 'first-person',
          pattern: /\b(I|my|me|we|us|our)\b/g,
          message: 'MLA style: Minimize first-person pronouns in academic writing',
          suggestion: 'Consider using third person',
          severity: 'suggestion',
          category: 'voice'
        },
        {
          name: 'contractions',
          pattern: /\b\w+'(t|re|ve|ll|d)\b/g,
          message: 'MLA style: Avoid contractions in formal academic writing',
          suggestion: 'Spell out contractions',
          severity: 'warning',
          category: 'formality'
        },
        {
          name: 'page-numbers',
          pattern: /(page|p\.)\s*\d+/gi,
          message: 'MLA style: Use author-page format for in-text citations',
          suggestion: 'Use (Author page) format',
          severity: 'info',
          category: 'citations'
        }
      ]
    });

    // APA Style Guide
    this.styleGuides.set('apa', {
      name: 'American Psychological Association (APA) Style',
      description: 'Psychology and social sciences style guide',
      rules: [
        {
          name: 'references-section',
          pattern: /references/gi,
          message: 'APA style: Use "References" for bibliography section',
          suggestion: 'Use "References" heading',
          severity: 'info',
          category: 'citations'
        },
        {
          name: 'first-person-acceptable',
          pattern: /the\s+author/gi,
          message: 'APA style: First person is acceptable, avoid "the author"',
          suggestion: 'Use "I" or "we" instead of "the author"',
          severity: 'suggestion',
          category: 'voice'
        },
        {
          name: 'bias-free-language',
          pattern: /\b(mankind|manpower|chairman)\b/gi,
          message: 'APA style: Use bias-free language',
          suggestion: 'Use inclusive language alternatives',
          severity: 'warning',
          category: 'inclusive-language'
        },
        {
          name: 'latin-abbreviations',
          pattern: /\b(i\.e\.|e\.g\.|etc\.)\b/g,
          message: 'APA style: Limit Latin abbreviations in running text',
          suggestion: 'Consider using English equivalents',
          severity: 'suggestion',
          category: 'abbreviations'
        },
        {
          name: 'hyphenation',
          pattern: /\b\w+-\w+\b/g,
          message: 'APA style: Check hyphenation rules for compound words',
          suggestion: 'Verify hyphenation is correct',
          severity: 'info',
          category: 'hyphenation'
        }
      ]
    });

    // Academic Writing (General)
    this.styleGuides.set('academic', {
      name: 'Academic Writing',
      description: 'General academic writing guidelines',
      rules: [
        {
          name: 'passive-voice-limit',
          pattern: /(is|are|was|were|been|being)\s+\w+ed\b/g,
          message: 'Academic writing: Consider active voice for clarity',
          suggestion: 'Use active voice when possible',
          severity: 'suggestion',
          category: 'voice'
        },
        {
          name: 'hedging-language',
          pattern: /\b(seems?|appears?|might|could|may|perhaps|possibly)\b/g,
          message: 'Academic writing: Excessive hedging may weaken arguments',
          suggestion: 'Use confident language when appropriate',
          severity: 'info',
          category: 'certainty'
        },
        {
          name: 'colloquialisms',
          pattern: /\b(really|very|quite|pretty|sort of|kind of|a lot|lots of)\b/gi,
          message: 'Academic writing: Avoid colloquial expressions',
          suggestion: 'Use formal academic language',
          severity: 'warning',
          category: 'formality'
        },
        {
          name: 'transition-words',
          pattern: /^\s*[A-Z][^.!?]*\.\s*[A-Z]/gm,
          message: 'Academic writing: Consider using transition words between sentences',
          suggestion: 'Add transitional phrases for flow',
          severity: 'info',
          category: 'transitions'
        }
      ]
    });

    // Technical Writing
    this.styleGuides.set('technical', {
      name: 'Technical Writing',
      description: 'Technical documentation and software writing',
      rules: [
        {
          name: 'imperative-mood',
          pattern: /\b(you should|you can|you must|you need to)\b/gi,
          message: 'Technical writing: Use imperative mood for instructions',
          suggestion: 'Use direct commands (e.g., "Click" instead of "You should click")',
          severity: 'suggestion',
          category: 'voice'
        },
        {
          name: 'numbered-lists',
          pattern: /^\s*\d+\.\s+/gm,
          message: 'Technical writing: Use numbered lists for sequential steps',
          suggestion: 'Verify step order and numbering',
          severity: 'info',
          category: 'lists'
        },
        {
          name: 'code-formatting',
          pattern: /`[^`]+`/g,
          message: 'Technical writing: Verify code formatting consistency',
          suggestion: 'Use consistent code formatting',
          severity: 'info',
          category: 'formatting'
        },
        {
          name: 'avoid-jargon',
          pattern: /\b(leverage|utilize|implement|execute)\b/gi,
          message: 'Technical writing: Prefer simple, clear language',
          suggestion: 'Use simpler alternatives (use, run, do)',
          severity: 'suggestion',
          category: 'clarity'
        }
      ]
    });
  }

  /**
   * Apply style guide rules to text
   * @param {string} text - Text to analyze
   * @param {string} styleGuide - Style guide name
   * @param {Object} options - Analysis options
   * @returns {Array} Style guide violations
   */
  analyzeWithStyleGuide(text, styleGuide, options = {}) {
    if (!this.styleGuides.has(styleGuide)) {
      throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    const guide = this.styleGuides.get(styleGuide);
    const issues = [];

    for (const rule of guide.rules) {
      // Skip rules based on options
      if (options.excludeCategories && options.excludeCategories.includes(rule.category)) {
        continue;
      }

      if (options.includeCategoriesOnly && !options.includeCategoriesOnly.includes(rule.category)) {
        continue;
      }

      // Apply rule pattern to text
      let match;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        // Skip if in code blocks (for technical writing)
        if (this.isInCodeBlock(text, match.index)) {
          continue;
        }

        // Skip if in quotes (for some rules)
        if (rule.category === 'quotations' && this.isInQuotation(text, match.index)) {
          continue;
        }

        issues.push({
          type: 'style-guide',
          rule: rule.name,
          styleGuide: styleGuide,
          message: rule.message,
          suggestion: rule.suggestion,
          severity: rule.severity,
          category: rule.category,
          position: {
            start: match.index,
            end: match.index + match[0].length
          },
          originalText: match[0],
          lineNumber: this.getLineNumber(text, match.index),
          column: this.getColumn(text, match.index)
        });
      }
    }

    return issues;
  }

  /**
   * Get available style guides
   * @returns {Array} Available style guides
   */
  getAvailableStyleGuides() {
    return Array.from(this.styleGuides.entries()).map(([key, guide]) => ({
      id: key,
      name: guide.name,
      description: guide.description,
      ruleCount: guide.rules.length
    }));
  }

  /**
   * Get rules for a specific style guide
   * @param {string} styleGuide - Style guide name
   * @returns {Array} Style guide rules
   */
  getStyleGuideRules(styleGuide) {
    if (!this.styleGuides.has(styleGuide)) {
      throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    const guide = this.styleGuides.get(styleGuide);
    return guide.rules.map(rule => ({
      name: rule.name,
      message: rule.message,
      suggestion: rule.suggestion,
      severity: rule.severity,
      category: rule.category
    }));
  }

  /**
   * Get categories for a style guide
   * @param {string} styleGuide - Style guide name
   * @returns {Array} Categories
   */
  getStyleGuideCategories(styleGuide) {
    if (!this.styleGuides.has(styleGuide)) {
      throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    const guide = this.styleGuides.get(styleGuide);
    const categories = [...new Set(guide.rules.map(rule => rule.category))];
    return categories.sort();
  }

  /**
   * Check if position is within a code block
   * @param {string} text - Full text
   * @param {number} position - Position to check
   * @returns {boolean} True if in code block
   */
  isInCodeBlock(text, position) {
    // Check for markdown code blocks
    const beforeText = text.substring(0, position);
    const afterText = text.substring(position);

    // Count backticks before and after
    const beforeTicks = (beforeText.match(/```/g) || []).length;
    const afterTicks = (afterText.match(/```/g) || []).length;

    // If odd number of ``` before and after, we're in a code block
    return (beforeTicks % 2 === 1) && (afterTicks % 2 === 1);
  }

  /**
   * Check if position is within quotation marks
   * @param {string} text - Full text
   * @param {number} position - Position to check
   * @returns {boolean} True if in quotation
   */
  isInQuotation(text, position) {
    const beforeText = text.substring(0, position);
    const afterText = text.substring(position);

    // Count unescaped quotes before and after
    const beforeQuotes = (beforeText.match(/(?<!\\)"/g) || []).length;
    const afterQuotes = (afterText.match(/(?<!\\)"/g) || []).length;

    // If odd number of quotes before and after, we're in quotes
    return (beforeQuotes % 2 === 1) && (afterQuotes % 2 === 1);
  }

  /**
   * Get line number for position
   * @param {string} text - Full text
   * @param {number} position - Character position
   * @returns {number} Line number
   */
  getLineNumber(text, position) {
    return text.substring(0, position).split('\n').length;
  }

  /**
   * Get column number for position
   * @param {string} text - Full text
   * @param {number} position - Character position
   * @returns {number} Column number
   */
  getColumn(text, position) {
    const beforeText = text.substring(0, position);
    const lastNewline = beforeText.lastIndexOf('\n');
    return position - lastNewline;
  }

  /**
   * Combine multiple style guides
   * @param {string} text - Text to analyze
   * @param {string[]} styleGuides - Array of style guide names
   * @param {Object} options - Analysis options
   * @returns {Array} Combined style issues
   */
  analyzeWithMultipleStyleGuides(text, styleGuides, options = {}) {
    const allIssues = [];

    for (const guide of styleGuides) {
      try {
        const issues = this.analyzeWithStyleGuide(text, guide, options);
        allIssues.push(...issues);
      } catch (error) {
        console.error(`Error applying style guide ${guide}:`, error);
      }
    }

    // Remove duplicates based on position and message
    const uniqueIssues = [];
    const seen = new Set();

    for (const issue of allIssues) {
      const key = `${issue.position.start}-${issue.position.end}-${issue.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueIssues.push(issue);
      }
    }

    // Sort by position
    uniqueIssues.sort((a, b) => a.position.start - b.position.start);

    return uniqueIssues;
  }

  /**
   * Get recommendations for style guide based on text content
   * @param {string} text - Text to analyze
   * @returns {Array} Recommended style guides
   */
  recommendStyleGuides(text) {
    const recommendations = [];
    const textLower = text.toLowerCase();

    // Check for academic markers
    if (textLower.includes('abstract') || textLower.includes('methodology') || 
        textLower.includes('literature review') || textLower.includes('hypothesis')) {
      recommendations.push({
        id: 'apa',
        confidence: 0.8,
        reason: 'Contains academic/research content'
      });
    }

    // Check for news/journalism markers
    if (textLower.includes('according to') || textLower.includes('reported') ||
        textLower.includes('sources say')) {
      recommendations.push({
        id: 'ap',
        confidence: 0.7,
        reason: 'Contains journalism/news content'
      });
    }

    // Check for literary/humanities markers
    if (textLower.includes('thesis') || textLower.includes('argues that') ||
        textLower.includes('the author suggests')) {
      recommendations.push({
        id: 'mla',
        confidence: 0.6,
        reason: 'Contains literary/humanities content'
      });
    }

    // Check for technical/code markers
    if (textLower.includes('function') || textLower.includes('click') ||
        textLower.includes('install') || text.includes('```')) {
      recommendations.push({
        id: 'technical',
        confidence: 0.9,
        reason: 'Contains technical/documentation content'
      });
    }

    // Default to academic for formal writing
    if (recommendations.length === 0 && textLower.length > 500) {
      recommendations.push({
        id: 'academic',
        confidence: 0.5,
        reason: 'General formal writing'
      });
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
}

module.exports = StyleGuideManager;
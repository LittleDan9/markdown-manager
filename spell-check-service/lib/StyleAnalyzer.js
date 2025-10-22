/**
 * Style Analyzer - Phase 2 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Writing style analysis and readability improvements
 * Features: Style suggestions, readability metrics, writing quality assessment
 */

const writeGood = require('write-good');

class StyleAnalyzer {
  constructor() {
    this.isInitialized = false;
    this.settings = {
      passive: true,
      illusion: true,
      so: true,
      thereIs: true,
      weasel: true,
      adverb: true,
      tooWordy: true,
      cliches: true,
      eprime: false // E-Prime analysis (avoiding "to be" verbs)
    };
  }

  /**
   * Initialize the style analyzer
   */
  async init() {
    try {
      console.log('[StyleAnalyzer] Initializing style analyzer...');
      this.isInitialized = true;
      console.log('[StyleAnalyzer] Style analyzer initialized successfully');
    } catch (error) {
      console.error('[StyleAnalyzer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Analyze text for writing style issues and improvements
   * @param {string} text - Text to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Style analysis results
   */
  async analyzeText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Style analyzer not initialized');
    }

    const issues = [];
    
    try {
      // Use write-good for style analysis
      const suggestions = writeGood(text, this.settings);
      
      // Convert write-good suggestions to our format
      for (const suggestion of suggestions) {
        issues.push({
          type: 'style',
          severity: this.getSeverityForReason(suggestion.reason),
          message: this.getMessageForReason(suggestion.reason, suggestion.suggestion),
          rule: this.normalizeReason(suggestion.reason),
          position: {
            start: suggestion.index,
            end: suggestion.index + suggestion.offset
          },
          lineNumber: this.getLineNumber(text, suggestion.index),
          column: this.getColumn(text, suggestion.index),
          suggestions: suggestion.replacements || [suggestion.suggestion || 'Revise for clarity'],
          confidence: this.getConfidenceForReason(suggestion.reason),
          originalText: text.substring(suggestion.index, suggestion.index + suggestion.offset)
        });
      }

      // Add custom style checks
      const customIssues = await this.performCustomStyleChecks(text);
      issues.push(...customIssues);

      // Add readability analysis
      const readabilityScore = this.calculateReadabilityScore(text);
      
    } catch (error) {
      console.error('[StyleAnalyzer] Error analyzing text:', error);
      // Don't throw - return empty results on error
    }

    return {
      style: issues,
      readability: this.calculateReadabilityMetrics(text)
    };
  }

  /**
   * Perform custom style checks beyond write-good
   * @param {string} text - Text to analyze
   * @returns {Array} Array of style issues
   */
  async performCustomStyleChecks(text) {
    const issues = [];
    const lines = text.split('\n');
    let globalOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Skip markdown elements
      if (this.shouldSkipLineForStyle(line)) {
        globalOffset += line.length + 1;
        continue;
      }

      // Check for excessive exclamation marks
      const exclamationIssues = this.checkExcessiveExclamation(line, lineIndex + 1, globalOffset);
      issues.push(...exclamationIssues);

      // Check for word variety
      const varietyIssues = this.checkWordVariety(line, lineIndex + 1, globalOffset);
      issues.push(...varietyIssues);

      // Check for paragraph length
      const lengthIssues = this.checkParagraphLength(line, lineIndex + 1, globalOffset);
      issues.push(...lengthIssues);

      globalOffset += line.length + 1;
    }

    return issues;
  }

  /**
   * Check if a line should be skipped for style analysis
   * @param {string} line - Line to check
   * @returns {boolean} True if line should be skipped
   */
  shouldSkipLineForStyle(line) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) return true;
    
    // Skip markdown headers
    if (trimmed.startsWith('#')) return true;
    
    // Skip code blocks
    if (trimmed.startsWith('```') || trimmed.startsWith('    ')) return true;
    
    // Skip blockquotes
    if (trimmed.startsWith('>')) return true;
    
    return false;
  }

  /**
   * Check for excessive exclamation marks
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of exclamation issues
   */
  checkExcessiveExclamation(line, lineNumber, offset) {
    const issues = [];
    const exclamationRegex = /!{2,}/g;
    let match;

    while ((match = exclamationRegex.exec(line)) !== null) {
      const start = offset + match.index;
      const end = start + match[0].length;
      
      issues.push({
        type: 'style',
        severity: 'suggestion',
        message: 'Avoid using multiple exclamation marks. One is usually sufficient for emphasis.',
        rule: 'excessive-exclamation',
        position: { start, end },
        lineNumber,
        column: match.index + 1,
        suggestions: ['!'],
        confidence: 0.8,
        originalText: match[0]
      });
    }

    return issues;
  }

  /**
   * Check for word variety and repetition
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of word variety issues
   */
  checkWordVariety(line, lineNumber, offset) {
    const issues = [];
    const words = line.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordCounts = {};

    // Count word frequencies
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }

    // Check for overused words (3+ times in a line)
    for (const [word, count] of Object.entries(wordCounts)) {
      if (count >= 3) {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
        let match;
        
        while ((match = wordRegex.exec(line)) !== null) {
          const start = offset + match.index;
          const end = start + match[0].length;
          
          issues.push({
            type: 'style',
            severity: 'suggestion',
            message: `The word "${word}" is used ${count} times in this sentence. Consider using synonyms for variety.`,
            rule: 'word-repetition',
            position: { start, end },
            lineNumber,
            column: match.index + 1,
            suggestions: ['Use a synonym', 'Rephrase for variety'],
            confidence: 0.6,
            originalText: match[0]
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check paragraph length for readability
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of paragraph length issues
   */
  checkParagraphLength(line, lineNumber, offset) {
    const issues = [];
    const wordCount = (line.match(/\b\w+\b/g) || []).length;
    
    if (wordCount > 100) {
      issues.push({
        type: 'style',
        severity: 'suggestion',
        message: `This paragraph is quite long (${wordCount} words). Consider breaking it into smaller paragraphs for better readability.`,
        rule: 'paragraph-length',
        position: { start: offset, end: offset + line.length },
        lineNumber,
        column: 1,
        suggestions: ['Break into smaller paragraphs'],
        confidence: 0.7,
        originalText: line
      });
    }

    return issues;
  }

  /**
   * Calculate comprehensive readability metrics
   * @param {string} text - Text to analyze
   * @returns {Object} Readability metrics
   */
  calculateReadabilityMetrics(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.match(/\b\w+\b/g) || [];
    const syllables = this.countSyllables(text);
    const characters = text.replace(/\s/g, '').length;

    // Basic metrics
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgSyllablesPerWord = words.length > 0 ? syllables / words.length : 0;
    const avgCharsPerWord = words.length > 0 ? characters / words.length : 0;

    // Flesch Reading Ease Score
    const fleschScore = this.calculateFleschScore(words.length, sentences.length, syllables);
    
    // Flesch-Kincaid Grade Level
    const gradeLevel = this.calculateGradeLevel(words.length, sentences.length, syllables);

    return {
      score: Math.round(fleschScore),
      gradeLevel: Math.round(gradeLevel * 10) / 10,
      metrics: {
        words: words.length,
        sentences: sentences.length,
        syllables,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
        avgCharsPerWord: Math.round(avgCharsPerWord * 10) / 10
      },
      interpretation: this.getReadabilityInterpretation(fleschScore)
    };
  }

  /**
   * Count syllables in text (approximate)
   * @param {string} text - Text to analyze
   * @returns {number} Estimated syllable count
   */
  countSyllables(text) {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    let syllableCount = 0;

    for (const word of words) {
      // Simple syllable counting heuristic
      let wordSyllables = word.replace(/[^aeiouy]/g, '').length;
      
      // Adjust for common patterns
      if (word.endsWith('e')) wordSyllables--;
      if (word.includes('le') && word.length > 2) wordSyllables++;
      if (wordSyllables === 0) wordSyllables = 1;
      
      syllableCount += wordSyllables;
    }

    return syllableCount;
  }

  /**
   * Calculate Flesch Reading Ease Score
   * @param {number} words - Word count
   * @param {number} sentences - Sentence count
   * @param {number} syllables - Syllable count
   * @returns {number} Flesch score
   */
  calculateFleschScore(words, sentences, syllables) {
    if (sentences === 0 || words === 0) return 0;
    
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  /**
   * Calculate Flesch-Kincaid Grade Level
   * @param {number} words - Word count
   * @param {number} sentences - Sentence count
   * @param {number} syllables - Syllable count
   * @returns {number} Grade level
   */
  calculateGradeLevel(words, sentences, syllables) {
    if (sentences === 0 || words === 0) return 0;
    
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    return (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  }

  /**
   * Get human-readable interpretation of readability score
   * @param {number} score - Flesch reading ease score
   * @returns {string} Interpretation
   */
  getReadabilityInterpretation(score) {
    if (score >= 90) return 'Very Easy (5th grade level)';
    if (score >= 80) return 'Easy (6th grade level)';
    if (score >= 70) return 'Fairly Easy (7th grade level)';
    if (score >= 60) return 'Standard (8th-9th grade level)';
    if (score >= 50) return 'Fairly Difficult (10th-12th grade level)';
    if (score >= 30) return 'Difficult (13th-16th grade level)';
    return 'Very Difficult (Graduate level)';
  }

  /**
   * Get line number for a character position
   * @param {string} text - Full text
   * @param {number} position - Character position
   * @returns {number} Line number
   */
  getLineNumber(text, position) {
    const beforePosition = text.substring(0, position);
    return beforePosition.split('\n').length;
  }

  /**
   * Get column number for a character position
   * @param {string} text - Full text
   * @param {number} position - Character position
   * @returns {number} Column number
   */
  getColumn(text, position) {
    const beforePosition = text.substring(0, position);
    const lastNewlineIndex = beforePosition.lastIndexOf('\n');
    return position - lastNewlineIndex;
  }

  /**
   * Get severity level for write-good reasons
   * @param {string} reason - Write-good reason
   * @returns {string} Severity level
   */
  getSeverityForReason(reason) {
    const highSeverity = ['passive voice', 'wordy', 'cliche'];
    const mediumSeverity = ['weasel words', 'adverb'];
    
    if (highSeverity.some(r => reason.includes(r))) return 'warning';
    if (mediumSeverity.some(r => reason.includes(r))) return 'suggestion';
    return 'info';
  }

  /**
   * Get formatted message for write-good reasons
   * @param {string} reason - Write-good reason
   * @param {string} suggestion - Write-good suggestion
   * @returns {string} Formatted message
   */
  getMessageForReason(reason, suggestion) {
    const messages = {
      'passive voice': 'Consider using active voice for more direct writing',
      'wordy': 'This phrase is wordy. Consider using a more concise alternative',
      'weasel words': 'This is a weasel word that weakens your writing',
      'adverb': 'Adverbs can often be replaced with stronger verbs',
      'cliche': 'This is a cliche. Consider using original language'
    };

    for (const [key, message] of Object.entries(messages)) {
      if (reason.includes(key)) {
        return suggestion ? `${message}: "${suggestion}"` : message;
      }
    }

    return suggestion || 'Consider revising for clarity';
  }

  /**
   * Normalize write-good reason to rule name
   * @param {string} reason - Write-good reason
   * @returns {string} Normalized rule name
   */
  normalizeReason(reason) {
    return reason.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Get confidence score for write-good reasons
   * @param {string} reason - Write-good reason
   * @returns {number} Confidence score
   */
  getConfidenceForReason(reason) {
    const highConfidence = ['wordy', 'cliche'];
    const mediumConfidence = ['passive voice', 'weasel words'];
    
    if (highConfidence.some(r => reason.includes(r))) return 0.8;
    if (mediumConfidence.some(r => reason.includes(r))) return 0.6;
    return 0.5;
  }

  /**
   * Configure style analysis settings
   * @param {Object} settings - Style settings
   */
  configureSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current style settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return { ...this.settings };
  }
}

module.exports = StyleAnalyzer;
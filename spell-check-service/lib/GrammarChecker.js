/**
 * Grammar Checker - Phase 2 Implementation (Simplified)
 * Created: October 22, 2025 by AI Agent
 * Purpose: Grammar checking using custom rules and pattern matching
 * Features: Grammar rules, sentence structure, writing clarity (without retext dependencies)
 */

class GrammarChecker {
  constructor() {
    this.isInitialized = false;
    this.rules = {
      sentenceLength: true,
      passiveVoice: true,
      repeatedWords: true,
      capitalization: true,
      punctuation: true
    };
  }

  /**
   * Initialize the grammar checker
   */
  async init() {
    try {
      console.log('[GrammarChecker] Initializing simplified grammar checker...');
      this.isInitialized = true;
      console.log('[GrammarChecker] Grammar checker initialized successfully');
    } catch (error) {
      console.error('[GrammarChecker] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check text for grammar issues
   * @param {string} text - Text to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Grammar analysis results
   */
  async checkText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Grammar checker not initialized');
    }

    const issues = [];
    
    try {
      // Perform custom grammar checks
      const customIssues = await this.performCustomChecks(text);
      issues.push(...customIssues);

    } catch (error) {
      console.error('[GrammarChecker] Error processing text:', error);
      // Don't throw - return empty results on error
    }

    return {
      grammar: issues
    };
  }

  /**
   * Perform custom grammar checks not covered by retext
   * @param {string} text - Text to analyze
   * @returns {Array} Array of grammar issues
   */
  async performCustomChecks(text) {
    const issues = [];
    const lines = text.split('\n');
    let globalOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Skip markdown code blocks and headers
      if (this.shouldSkipLine(line)) {
        globalOffset += line.length + 1;
        continue;
      }

      // Check for long sentences
      if (this.rules.sentenceLength) {
        const sentenceIssues = this.checkSentenceLength(line, lineIndex + 1, globalOffset);
        issues.push(...sentenceIssues);
      }

      // Check for passive voice
      if (this.rules.passiveVoice) {
        const passiveIssues = this.checkPassiveVoice(line, lineIndex + 1, globalOffset);
        issues.push(...passiveIssues);
      }

      // Check for repeated words
      if (this.rules.repeatedWords) {
        const repeatIssues = this.checkRepeatedWords(line, lineIndex + 1, globalOffset);
        issues.push(...repeatIssues);
      }

      globalOffset += line.length + 1;
    }

    return issues;
  }

  /**
   * Check if a line should be skipped for grammar analysis
   * @param {string} line - Line to check
   * @returns {boolean} True if line should be skipped
   */
  shouldSkipLine(line) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) return true;
    
    // Skip markdown headers
    if (trimmed.startsWith('#')) return true;
    
    // Skip code blocks
    if (trimmed.startsWith('```') || trimmed.startsWith('    ')) return true;
    
    // Skip lists
    if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return true;
    
    // Skip links and images
    if (trimmed.startsWith('![') || trimmed.startsWith('[')) return true;
    
    return false;
  }

  /**
   * Check for overly long sentences
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of sentence length issues
   */
  checkSentenceLength(line, lineNumber, offset) {
    const issues = [];
    const sentences = line.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let sentenceOffset = 0;

    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      
      if (wordCount > 25) {
        const start = offset + sentenceOffset;
        const end = start + sentence.length;
        
        issues.push({
          type: 'grammar',
          severity: 'warning',
          message: `This sentence is quite long (${wordCount} words). Consider breaking it into shorter sentences for better readability.`,
          rule: 'sentence-length',
          position: { start, end },
          lineNumber,
          column: sentenceOffset + 1,
          suggestions: ['Consider breaking this into multiple sentences'],
          confidence: 0.8
        });
      }
      
      sentenceOffset += sentence.length + 1; // +1 for the delimiter
    }

    return issues;
  }

  /**
   * Check for passive voice usage
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of passive voice issues
   */
  checkPassiveVoice(line, lineNumber, offset) {
    const issues = [];
    
    // Simple passive voice detection patterns
    const passivePatterns = [
      /\b(was|were|is|are|am|be|been|being)\s+\w*ed\b/gi,
      /\b(was|were|is|are|am|be|been|being)\s+\w*en\b/gi
    ];

    for (const pattern of passivePatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const start = offset + match.index;
        const end = start + match[0].length;
        
        issues.push({
          type: 'grammar',
          severity: 'suggestion',
          message: 'Consider using active voice for more direct and engaging writing.',
          rule: 'passive-voice',
          position: { start, end },
          lineNumber,
          column: match.index + 1,
          suggestions: ['Rewrite in active voice'],
          confidence: 0.6
        });
      }
    }

    return issues;
  }

  /**
   * Check for repeated words
   * @param {string} line - Line to check
   * @param {number} lineNumber - Line number
   * @param {number} offset - Global character offset
   * @returns {Array} Array of repeated word issues
   */
  checkRepeatedWords(line, lineNumber, offset) {
    const issues = [];
    const words = line.toLowerCase().match(/\b\w+\b/g) || [];
    
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i] === words[i + 1] && words[i].length > 2) {
        // Find the position of the repeated word
        const wordRegex = new RegExp(`\\b${words[i]}\\s+${words[i]}\\b`, 'i');
        const match = wordRegex.exec(line);
        
        if (match) {
          const start = offset + match.index;
          const end = start + match[0].length;
          
          issues.push({
            type: 'grammar',
            severity: 'warning',
            message: `The word "${words[i]}" is repeated consecutively.`,
            rule: 'repeated-words',
            position: { start, end },
            lineNumber,
            column: match.index + 1,
            suggestions: [`Remove duplicate "${words[i]}"`],
            confidence: 0.9
          });
        }
      }
    }

    return issues;
  }

  /**
   * Enable or disable specific grammar rules
   * @param {Object} ruleConfig - Rule configuration object
   */
  configureRules(ruleConfig) {
    this.rules = { ...this.rules, ...ruleConfig };
  }

  /**
   * Get current rule configuration
   * @returns {Object} Current rule settings
   */
  getRuleConfiguration() {
    return { ...this.rules };
  }
}

module.exports = GrammarChecker;
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
   * Calculate comprehensive readability metrics - Phase 3 Enhancement
   * @param {string} text - Text to analyze
   * @returns {Object} Comprehensive readability metrics
   */
  calculateReadabilityMetrics(text) {
    const stats = this.getTextStatistics(text);
    
    // Calculate various readability metrics
    const fleschKincaid = this.calculateFleschKincaid(stats);
    const fleschReadingEase = this.calculateFleschReadingEase(stats);
    const gunningFog = this.calculateGunningFog(stats);
    const smogIndex = this.calculateSMOGIndex(stats);
    const automatedReadabilityIndex = this.calculateARI(stats);
    const colemanLiauIndex = this.calculateColemanLiau(stats);
    
    // Calculate average grade level from multiple metrics
    const gradeMetrics = [fleschKincaid, gunningFog, automatedReadabilityIndex, colemanLiauIndex];
    const averageGradeLevel = gradeMetrics.reduce((sum, metric) => sum + metric, 0) / gradeMetrics.length;
    
    return {
      // Raw statistics
      characters: stats.characters,
      charactersWithoutSpaces: stats.charactersWithoutSpaces,
      words: stats.words,
      sentences: stats.sentences,
      paragraphs: stats.paragraphs,
      syllables: stats.syllables,
      complexWords: stats.complexWords,
      
      // Readability scores
      fleschKincaid: Math.round(fleschKincaid * 10) / 10,
      fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
      gunningFog: Math.round(gunningFog * 10) / 10,
      smogIndex: Math.round(smogIndex * 10) / 10,
      automatedReadabilityIndex: Math.round(automatedReadabilityIndex * 10) / 10,
      colemanLiauIndex: Math.round(colemanLiauIndex * 10) / 10,
      
      // Averages
      averageWordsPerSentence: Math.round((stats.words / stats.sentences) * 10) / 10,
      averageSyllablesPerWord: Math.round((stats.syllables / stats.words) * 10) / 10,
      averageSentencesPerParagraph: Math.round((stats.sentences / stats.paragraphs) * 10) / 10,
      
      // Grade level interpretation
      averageGradeLevel: Math.round(averageGradeLevel * 10) / 10,
      gradeLevel: this.interpretGradeLevel(averageGradeLevel),
      readingEaseLevel: this.interpretReadingEase(fleschReadingEase),
      
      // Complexity indicators
      complexWordPercentage: Math.round((stats.complexWords / stats.words * 100) * 10) / 10,
      longSentenceCount: stats.longSentences,
      longWordCount: stats.longWords
    };
  }

  /**
   * Get comprehensive text statistics
   * @param {string} text - Text to analyze
   * @returns {Object} Text statistics
   */
  getTextStatistics(text) {
    // Clean text for analysis
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Basic counts
    const characters = cleanText.length;
    const charactersWithoutSpaces = cleanText.replace(/\s/g, '').length;
    const words = this.countWords(cleanText);
    const sentences = this.countSentences(cleanText);
    const paragraphs = this.countParagraphs(text);
    
    // Advanced counts
    const syllables = this.countSyllables(cleanText);
    const complexWords = this.countComplexWords(cleanText);
    const longSentences = this.countLongSentences(cleanText);
    const longWords = this.countLongWords(cleanText);
    
    return {
      characters,
      charactersWithoutSpaces,
      words,
      sentences: Math.max(1, sentences), // Avoid division by zero
      paragraphs: Math.max(1, paragraphs),
      syllables,
      complexWords,
      longSentences,
      longWords
    };
  }

  /**
   * Count words in text
   * @param {string} text - Text to analyze
   * @returns {number} Word count
   */
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in text
   * @param {string} text - Text to analyze
   * @returns {number} Sentence count
   */
  countSentences(text) {
    // Split on sentence endings, but be careful with abbreviations
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return Math.max(1, sentences.length);
  }

  /**
   * Count paragraphs in text
   * @param {string} text - Text to analyze
   * @returns {number} Paragraph count
   */
  countParagraphs(text) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return Math.max(1, paragraphs.length);
  }

  /**
   * Count syllables in text using improved algorithm
   * @param {string} text - Text to analyze
   * @returns {number} Syllable count
   */
  countSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;
    
    for (const word of words) {
      // Remove non-letters
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) continue;
      
      totalSyllables += this.countWordSyllables(cleanWord);
    }
    
    return Math.max(1, totalSyllables);
  }

  /**
   * Count syllables in a single word
   * @param {string} word - Word to analyze
   * @returns {number} Syllable count
   */
  countWordSyllables(word) {
    if (word.length <= 3) return 1;
    
    // Count vowel groups
    let syllables = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiouy'.includes(word[i]);
      
      if (isVowel && !previousWasVowel) {
        syllables++;
      }
      
      previousWasVowel = isVowel;
    }
    
    // Adjust for silent e
    if (word.endsWith('e') && syllables > 1) {
      syllables--;
    }
    
    // Adjust for some common patterns
    if (word.endsWith('le') && word.length > 2 && !'aeiou'.includes(word[word.length - 3])) {
      syllables++;
    }
    
    return Math.max(1, syllables);
  }

  /**
   * Count complex words (3+ syllables)
   * @param {string} text - Text to analyze
   * @returns {number} Complex word count
   */
  countComplexWords(text) {
    const words = text.toLowerCase().split(/\s+/);
    let complexCount = 0;
    
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) continue;
      
      const syllables = this.countWordSyllables(cleanWord);
      if (syllables >= 3) {
        complexCount++;
      }
    }
    
    return complexCount;
  }

  /**
   * Count long sentences (25+ words)
   * @param {string} text - Text to analyze
   * @returns {number} Long sentence count
   */
  countLongSentences(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let longCount = 0;
    
    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount >= 25) {
        longCount++;
      }
    }
    
    return longCount;
  }

  /**
   * Count long words (6+ characters)
   * @param {string} text - Text to analyze
   * @returns {number} Long word count
   */
  countLongWords(text) {
    const words = text.toLowerCase().split(/\s+/);
    let longCount = 0;
    
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length >= 6) {
        longCount++;
      }
    }
    
    return longCount;
  }

  /**
   * Calculate Flesch-Kincaid Grade Level
   * @param {Object} stats - Text statistics
   * @returns {number} Grade level
   */
  calculateFleschKincaid(stats) {
    const avgSentenceLength = stats.words / stats.sentences;
    const avgSyllablesPerWord = stats.syllables / stats.words;
    
    return (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;
  }

  /**
   * Calculate Flesch Reading Ease Score
   * @param {Object} stats - Text statistics
   * @returns {number} Reading ease score
   */
  calculateFleschReadingEase(stats) {
    const avgSentenceLength = stats.words / stats.sentences;
    const avgSyllablesPerWord = stats.syllables / stats.words;
    
    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  /**
   * Calculate Gunning Fog Index
   * @param {Object} stats - Text statistics
   * @returns {number} Fog index
   */
  calculateGunningFog(stats) {
    const avgSentenceLength = stats.words / stats.sentences;
    const complexWordPercentage = (stats.complexWords / stats.words) * 100;
    
    return 0.4 * (avgSentenceLength + complexWordPercentage);
  }

  /**
   * Calculate SMOG Index
   * @param {Object} stats - Text statistics
   * @returns {number} SMOG index
   */
  calculateSMOGIndex(stats) {
    if (stats.sentences < 30) {
      // For short texts, use simplified SMOG
      const complexWordPercentage = (stats.complexWords / stats.words);
      return 3 + Math.sqrt(30 * complexWordPercentage);
    }
    
    // Standard SMOG calculation
    const complexWordsPerSentence = stats.complexWords / stats.sentences;
    return 3 + Math.sqrt(30 * complexWordsPerSentence);
  }

  /**
   * Calculate Automated Readability Index (ARI)
   * @param {Object} stats - Text statistics
   * @returns {number} ARI score
   */
  calculateARI(stats) {
    const avgCharsPerWord = stats.charactersWithoutSpaces / stats.words;
    const avgWordsPerSentence = stats.words / stats.sentences;
    
    return (4.71 * avgCharsPerWord) + (0.5 * avgWordsPerSentence) - 21.43;
  }

  /**
   * Calculate Coleman-Liau Index
   * @param {Object} stats - Text statistics
   * @returns {number} Coleman-Liau index
   */
  calculateColemanLiau(stats) {
    const avgCharsPerWord = (stats.charactersWithoutSpaces / stats.words) * 100;
    const avgSentencesPer100Words = (stats.sentences / stats.words) * 100;
    
    return (0.0588 * avgCharsPerWord) - (0.296 * avgSentencesPer100Words) - 15.8;
  }

  /**
   * Interpret grade level as readable description
   * @param {number} gradeLevel - Numeric grade level
   * @returns {string} Grade level description
   */
  interpretGradeLevel(gradeLevel) {
    if (gradeLevel < 6) return 'Elementary school (5th grade and below)';
    if (gradeLevel < 9) return 'Middle school (6th-8th grade)';
    if (gradeLevel < 13) return 'High school (9th-12th grade)';
    if (gradeLevel < 16) return 'College level (13th-15th grade)';
    if (gradeLevel < 18) return 'College graduate level (16th-17th grade)';
    return 'Graduate level (18th grade and above)';
  }

  /**
   * Interpret Flesch Reading Ease score
   * @param {number} score - Reading ease score
   * @returns {string} Reading ease description
   */
  interpretReadingEase(score) {
    if (score >= 90) return 'Very Easy (5th grade level)';
    if (score >= 80) return 'Easy (6th grade level)';
    if (score >= 70) return 'Fairly Easy (7th grade level)';
    if (score >= 60) return 'Standard (8th-9th grade level)';
    if (score >= 50) return 'Fairly Difficult (10th-12th grade level)';
    if (score >= 30) return 'Difficult (college level)';
    return 'Very Difficult (graduate level)';
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
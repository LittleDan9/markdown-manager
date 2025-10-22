/**
 * Basic Spell Checker - Phase 1 Implementation
 * Created: October 22, 2025 by AI Agent
 * Purpose: Core spell checking functionality using nspell
 * Features: Word extraction, spell checking, suggestions, custom words
 */

const nspell = require('nspell');
const fs = require('fs');
const path = require('path');

class BasicSpellChecker {
  constructor() {
    this.speller = null;
    this.customWords = new Set();
    this.dictionaryPath = path.join(__dirname, '../dictionaries/en-US');
    this.affData = null;
    this.dicData = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the spell checker with dictionary data
   */
  async init() {
    try {
      console.log('[BasicSpellChecker] Loading dictionary files...');
      
      // Load affix file
      const affPath = path.join(this.dictionaryPath, 'index.aff');
      if (!fs.existsSync(affPath)) {
        throw new Error(`Dictionary affix file not found: ${affPath}`);
      }
      this.affData = fs.readFileSync(affPath, 'utf8');
      console.log('[BasicSpellChecker] Loaded .aff file');

      // Load dictionary file
      const dicPath = path.join(this.dictionaryPath, 'index.dic');
      if (!fs.existsSync(dicPath)) {
        throw new Error(`Dictionary file not found: ${dicPath}`);
      }
      this.dicData = fs.readFileSync(dicPath, 'utf8');
      console.log('[BasicSpellChecker] Loaded .dic file');

      // Initialize nspell
      this.speller = nspell(this.affData, this.dicData);
      this.isInitialized = true;
      
      console.log('[BasicSpellChecker] Dictionary initialized successfully');
      
    } catch (error) {
      console.error('[BasicSpellChecker] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check text for spelling errors
   * @param {string} text - Text to check
   * @param {string[]} customWords - Additional words to consider correct
   * @param {number} chunkOffset - Offset for chunked processing
   * @returns {Object} Results with spelling issues
   */
  async checkText(text, customWords = [], chunkOffset = 0) {
    if (!this.isInitialized) {
      throw new Error('Spell checker not initialized');
    }

    // Update custom words
    this.updateCustomWords(customWords);

    // Extract words with positions
    const wordData = this.extractWordsWithPositions(text);
    const issues = [];

    for (const { word, startPos, endPos, lineNumber, column } of wordData) {
      // Skip if word is in custom dictionary
      if (this.customWords.has(word.toLowerCase())) {
        continue;
      }

      // Check spelling
      if (!this.speller.correct(word)) {
        const suggestions = this.speller.suggest(word);
        
        issues.push({
          word,
          suggestions: suggestions.slice(0, 5), // Limit to top 5 suggestions
          position: {
            start: startPos + chunkOffset,
            end: endPos + chunkOffset
          },
          lineNumber,
          column,
          type: 'spelling',
          severity: 'error',
          confidence: this.calculateConfidence(word, suggestions)
        });
      }
    }

    return {
      spelling: issues
    };
  }

  /**
   * Extract words with their positions in the text
   * @param {string} text - Text to process
   * @returns {Array} Array of word objects with positions
   */
  extractWordsWithPositions(text) {
    const words = [];
    const lines = text.split('\n');
    let globalOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const wordRegex = /\b[A-Za-z']+\b/g;
      let match;

      while ((match = wordRegex.exec(line)) !== null) {
        const word = match[0];
        const startPos = globalOffset + match.index;
        const endPos = startPos + word.length;
        const column = match.index + 1;

        // Skip words that are likely markdown syntax or URLs
        if (this.shouldSkipWord(word, line, match.index)) {
          continue;
        }

        words.push({
          word,
          startPos,
          endPos,
          lineNumber: lineIndex + 1,
          column
        });
      }

      // Add 1 for the newline character
      globalOffset += line.length + 1;
    }

    return words;
  }

  /**
   * Determine if a word should be skipped (e.g., in code blocks, URLs)
   * @param {string} word - The word to check
   * @param {string} line - The line containing the word
   * @param {number} wordIndex - Position of word in the line
   * @returns {boolean} True if word should be skipped
   */
  shouldSkipWord(word, line, wordIndex) {
    // Skip single letters (except 'a' and 'I')
    if (word.length === 1 && !['a', 'A', 'i', 'I'].includes(word)) {
      return true;
    }

    // Skip words in code blocks (basic detection)
    if (line.includes('```') || line.trim().startsWith('    ')) {
      return true;
    }

    // Skip words that are part of inline code
    const beforeWord = line.substring(0, wordIndex);
    const afterWord = line.substring(wordIndex + word.length);
    const backticksBefore = (beforeWord.match(/`/g) || []).length;
    const backticksAfter = (afterWord.match(/`/g) || []).length;
    
    if (backticksBefore % 2 === 1) {
      return true; // Inside inline code
    }

    // Skip words in URLs (basic detection)
    if (line.includes('http://') || line.includes('https://') || line.includes('www.')) {
      const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/g;
      const urlMatches = [...line.matchAll(urlRegex)];
      
      for (const urlMatch of urlMatches) {
        const urlStart = urlMatch.index;
        const urlEnd = urlStart + urlMatch[0].length;
        
        if (wordIndex >= urlStart && wordIndex < urlEnd) {
          return true;
        }
      }
    }

    // Skip words in email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = [...line.matchAll(emailRegex)];
    
    for (const emailMatch of emailMatches) {
      const emailStart = emailMatch.index;
      const emailEnd = emailStart + emailMatch[0].length;
      
      if (wordIndex >= emailStart && wordIndex < emailEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update the custom words dictionary
   * @param {string[]} customWords - Array of custom words
   */
  updateCustomWords(customWords) {
    this.customWords.clear();
    
    for (const word of customWords) {
      if (word && typeof word === 'string') {
        this.customWords.add(word.toLowerCase());
        // Also add the word to nspell for future suggestions
        this.speller.add(word);
      }
    }
  }

  /**
   * Calculate confidence score for a spelling suggestion
   * @param {string} word - Original word
   * @param {string[]} suggestions - Array of suggestions
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidence(word, suggestions) {
    if (!suggestions || suggestions.length === 0) {
      return 0.1; // Low confidence if no suggestions
    }

    // Simple confidence calculation based on edit distance
    const topSuggestion = suggestions[0];
    const editDistance = this.calculateEditDistance(word.toLowerCase(), topSuggestion.toLowerCase());
    const maxLength = Math.max(word.length, topSuggestion.length);
    
    // Higher confidence for smaller edit distances
    const confidence = Math.max(0.3, 1 - (editDistance / maxLength));
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  calculateEditDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Count words in text
   * @param {string} text - Text to count
   * @returns {number} Word count
   */
  countWords(text) {
    const words = text.match(/\b[A-Za-z']+\b/g);
    return words ? words.length : 0;
  }

  /**
   * Get count of custom words
   * @returns {number} Number of custom words
   */
  getCustomWordCount() {
    return this.customWords.size;
  }
}

module.exports = BasicSpellChecker;
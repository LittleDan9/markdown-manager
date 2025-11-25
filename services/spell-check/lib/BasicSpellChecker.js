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

    // First, find all code regions in the document
    const codeRegions = this.findCodeRegions(text);

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

        // Skip words that are in code regions or other excluded content
        if (this.shouldSkipWord(word, line, match.index, startPos, codeRegions)) {
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
   * Find code regions in Markdown text (fenced and indented)
   * @param {string} text - The text to analyze
   * @returns {Array<{start: number, end: number, type: string}>} Array of code regions
   */
  findCodeRegions(text) {
    const regions = [];
    const lines = text.split('\n');
    let currentPos = 0;
    let inCodeFence = false;
    let fenceStart = 0;
    let fencePattern = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = currentPos;
      const lineEnd = currentPos + line.length;

      // Check for fenced code blocks (``` or ~~~)
      const fenceMatch = line.match(/^\s*(```|~~~)(.*)$/);
      if (fenceMatch) {
        if (!inCodeFence) {
          inCodeFence = true;
          fenceStart = lineStart;
          fencePattern = fenceMatch[1];
        } else if (fenceMatch[1] === fencePattern) {
          inCodeFence = false;
          regions.push({ start: fenceStart, end: lineEnd, type: 'fenced' });
        }
      }

      // Check for indented code blocks (4+ spaces or tabs, not in lists)
      else if (!inCodeFence && /^(?: {4,}|\t+)/.test(line) && line.trim()) {
        // Make sure this isn't a list item with indentation
        const trimmed = line.trim();
        const isListItem = /^([-*+]|\d+\.)\s/.test(trimmed);

        if (!isListItem) {
          const indentStart = lineStart;
          let indentEnd = lineEnd;

          // Extend to include consecutive indented lines and blank lines
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextLineStart = currentPos + line.length + 1;

            // Include if it's indented or a blank line (continuation)
            if (/^(?: {4,}|\t+)/.test(nextLine) || !nextLine.trim()) {
              indentEnd = nextLineStart + nextLine.length;
              currentPos = nextLineStart;
              j++;
            } else {
              break;
            }
          }

          regions.push({ start: indentStart, end: indentEnd, type: 'indented' });
          i = j - 1; // Skip processed lines
          continue;
        }
      }

      currentPos = lineEnd + 1;
    }

    // Handle unclosed fence
    if (inCodeFence) {
      regions.push({ start: fenceStart, end: text.length, type: 'fenced' });
    }

    // Find inline code spans
    const inlineCodeRegions = this.findInlineCodeRegions(text);
    regions.push(...inlineCodeRegions);

    // Sort regions by start position and merge overlapping ones
    return this.mergeOverlappingRegions(regions.sort((a, b) => a.start - b.start));
  }

  /**
   * Find inline code spans (`code` and ``code``)
   * @param {string} text - The text to search
   * @returns {Array<{start: number, end: number, type: string}>} Array of inline code regions
   */
  findInlineCodeRegions(text) {
    const regions = [];

    // Find single backtick code spans
    const singleBacktickRegex = /`[^`\n]*`/g;
    let match;
    while ((match = singleBacktickRegex.exec(text)) !== null) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'inline'
      });
    }

    // Find double backtick code spans
    const doubleBacktickRegex = /``[^`\n]*``/g;
    doubleBacktickRegex.lastIndex = 0;
    while ((match = doubleBacktickRegex.exec(text)) !== null) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'inline'
      });
    }

    return regions;
  }

  /**
   * Merge overlapping code regions
   * @param {Array} regions - Sorted array of regions
   * @returns {Array} Array of merged regions
   */
  mergeOverlappingRegions(regions) {
    if (regions.length <= 1) return regions;

    const merged = [regions[0]];

    for (let i = 1; i < regions.length; i++) {
      const current = regions[i];
      const last = merged[merged.length - 1];

      if (current.start <= last.end) {
        // Overlapping regions - merge them
        last.end = Math.max(last.end, current.end);
        last.type = last.type === current.type ? last.type : 'mixed';
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Determine if a word should be skipped (e.g., in code blocks, URLs)
   * @param {string} word - The word to check
   * @param {string} line - The line containing the word
   * @param {number} wordIndex - Position of word in the line
   * @param {number} globalPos - Global position of the word in the text
   * @param {Array} codeRegions - Pre-computed code regions
   * @returns {boolean} True if word should be skipped
   */
  shouldSkipWord(word, line, wordIndex, globalPos, codeRegions = []) {
    // Skip single letters (except 'a' and 'I')
    if (word.length === 1 && !['a', 'A', 'i', 'I'].includes(word)) {
      return true;
    }

    // Check if word is within any code region
    const isInCodeRegion = codeRegions.some(region =>
      globalPos >= region.start && globalPos < region.end
    );

    if (isInCodeRegion) {
      return true;
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

    // Skip words that look like code identifiers (camelCase, snake_case, etc.)
    if (/^[a-z]+[A-Z]/.test(word) || word.includes('_') || /^[A-Z_]+$/.test(word)) {
      return true;
    }

    // Skip words that are likely file extensions or technical terms
    if (word.length <= 4 && /^[a-z]{2,4}$/.test(word) &&
        ['js', 'ts', 'css', 'html', 'json', 'xml', 'php', 'py', 'rb', 'go', 'rs'].includes(word.toLowerCase())) {
      return true;
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
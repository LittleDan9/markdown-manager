/**
 * Text Manipulation Utilities
 * Helper functions for text processing and analysis
 */

/**
 * Get line number for a given position in text
 * @param {string} text - The full text
 * @param {number} position - Character position
 * @returns {number} Line number (1-based)
 */
function getLineNumber(text, position) {
  if (position < 0 || position >= text.length) {
    return 1;
  }
  return text.substring(0, position).split('\n').length;
}

/**
 * Get column number for a given position in text
 * @param {string} text - The full text
 * @param {number} position - Character position
 * @returns {number} Column number (1-based)
 */
function getColumnNumber(text, position) {
  if (position < 0 || position >= text.length) {
    return 1;
  }

  const textBefore = text.substring(0, position);
  const lastNewlineIndex = textBefore.lastIndexOf('\n');

  return position - lastNewlineIndex;
}

/**
 * Count words in text using spell checker compatible method
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Remove markdown formatting and code blocks
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
    .replace(/[*_~`#\-+=|\\]/g, ' ') // Remove markdown symbols
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (!cleanText) {
    return 0;
  }

  return cleanText.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extract sentences from text
 * @param {string} text - Text to extract sentences from
 * @returns {Array<{text: string, start: number, end: number}>} Array of sentences with positions
 */
function extractSentences(text) {
  const sentences = [];
  const sentenceRegex = /[.!?]+/g;
  let lastEnd = 0;
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentenceEnd = match.index + match[0].length;
    const sentenceText = text.substring(lastEnd, sentenceEnd).trim();

    if (sentenceText.length > 0) {
      sentences.push({
        text: sentenceText,
        start: lastEnd,
        end: sentenceEnd
      });
    }

    lastEnd = sentenceEnd;
  }

  // Handle remaining text if no sentence ending found
  if (lastEnd < text.length) {
    const remainingText = text.substring(lastEnd).trim();
    if (remainingText.length > 0) {
      sentences.push({
        text: remainingText,
        start: lastEnd,
        end: text.length
      });
    }
  }

  return sentences;
}

/**
 * Find word boundaries around a position
 * @param {string} text - The full text
 * @param {number} position - Position within a word
 * @returns {{start: number, end: number, word: string}} Word boundaries and text
 */
function findWordBoundaries(text, position) {
  const wordRegex = /\b\w+\b/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    if (position >= match.index && position < match.index + match[0].length) {
      return {
        start: match.index,
        end: match.index + match[0].length,
        word: match[0]
      };
    }
  }

  // Fallback: try to find word manually
  let start = position;
  let end = position;

  // Find word start
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }

  // Find word end
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  return {
    start,
    end,
    word: text.substring(start, end)
  };
}

/**
 * Extract context around a position
 * @param {string} text - The full text
 * @param {number} position - Center position
 * @param {number} contextLength - Characters to include before and after
 * @returns {{before: string, after: string, full: string}} Context information
 */
function extractContext(text, position, contextLength = 100) {
  const start = Math.max(0, position - contextLength);
  const end = Math.min(text.length, position + contextLength);

  const before = text.substring(start, position);
  const after = text.substring(position, end);
  const full = text.substring(start, end);

  return { before, after, full };
}

/**
 * Sanitize text for logging (remove sensitive information)
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum length to return
 * @returns {string} Sanitized text
 */
function sanitizeForLogging(text, maxLength = 200) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Replace potential sensitive patterns
  let sanitized = text
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD-NUMBER]') // Credit card numbers
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // Social security numbers
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email addresses
    .replace(/\b(?:\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g, '[PHONE]'); // Phone numbers

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...[TRUNCATED]';
  }

  return sanitized;
}

/**
 * Calculate reading time estimate
 * @param {string} text - Text to analyze
 * @param {number} wordsPerMinute - Reading speed (default: 200 WPM)
 * @returns {{minutes: number, seconds: number, totalSeconds: number}} Reading time
 */
function calculateReadingTime(text, wordsPerMinute = 200) {
  const wordCount = countWords(text);
  const totalSeconds = Math.ceil((wordCount / wordsPerMinute) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes,
    seconds,
    totalSeconds,
    wordCount
  };
}

/**
 * Extract code blocks from markdown text
 * @param {string} text - Markdown text
 * @returns {Array<{language: string, code: string, start: number, end: number}>} Code blocks
 */
function extractCodeBlocks(text) {
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return codeBlocks;
}

module.exports = {
  getLineNumber,
  getColumnNumber,
  countWords,
  extractSentences,
  findWordBoundaries,
  extractContext,
  sanitizeForLogging,
  calculateReadingTime,
  extractCodeBlocks
};
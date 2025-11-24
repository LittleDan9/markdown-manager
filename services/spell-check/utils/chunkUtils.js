/**
 * Text Chunking Utilities
 * Functions for splitting large texts into manageable chunks for batch processing
 */

const { getLineNumber } = require('./textUtils');

/**
 * Split text into chunks with smart boundary detection
 * @param {string} text - Text to split
 * @param {number} chunkSize - Target chunk size in characters
 * @param {Object} options - Chunking options
 * @returns {Array<{text: string, offset: number, length: number, lineStart: number}>} Array of chunks
 */
function splitTextIntoChunks(text, chunkSize = 10000, options = {}) {
  const {
    preserveSentences = true,
    preserveParagraphs = true,
    maxBoundarySearch = 200,
    minChunkSize = 1000
  } = options;

  const chunks = [];
  let offset = 0;

  while (offset < text.length) {
    const chunkEnd = Math.min(offset + chunkSize, text.length);

    let actualEnd = chunkEnd;

    // If we're not at the end of text, try to find a good boundary
    if (chunkEnd < text.length) {
      actualEnd = findOptimalChunkBoundary(
        text,
        offset,
        chunkEnd,
        { preserveSentences, preserveParagraphs, maxBoundarySearch }
      );

      // Ensure minimum chunk size
      if (actualEnd - offset < minChunkSize && offset > 0) {
        actualEnd = Math.min(offset + minChunkSize, text.length);
      }
    }

    const chunkText = text.substring(offset, actualEnd);
    const lineStart = getLineNumber(text, offset);

    chunks.push({
      text: chunkText,
      offset: offset,
      length: actualEnd - offset,
      lineStart: lineStart,
      lineEnd: getLineNumber(text, actualEnd - 1)
    });

    offset = actualEnd;
  }

  return chunks;
}

/**
 * Find optimal chunk boundary
 * @param {string} text - Full text
 * @param {number} start - Chunk start position
 * @param {number} preferredEnd - Preferred chunk end position
 * @param {Object} options - Boundary detection options
 * @returns {number} Actual end position
 */
function findOptimalChunkBoundary(text, start, preferredEnd, options = {}) {
  const {
    preserveSentences = true,
    preserveParagraphs = true,
    maxBoundarySearch = 200
  } = options;

  const searchStart = Math.max(start, preferredEnd - maxBoundarySearch);
  const searchText = text.substring(searchStart, preferredEnd);

  // Priority 1: Try to break at paragraph boundaries
  if (preserveParagraphs) {
    const paragraphBoundary = findParagraphBoundary(searchText);
    if (paragraphBoundary > 0) {
      return searchStart + paragraphBoundary;
    }
  }

  // Priority 2: Try to break at sentence boundaries
  if (preserveSentences) {
    const sentenceBoundary = findSentenceBoundary(searchText);
    if (sentenceBoundary > 0) {
      return searchStart + sentenceBoundary;
    }
  }

  // Priority 3: Try to break at word boundaries
  const wordBoundary = findWordBoundary(searchText);
  if (wordBoundary > 0) {
    return searchStart + wordBoundary;
  }

  // Priority 4: Try to break at line boundaries
  const lineBoundary = findLineBoundary(searchText);
  if (lineBoundary > 0) {
    return searchStart + lineBoundary;
  }

  // Fallback: use preferred end
  return preferredEnd;
}

/**
 * Find paragraph boundary (double newline or markdown header)
 * @param {string} text - Text to search
 * @returns {number} Position of boundary, or -1 if not found
 */
function findParagraphBoundary(text) {
  // Look for double newlines (paragraph breaks)
  const doubleNewline = text.lastIndexOf('\n\n');
  if (doubleNewline > 0) {
    return doubleNewline + 2;
  }

  // Look for markdown headers
  const headerPattern = /\n(#{1,6}\s)/g;
  let match;
  let lastMatch = -1;

  while ((match = headerPattern.exec(text)) !== null) {
    lastMatch = match.index + 1; // Position after the newline
  }

  return lastMatch;
}

/**
 * Find sentence boundary
 * @param {string} text - Text to search
 * @returns {number} Position of boundary, or -1 if not found
 */
function findSentenceBoundary(text) {
  // Look for sentence endings followed by space or newline
  const sentencePattern = /[.!?]+[\s\n]/g;
  let match;
  let lastMatch = -1;

  while ((match = sentencePattern.exec(text)) !== null) {
    lastMatch = match.index + match[0].length;
  }

  return lastMatch;
}

/**
 * Find word boundary
 * @param {string} text - Text to search
 * @returns {number} Position of boundary, or -1 if not found
 */
function findWordBoundary(text) {
  // Look for whitespace that indicates word boundaries
  const whitespacePattern = /\s+/g;
  let match;
  let lastMatch = -1;

  while ((match = whitespacePattern.exec(text)) !== null) {
    lastMatch = match.index + match[0].length;
  }

  return lastMatch;
}

/**
 * Find line boundary
 * @param {string} text - Text to search
 * @returns {number} Position of boundary, or -1 if not found
 */
function findLineBoundary(text) {
  const lastNewline = text.lastIndexOf('\n');
  return lastNewline > 0 ? lastNewline + 1 : -1;
}

/**
 * Merge chunk results back together, adjusting positions
 * @param {Array} chunkResults - Results from processing individual chunks
 * @param {Array} chunks - Original chunk information
 * @returns {Object} Merged results with corrected positions
 */
function mergeChunkResults(chunkResults, chunks) {
  const mergedResults = {
    spelling: [],
    grammar: [],
    style: [],
    codeSpelling: []
  };

  chunkResults.forEach((result, index) => {
    const chunk = chunks[index];

    // Adjust positions for each result type
    ['spelling', 'grammar', 'style', 'codeSpelling'].forEach(resultType => {
      if (result[resultType]) {
        result[resultType].forEach(issue => {
          // Adjust character positions
          if (issue.position) {
            issue.position.start += chunk.offset;
            issue.position.end += chunk.offset;
          }

          // Adjust line numbers
          if (issue.lineNumber) {
            issue.globalLineNumber = issue.lineNumber + chunk.lineStart - 1;
          }

          // Add chunk information for debugging
          issue.chunkInfo = {
            chunkIndex: index,
            chunkOffset: chunk.offset,
            originalLineNumber: issue.lineNumber
          };

          mergedResults[resultType].push(issue);
        });
      }
    });
  });

  // Sort results by position
  ['spelling', 'grammar', 'style', 'codeSpelling'].forEach(resultType => {
    mergedResults[resultType].sort((a, b) => {
      const aPos = a.position ? a.position.start : 0;
      const bPos = b.position ? b.position.start : 0;
      return aPos - bPos;
    });
  });

  return mergedResults;
}

/**
 * Calculate optimal chunk size based on text characteristics
 * @param {string} text - Text to analyze
 * @param {Object} options - Analysis options
 * @returns {number} Recommended chunk size
 */
function calculateOptimalChunkSize(text, options = {}) {
  const {
    baseChunkSize = 10000,
    minChunkSize = 5000,
    maxChunkSize = 20000
  } = options;

  const textLength = text.length;

  // For small texts, use the entire text
  if (textLength <= minChunkSize) {
    return textLength;
  }

  // Calculate paragraph density
  const paragraphs = text.split('\n\n').length;
  const avgParagraphLength = textLength / paragraphs;

  // Adjust chunk size based on paragraph structure
  let recommendedSize = baseChunkSize;

  if (avgParagraphLength > baseChunkSize * 0.8) {
    // Long paragraphs - use larger chunks
    recommendedSize = Math.min(maxChunkSize, avgParagraphLength * 1.5);
  } else if (avgParagraphLength < baseChunkSize * 0.2) {
    // Short paragraphs - use smaller chunks to preserve structure
    recommendedSize = Math.max(minChunkSize, avgParagraphLength * 10);
  }

  return Math.round(recommendedSize);
}

/**
 * Validate chunk configuration
 * @param {Object} config - Chunk configuration
 * @returns {{valid: boolean, errors: Array<string>}} Validation result
 */
function validateChunkConfig(config) {
  const errors = [];
  const {
    chunkSize,
    maxBoundarySearch,
    minChunkSize,
    preserveSentences,
    preserveParagraphs
  } = config;

  if (typeof chunkSize !== 'number' || chunkSize <= 0) {
    errors.push('chunkSize must be a positive number');
  }

  if (maxBoundarySearch && (typeof maxBoundarySearch !== 'number' || maxBoundarySearch < 0)) {
    errors.push('maxBoundarySearch must be a non-negative number');
  }

  if (minChunkSize && (typeof minChunkSize !== 'number' || minChunkSize <= 0)) {
    errors.push('minChunkSize must be a positive number');
  }

  if (chunkSize && minChunkSize && chunkSize < minChunkSize) {
    errors.push('chunkSize must be greater than or equal to minChunkSize');
  }

  if (preserveSentences !== undefined && typeof preserveSentences !== 'boolean') {
    errors.push('preserveSentences must be a boolean');
  }

  if (preserveParagraphs !== undefined && typeof preserveParagraphs !== 'boolean') {
    errors.push('preserveParagraphs must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  splitTextIntoChunks,
  findOptimalChunkBoundary,
  mergeChunkResults,
  calculateOptimalChunkSize,
  validateChunkConfig,
  findParagraphBoundary,
  findSentenceBoundary,
  findWordBoundary,
  findLineBoundary
};
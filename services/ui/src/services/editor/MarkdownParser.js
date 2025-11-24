// src/services/editor/MarkdownParser.js

/**
 * Unified markdown parser for consistent code region detection
 * across chunking and spell check workers
 */
export class MarkdownParser {
  /**
   * Comprehensive code region detection
   * Handles: ```, ~~~, indented blocks, <pre>, <code>, inline code
   * @param {string} text - The text to analyze
   * @returns {Array<{start: number, end: number, type: string}>} Array of code regions
   */
  static findCodeRegions(text) {
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
            const nextPos = currentPos + line.length + 1;

            // Include if it's indented or a blank line (continuation)
            if (/^(?: {4,}|\t+)/.test(nextLine) || !nextLine.trim()) {
              indentEnd = nextPos + nextLine.length;
              currentPos = nextPos;
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

    // Find HTML code blocks and inline code
    const htmlCodeRegions = this._findHtmlCodeBlocks(text);
    regions.push(...htmlCodeRegions);

    // Sort regions by start position and merge overlapping ones
    return this._mergeOverlappingRegions(regions.sort((a, b) => a.start - b.start));
  }

  /**
   * Find HTML code blocks and inline code
   * @param {string} text - The text to search
   * @returns {Array<{start: number, end: number, type: string}>} Array of HTML code regions
   * @private
   */
  static _findHtmlCodeBlocks(text) {
    const regions = [];

    // Patterns for different HTML code elements and inline code
    const patterns = [
      { regex: /<pre\b[^>]*>[\s\S]*?<\/pre>/gi, type: 'html-pre' },
      { regex: /<code\b[^>]*>[\s\S]*?<\/code>/gi, type: 'html-code' },
      { regex: /`[^`\n]*`/g, type: 'inline-code' }, // Inline code spans
      { regex: /``[^`\n]*``/g, type: 'inline-code' }, // Double backticks
    ];

    patterns.forEach(({ regex, type }) => {
      let match;
      regex.lastIndex = 0; // Reset regex
      while ((match = regex.exec(text)) !== null) {
        regions.push({
          start: match.index,
          end: match.index + match[0].length,
          type
        });
      }
    });

    return regions;
  }

  /**
   * Merge overlapping code regions to avoid conflicts
   * @param {Array} regions - Sorted array of regions
   * @returns {Array} Array of merged regions
   * @private
   */
  static _mergeOverlappingRegions(regions) {
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
   * Check if a given position is within any code region
   * @param {number} position - The position to check
   * @param {Array} codeRegions - Array of code regions
   * @returns {boolean} True if position is in a code region
   */
  static isInCodeRegion(position, codeRegions) {
    return codeRegions.some(region =>
      position >= region.start && position < region.end
    );
  }

  /**
   * Get code regions that intersect with a specific text range
   * @param {Array} codeRegions - Array of all code regions
   * @param {number} rangeStart - Start of the range
   * @param {number} rangeEnd - End of the range
   * @returns {Array} Array of intersecting code regions adjusted for the range
   */
  static getCodeRegionsInRange(codeRegions, rangeStart, rangeEnd) {
    return codeRegions
      .filter(region =>
        // Region overlaps with the range
        region.start < rangeEnd && region.end > rangeStart
      )
      .map(region => ({
        ...region,
        // Adjust positions relative to the range start
        start: Math.max(0, region.start - rangeStart),
        end: Math.min(rangeEnd - rangeStart, region.end - rangeStart)
      }));
  }
}

export default MarkdownParser;
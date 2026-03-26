/**
 * HeadingExtractor - Extracts headings from markdown content for outline display.
 * Parses ATX-style headings (# through ######) respecting fenced code blocks.
 */

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const FENCE_REGEX = /^(`{3,}|~{3,})/;

/**
 * Extract headings from markdown content.
 * @param {string} content - Raw markdown text
 * @returns {Array<{level: number, text: string, line: number}>}
 */
export function extractHeadings(content) {
  if (!content) return [];

  const lines = content.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track fenced code blocks
    if (FENCE_REGEX.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(HEADING_REGEX);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim().replace(/\s*#+\s*$/, ''), // Remove trailing # markers
        line: i + 1, // 1-indexed
      });
    }
  }

  return headings;
}

/**
 * Build a nested tree structure from flat heading list.
 * Each node has: { level, text, line, children: [] }
 * @param {Array} headings - Flat heading list from extractHeadings
 * @returns {Array} Nested heading tree
 */
export function buildHeadingTree(headings) {
  if (!headings.length) return [];

  const root = { level: 0, children: [] };
  const stack = [root];

  for (const heading of headings) {
    const node = { ...heading, children: [] };

    // Pop stack until we find a parent with lower level
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children;
}

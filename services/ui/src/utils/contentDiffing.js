/**
 * Content diffing utilities for incremental Markdown rendering
 * Identifies changed sections to enable targeted DOM updates
 */

/**
 * Split content into logical sections for diffing
 * @param {string} content - Markdown content
 * @returns {Array} Array of content sections with metadata
 */
export function splitIntoSections(content) {
  if (!content) return [];

  const lines = content.split('\n');
  const sections = [];
  let currentSection = { type: 'paragraph', lines: [], startLine: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for section boundaries
    const isHeading = trimmed.startsWith('#');
    const isCodeBlock = trimmed.startsWith('```') || currentSection.type === 'code';
    const isList = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('1. ');
    const isEmpty = trimmed === '';

    // If we're starting a new section type, finalize the current one
    if ((isHeading && currentSection.type !== 'heading') ||
        (isCodeBlock && currentSection.type !== 'code') ||
        (isList && currentSection.type !== 'list') ||
        (isEmpty && currentSection.lines.length > 0)) {

      if (currentSection.lines.length > 0) {
        sections.push({
          ...currentSection,
          content: currentSection.lines.join('\n'),
          endLine: i - 1,
          hash: hashContent(currentSection.lines.join('\n'))
        });
      }

      // Start new section
      if (isHeading) {
        currentSection = { type: 'heading', lines: [line], startLine: i };
      } else if (isCodeBlock) {
        currentSection = { type: 'code', lines: [line], startLine: i };
      } else if (isList) {
        currentSection = { type: 'list', lines: [line], startLine: i };
      } else {
        currentSection = { type: 'paragraph', lines: [line], startLine: i };
      }
    } else {
      currentSection.lines.push(line);
    }
  }

  // Add final section
  if (currentSection.lines.length > 0) {
    sections.push({
      ...currentSection,
      content: currentSection.lines.join('\n'),
      endLine: lines.length - 1,
      hash: hashContent(currentSection.lines.join('\n'))
    });
  }

  return sections;
}

/**
 * Compare two sets of content sections to identify changes
 * @param {Array} oldSections - Previous content sections
 * @param {Array} newSections - New content sections
 * @returns {Object} Diff result with added, removed, and modified sections
 */
export function diffSections(oldSections, newSections) {
  const changes = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };

  // Create maps for efficient lookup
  const oldMap = new Map(oldSections.map(section => [section.hash, section]));
  const newMap = new Map(newSections.map(section => [section.hash, section]));

  // Find unchanged sections
  oldSections.forEach(section => {
    if (newMap.has(section.hash)) {
      changes.unchanged.push(section);
    } else {
      changes.removed.push(section);
    }
  });

  // Find added and modified sections
  newSections.forEach((section, index) => {
    if (!oldMap.has(section.hash)) {
      // Check if this is a modification of an existing section
      const oldSection = oldSections[index];
      if (oldSection && oldSection.type === section.type) {
        changes.modified.push({
          oldSection,
          newSection: section,
          index
        });
      } else {
        changes.added.push(section);
      }
    }
  });

  return changes;
}

/**
 * Simple content hash function
 * @param {string} content - Content to hash
 * @returns {string} Hash string
 */
function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

/**
 * Extract code blocks and diagrams from content for targeted processing
 * @param {string} content - Markdown content
 * @returns {Object} Extracted blocks with metadata
 */
export function extractProcessableBlocks(content) {
  const blocks = {
    codeBlocks: [],
    mermaidDiagrams: []
  };

  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = -1;
  let codeLanguage = '';
  let codeContent = [];

  let inMermaidBlock = false;
  let mermaidStart = -1;
  let mermaidContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;
        codeBlockStart = i;
        codeLanguage = trimmed.substring(3).trim();
        codeContent = [];
      } else {
        // End of code block
        inCodeBlock = false;
        blocks.codeBlocks.push({
          startLine: codeBlockStart,
          endLine: i,
          language: codeLanguage,
          content: codeContent.join('\n'),
          hash: hashContent(codeLanguage + codeContent.join('\n'))
        });
      }
    } else if (inCodeBlock) {
      codeContent.push(line);
    }

    // Handle Mermaid diagrams
    if (trimmed.toLowerCase() === '```mermaid') {
      inMermaidBlock = true;
      mermaidStart = i;
      mermaidContent = [];
    } else if (inMermaidBlock && trimmed === '```') {
      inMermaidBlock = false;
      blocks.mermaidDiagrams.push({
        startLine: mermaidStart,
        endLine: i,
        content: mermaidContent.join('\n'),
        hash: hashContent(mermaidContent.join('\n'))
      });
    } else if (inMermaidBlock) {
      mermaidContent.push(line);
    }
  }

  return blocks;
}
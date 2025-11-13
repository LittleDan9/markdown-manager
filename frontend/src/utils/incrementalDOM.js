/**
 * Incremental DOM update utilities for Markdown preview
 * Updates only changed sections instead of full re-renders
 */

import { extractProcessableBlocks } from './contentDiffing';

/**
 * Update the preview DOM incrementally based on content changes
 * @param {string} newContent - New Markdown content
 * @param {string} oldContent - Previous Markdown content
 * @param {HTMLElement} container - Preview container element
 * @param {Object} options - Update options
 */
export async function updatePreviewIncrementally(newContent, oldContent, container, options = {}) {
  const {
    onHighlightNeeded = () => {},
    onMermaidNeeded = () => {},
    onUpdateComplete = () => {}
  } = options;

  try {
    // Extract blocks that need processing from new content
    const newBlocks = extractProcessableBlocks(newContent);
    const oldBlocks = extractProcessableBlocks(oldContent || '');

    // Find blocks that need updating
    const codeBlocksToUpdate = findBlocksToUpdate(newBlocks.codeBlocks, oldBlocks.codeBlocks);
    const mermaidBlocksToUpdate = findBlocksToUpdate(newBlocks.mermaidDiagrams, oldBlocks.mermaidDiagrams);

    console.log('🔄 Incremental update:', {
      codeBlocksToUpdate: codeBlocksToUpdate.length,
      mermaidBlocksToUpdate: mermaidBlocksToUpdate.length
    });

    // Process code blocks incrementally
    if (codeBlocksToUpdate.length > 0) {
      await processCodeBlocksIncrementally(codeBlocksToUpdate, container, onHighlightNeeded);
    }

    // Process Mermaid diagrams incrementally
    if (mermaidBlocksToUpdate.length > 0) {
      await processMermaidBlocksIncrementally(mermaidBlocksToUpdate, container, onMermaidNeeded);
    }

    onUpdateComplete();

  } catch (error) {
    console.error('Incremental update failed:', error);
    // Fallback to full render if incremental update fails
    throw error;
  }
}

/**
 * Find blocks that need updating by comparing hashes
 * @param {Array} newBlocks - New blocks
 * @param {Array} oldBlocks - Old blocks
 * @returns {Array} Blocks that need updating
 */
function findBlocksToUpdate(newBlocks, oldBlocks) {
  const oldHashes = new Set(oldBlocks.map(block => block.hash));
  return newBlocks.filter(block => !oldHashes.has(block.hash));
}

/**
 * Process code blocks incrementally
 * @param {Array} blocksToUpdate - Code blocks that need highlighting
 * @param {HTMLElement} container - Preview container
 * @param {Function} onHighlightNeeded - Callback for highlighting
 */
async function processCodeBlocksIncrementally(blocksToUpdate, container, onHighlightNeeded) {
  if (blocksToUpdate.length === 0) return;

  console.log(`🎨 Processing ${blocksToUpdate.length} code blocks incrementally`);

  // Find corresponding DOM elements
  const codeElements = container.querySelectorAll('[data-syntax-placeholder]');
  const elementsToUpdate = [];

  codeElements.forEach(element => {
    const placeholderId = element.dataset.syntaxPlaceholder;
    const code = decodeURIComponent(element.dataset.code);
    const lang = element.dataset.lang;

    // Check if this element needs updating
    const blockToUpdate = blocksToUpdate.find(block =>
      block.hash === `syntax-highlight-${hashCode(lang + code)}`
    );

    if (blockToUpdate) {
      elementsToUpdate.push({
        element,
        code,
        lang,
        placeholderId
      });
    }
  });

  if (elementsToUpdate.length > 0) {
    // Call the highlighting callback
    await onHighlightNeeded(elementsToUpdate);
  }
}

/**
 * Process Mermaid diagrams incrementally
 * @param {Array} blocksToUpdate - Mermaid blocks that need rendering
 * @param {HTMLElement} container - Preview container
 * @param {Function} onMermaidNeeded - Callback for Mermaid rendering
 */
async function processMermaidBlocksIncrementally(blocksToUpdate, container, onMermaidNeeded) {
  if (blocksToUpdate.length === 0) return;

  console.log(`📊 Processing ${blocksToUpdate.length} Mermaid diagrams incrementally`);

  // Find corresponding DOM elements
  const mermaidElements = container.querySelectorAll('[data-mermaid-source]');
  const elementsToUpdate = [];

  mermaidElements.forEach(element => {
    const source = decodeURIComponent(element.dataset.mermaidSource);

    // Check if this element needs updating
    const blockToUpdate = blocksToUpdate.find(block =>
      block.hash === hashContent(source)
    );

    if (blockToUpdate) {
      elementsToUpdate.push({
        element,
        source
      });
    }
  });

  if (elementsToUpdate.length > 0) {
    // Call the Mermaid callback
    await onMermaidNeeded(elementsToUpdate);
  }
}

/**
 * Update a specific DOM element with highlighted code
 * @param {HTMLElement} element - Code element to update
 * @param {string} highlightedHtml - Highlighted HTML content
 */
export function updateCodeElement(element, highlightedHtml) {
  const codeEl = element.querySelector('code');
  if (codeEl) {
    codeEl.innerHTML = highlightedHtml;
    element.setAttribute('data-processed', 'true');
  }
}

/**
 * Update a specific DOM element with Mermaid diagram
 * @param {HTMLElement} element - Mermaid element to update
 * @param {string} diagramHtml - Diagram HTML content
 */
export function updateMermaidElement(element, diagramHtml) {
  element.innerHTML = diagramHtml;
  element.setAttribute('data-processed', 'true');
}

/**
 * Simple hash function (matches HighlightService.hashCode)
 * @param {string} str - String to hash
 * @returns {number} Hash number
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Simple content hash function
 * @param {string} content - Content to hash
 * @returns {string} Hash string
 */
function hashContent(content) {
  return hashCode(content).toString();
}
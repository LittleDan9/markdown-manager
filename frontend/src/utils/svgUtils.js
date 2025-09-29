/**
 * SVG utility functions for handling icon rendering
 */

/**
 * Clean SVG body content for browser rendering by removing namespaces
 * @param {string} body - Raw SVG body content
 * @returns {string} - Cleaned SVG body content
 */
export function cleanSvgBodyForBrowser(body) {
  if (!body || typeof body !== 'string') {
    return body;
  }

  // Remove namespace declarations from body
  let cleaned = body.replace(/xmlns:[^=\s]+="[^"]*"/g, '');

  // Remove namespace prefixes from element names
  // e.g., <ns0:path> becomes <path>, <ns1:g> becomes <g>
  cleaned = cleaned.replace(/<(\/?)ns\d+:/g, '<$1');

  // Remove namespace prefixes from attributes
  // e.g., ns1:pageshadow="2" becomes pageshadow="2" (or remove entirely for unknown attrs)
  cleaned = cleaned.replace(/\s+ns\d+:[\w-]+="[^"]*"/g, '');

  // Clean up any extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Create a complete SVG string with proper namespace declarations
 * @param {string} body - SVG body content
 * @param {string} viewBox - SVG viewBox attribute
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} - Complete SVG string
 */
export function createSvgString(body, viewBox = '0 0 24 24', width = 24, height = 24) {
  const cleanedBody = cleanSvgBodyForBrowser(body);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${cleanedBody}</svg>`;
}
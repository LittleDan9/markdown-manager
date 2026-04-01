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
  let cleanedBody = cleanSvgBodyForBrowser(body);
  // Strip metadata elements that confuse external tools (e.g. Draw.io)
  cleanedBody = cleanedBody.replace(/<title[^>]*>.*?<\/title>/gs, '');
  cleanedBody = cleanedBody.replace(/<desc[^>]*>.*?<\/desc>/gs, '');
  cleanedBody = cleanedBody.replace(/<!--.*?-->/gs, '');
  const xlinkNs = /xlink:/.test(cleanedBody) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${xlinkNs} width="${width}" height="${height}" viewBox="${viewBox}">${cleanedBody}</svg>`;
}

/**
 * Download an SVG icon as a .svg file
 * @param {Object} iconData - Icon data containing body, viewBox, width, height
 * @param {string} filename - Filename without extension
 */
function notify(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('notification', {
    detail: { message, type, duration: 3000 }
  }));
}

export function downloadSvg(iconData, filename = 'icon') {
  if (!iconData || !iconData.body) return;

  const { body, viewBox = '0 0 24 24', width = 24, height = 24 } = iconData;
  const svgString = createSvgString(body, viewBox, width, height);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  notify(`Downloaded ${filename}.svg`);
}

/**
 * Copy an SVG icon to the clipboard as a PNG image.
 * Falls back to copying SVG markup as text if ClipboardItem is not supported.
 * @param {Object} iconData - Icon data containing body, viewBox, width, height
 * @returns {Promise<'image'|'text'>} - Resolves with the format that was copied
 */
export async function copySvgToClipboard(iconData) {
  if (!iconData || !iconData.body) return;

  const { body, viewBox = '0 0 24 24', width = 24, height = 24 } = iconData;
  const svgString = createSvgString(body, viewBox, width, height);

  await navigator.clipboard.writeText(svgString);
  notify('Copied SVG to clipboard');
  return 'text';
}

/**
 * Copy the public raw SVG URL for an icon to the clipboard.
 * @param {string} packName - The icon pack name (e.g. 'awssvg')
 * @param {string} iconKey - The icon key within the pack
 */
export async function copyIconUrl(packName, iconKey) {
  if (!packName || !iconKey) return;
  const url = `${window.location.origin}/api/icons/packs/${encodeURIComponent(packName)}/contents/${encodeURIComponent(iconKey)}/raw`;
  await navigator.clipboard.writeText(url);
  notify('Copied icon URL to clipboard');
}
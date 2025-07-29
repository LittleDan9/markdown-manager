/**
 * Splits `text` into chunks no longer than `chunkSize`, but never cuts
 * a word in half — it always breaks on the last whitespace or newline.
 *
 * @param {string} text
 * @param {number} chunkSize
 * @returns {string[]}
 */
export function chunkText(text, chunkSize) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    // Tentative end point
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      // Look backwards for the nearest space or newline
      const lastSpace   = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const splitPos    = Math.max(lastSpace, lastNewline);

      // If we found a break point after `start`, use it
      if (splitPos > start) {
        end = splitPos;
      }
    }

    // Extract the chunk, advance start
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Splits `text` into chunks no longer than `chunkSize`, breaking only
 * on whitespace or newline. Returns objects with both the slice and its
 * original starting index.
 *
 * @param {string} text
 * @param {number} chunkSize
 * @returns {{ text: string, offset: number }[]}
 */
export function chunkTextWithOffsets(text, chunkSize) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const lastSpace   = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const splitPos    = Math.max(lastSpace, lastNewline);
      if (splitPos > start) {
        end = splitPos;
      }
    }

    chunks.push({
      text: text.slice(start, end),
      offset: start
    });
    start = end;
  }

  return chunks;
}